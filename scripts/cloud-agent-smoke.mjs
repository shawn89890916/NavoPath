const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!baseUrl || !anonKey || !serviceKey) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required");
}

const createdUsers = [];
const jsonHeaders = (key, token = key) => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

async function request(path, options = {}, expected = [200]) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (expected.includes(response.status)) return { status: response.status, body };
    if (response.status === 503 && body?.code === "PGRST002" && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      continue;
    }
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  }
  throw new Error(`${options.method || "GET"} ${path} exhausted transient retries`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(label) {
  const nonce = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `navopath-agent-smoke-${label}-${nonce}@example.invalid`;
  const password = `Navo-${crypto.randomUUID()}-9a!`;
  const { body } = await request("/auth/v1/admin/users", {
    method: "POST",
    headers: jsonHeaders(serviceKey),
    body: JSON.stringify({ email, password, email_confirm: true }),
  }, [200, 201]);
  const id = body?.id || body?.user?.id;
  assert(typeof id === "string", "Admin user creation did not return an id");
  createdUsers.push(id);

  const { body: session } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: jsonHeaders(anonKey),
    body: JSON.stringify({ email, password }),
  });
  assert(typeof session?.access_token === "string", "Password sign-in did not return an access token");

  await request("/rest/v1/dayflow_profiles", {
    method: "POST",
    headers: { ...jsonHeaders(anonKey, session.access_token), Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: id, data: {}, settings: { language: "en", aiMemoryEnabled: false }, revision: 0 }),
  }, [201]);
  return { id, token: session.access_token };
}

async function deleteCreatedUsers() {
  for (const id of createdUsers.reverse()) {
    try {
      await request(`/auth/v1/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: jsonHeaders(serviceKey),
      }, [200, 204]);
    } catch (error) {
      console.error(`Cleanup failed for temporary user ${id}:`, error instanceof Error ? error.message : error);
    }
  }
}

try {
  const first = await createUser("a");
  const second = await createUser("b");

  const auditId = crypto.randomUUID();
  await request("/rest/v1/navopath_agent_runs", {
    method: "POST",
    headers: { ...jsonHeaders(serviceKey), Prefer: "return=minimal" },
    body: JSON.stringify({
      id: auditId,
      user_id: first.id,
      trigger: "manual",
      status: "failed",
      summary: "Cloud smoke audit",
      tool_log: [{ id: "smoke_tool", name: "workspace_overview", status: "done" }],
      command_log: [],
      pending_commands: [],
      inverse_commands: [],
      base_revision: 0,
    }),
  }, [201]);

  const firstHeaders = jsonHeaders(anonKey, first.token);
  const secondHeaders = jsonHeaders(anonKey, second.token);
  const ownRuns = await request(`/rest/v1/navopath_agent_runs?select=id&user_id=eq.${first.id}`, { headers: firstHeaders });
  const foreignRuns = await request(`/rest/v1/navopath_agent_runs?select=id&user_id=eq.${first.id}`, { headers: secondHeaders });
  assert(ownRuns.body?.length === 1, "Owner could not read the audit row");
  assert(foreignRuns.body?.length === 0, "RLS exposed another user's audit row");

  const foreignProfile = await request(`/rest/v1/dayflow_profiles?select=user_id&user_id=eq.${first.id}`, { headers: secondHeaders });
  assert(foreignProfile.body?.length === 0, "RLS exposed another user's profile");

  await request("/rest/v1/navopath_agent_runs", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ user_id: first.id, trigger: "manual", status: "failed", summary: "forbidden", base_revision: 0 }),
  }, [401, 403]);

  const auditResponse = await request("/functions/v1/ai-assistant", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ mode: "agent_audit" }),
  });
  assert(auditResponse.body?.audits?.some((entry) => entry.id === auditId), "Agent audit endpoint did not return the owner's sanitized audit row");

  await request("/functions/v1/ai-assistant", {
    method: "POST",
    headers: jsonHeaders(anonKey, anonKey),
    body: JSON.stringify({ mode: "agent_audit" }),
  }, [401]);

  const calendarList = await request("/functions/v1/external-calendar", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ op: "list" }),
  });
  assert(Array.isArray(calendarList.body?.sources) && calendarList.body.sources.length === 0, "Temporary user should start without external calendars");

  await request("/functions/v1/external-calendar", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ op: "connect", name: "Rejected smoke source", url: "http://127.0.0.1/calendar.ics" }),
  }, [400]);

  const sourceId = crypto.randomUUID();
  await request("/rest/v1/navopath_calendar_sources", {
    method: "POST",
    headers: { ...jsonHeaders(serviceKey), Prefer: "return=minimal" },
    body: JSON.stringify({
      id: sourceId,
      user_id: first.id,
      name: "Cloud smoke source",
      url_ciphertext: "smoke-ciphertext",
      url_iv: "smoke-iv",
      url_hash: crypto.randomUUID(),
      display_url: "https://calendar.example.invalid/…",
      enabled: true,
      sync_status: "pending",
    }),
  }, [201]);

  const integrationRunId = crypto.randomUUID();
  const integrationCommand = {
    id: `integration_${crypto.randomUUID().slice(0, 8)}`,
    entity: "integration",
    operation: "update",
    targetId: sourceId,
    values: { enabled: false },
    reason: "Cloud smoke confirmed integration update",
  };
  await request("/rest/v1/navopath_agent_runs", {
    method: "POST",
    headers: { ...jsonHeaders(serviceKey), Prefer: "return=minimal" },
    body: JSON.stringify({
      id: integrationRunId,
      user_id: first.id,
      trigger: "manual",
      status: "pending_confirmation",
      summary: "Confirm integration smoke",
      command_log: [{ id: integrationCommand.id, entity: "integration", operation: "update", targetId: sourceId, risk: "confirm" }],
      pending_commands: [integrationCommand],
      inverse_commands: [],
      base_revision: 0,
    }),
  }, [201]);

  const confirmed = await request("/functions/v1/ai-assistant", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ mode: "agent_confirm", runId: integrationRunId, context: { timezone: "UTC" } }),
  });
  assert(confirmed.body?.agent?.applied?.length === 1, "Confirmed integration update was not applied");
  const disabledSource = await request(`/rest/v1/navopath_calendar_sources?select=enabled&id=eq.${sourceId}`, { headers: jsonHeaders(serviceKey) });
  assert(disabledSource.body?.[0]?.enabled === false, "Confirmed integration update did not disable the source");

  const undone = await request("/functions/v1/ai-assistant", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({ mode: "agent_undo", runId: integrationRunId, context: { timezone: "UTC" } }),
  });
  assert(undone.body?.agent?.applied?.length === 1, "Integration update undo was not applied");
  const restoredSource = await request(`/rest/v1/navopath_calendar_sources?select=enabled&id=eq.${sourceId}`, { headers: jsonHeaders(serviceKey) });
  assert(restoredSource.body?.[0]?.enabled === true, "Integration update undo did not restore the source");

  const currentProfile = await request(`/rest/v1/dayflow_profiles?select=revision&user_id=eq.${first.id}`, { headers: firstHeaders });
  const currentRevision = currentProfile.body?.[0]?.revision;
  assert(Number.isInteger(currentRevision), "Could not read the current profile revision");

  const conflictId = crypto.randomUUID();
  await request("/rest/v1/navopath_agent_runs", {
    method: "POST",
    headers: { ...jsonHeaders(serviceKey), Prefer: "return=minimal" },
    body: JSON.stringify({ id: conflictId, user_id: first.id, trigger: "manual", status: "planned", summary: "Conflict smoke", base_revision: currentRevision }),
  }, [201]);

  await request("/rest/v1/rpc/apply_navopath_agent_run", {
    method: "POST",
    headers: firstHeaders,
    body: JSON.stringify({
      expected_revision: 999,
      next_data: {},
      next_settings: { language: "en", aiMemoryEnabled: false },
      target_run_id: conflictId,
      next_status: "applied",
      next_command_log: [],
      next_inverse_commands: [],
      next_integration_commands: [],
      next_undo_expires_at: null,
    }),
  }, [400, 409]);

  const profileAfterConflict = await request(`/rest/v1/dayflow_profiles?select=revision&user_id=eq.${first.id}`, { headers: firstHeaders });
  const runAfterConflict = await request(`/rest/v1/navopath_agent_runs?select=status&id=eq.${conflictId}`, { headers: firstHeaders });
  assert(profileAfterConflict.body?.[0]?.revision === currentRevision, "Revision conflict changed the profile");
  assert(runAfterConflict.body?.[0]?.status === "planned", "Revision conflict partially changed the Agent run");

  console.log("Cloud Agent smoke passed: auth, RLS isolation, audit access, SSRF rejection, confirmed integration undo, and atomic revision conflict.");
} finally {
  await deleteCreatedUsers();
}
