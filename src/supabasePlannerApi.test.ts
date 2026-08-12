import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function profileRow(userId: string, title: string, revision = 1) {
  return {
    revision,
    data: {
      version: 1,
      importedSeedVersion: "test",
      generatedAt: "2026-07-19T00:00:00.000Z",
      goals: [],
      projects: [],
      tasks: [{
        id: `task_${userId}`,
        title,
        dueDate: "2026-07-19",
        category: "personal" as const,
        priority: "medium" as const,
        notes: "",
        goalId: "goal_test",
        completed: false,
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      }],
      timeEntries: [],
      longTasks: [],
      events: [],
      notes: [],
      drafts: [],
      chat: [],
      aiConversations: [],
      aiMemories: [],
      taskLayouts: {},
    },
    settings: { language: "en" },
  };
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.stubGlobal("window", {
    desktopApi: undefined,
    location: { origin: "https://navopath.test", href: "https://navopath.test/app" },
    history: { replaceState: vi.fn() },
    setTimeout,
    clearTimeout,
  });
});

describe("createSupabasePlannerApi", () => {
  it("does not treat an email-confirmation signup as an authenticated session", async () => {
    const pendingUser = { id: "user_pending", email: "pending@example.com" };
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(),
        signUp: vi.fn().mockResolvedValue({ data: { user: pendingUser, session: null }, error: null }),
      },
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");

    await expect(api.signUp?.("pending@example.com", "password")).resolves.toEqual(expect.objectContaining({
      user: pendingUser,
      requiresEmailConfirmation: true,
    }));
    await expect(api.getAuthState?.()).resolves.toEqual({
      mode: "cloud",
      user: null,
      configured: true,
    });
  });

  it("clears the local session even when the sign-out request fails offline", async () => {
    const user = { id: "user_1", email: "user@example.com" };
    const removeItem = vi.fn().mockResolvedValue(undefined);
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(),
        stopAutoRefresh: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue({ error: { message: "Offline" } }),
      },
    });
    window.desktopApi = {
      authStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem },
    } as any;

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");
    await expect(api.getAuthState?.()).resolves.toEqual(expect.objectContaining({ user }));

    await expect(api.signOut?.()).resolves.toBeUndefined();
    expect(removeItem).toHaveBeenCalledWith("sb-supabase-auth-token");
    expect(removeItem).toHaveBeenCalledWith("sb-supabase-auth-token-code-verifier");
    await expect(api.getAuthState?.()).resolves.toEqual(expect.objectContaining({ user: null }));
  });

  it("does not let the initial session lookup overwrite a completed sign-in", async () => {
    const initialSession = deferred<{ data: { session: null }; error: null }>();
    const user = { id: "user_new", email: "new@example.com" };
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(() => initialSession.promise),
        onAuthStateChange: vi.fn(),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");

    await api.signIn?.("new@example.com", "password");
    initialSession.resolve({ data: { session: null }, error: null });
    await initialSession.promise;
    await Promise.resolve();

    await expect(api.getAuthState?.()).resolves.toEqual({
      mode: "cloud",
      user,
      configured: true,
    });
  });

  it("does not reuse a late profile response after the authenticated user changes", async () => {
    const userA = { id: "user_a", email: "a@example.com" };
    const userB = { id: "user_b", email: "b@example.com" };
    const oldProfile = deferred<{ data: ReturnType<typeof profileRow>; error: null }>();
    let authHandler: ((_event: string, session: { user: typeof userA } | null) => void) | undefined;
    const maybeSingle = vi.fn((userId: string) => userId === userA.id
      ? oldProfile.promise
      : Promise.resolve({ data: profileRow(userB.id, "User B"), error: null }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, userId: string) => ({
          maybeSingle: () => maybeSingle(userId),
        })),
      })),
    }));
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: userA } }, error: null }),
        onAuthStateChange: vi.fn((handler) => {
          authHandler = handler;
        }),
      },
      from,
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");
    await api.getAuthState?.();
    const staleLoad = api.getBootstrap?.({ force: true });
    await vi.waitFor(() => expect(maybeSingle).toHaveBeenCalledWith(userA.id));

    authHandler?.("SIGNED_IN", { user: userB });
    await expect(api.getBootstrap?.({ force: true })).resolves.toEqual(expect.objectContaining({
      auth: expect.objectContaining({ user: userB }),
      data: expect.objectContaining({ tasks: [expect.objectContaining({ title: "User B" })] }),
    }));

    oldProfile.resolve({ data: profileRow(userA.id, "User A"), error: null });
    await staleLoad;
    await expect(api.getData()).resolves.toEqual(expect.objectContaining({
      tasks: [expect.objectContaining({ title: "User B" })],
    }));
  });

  it("does not send an old user's pending save after authentication changes", async () => {
    const userA = { id: "user_a", email: "a@example.com" };
    const userB = { id: "user_b", email: "b@example.com" };
    const oldProfile = deferred<{ data: ReturnType<typeof profileRow>; error: null }>();
    let authHandler: ((_event: string, session: { user: typeof userA } | null) => void) | undefined;
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: () => oldProfile.promise })),
      })),
    }));
    const rpc = vi.fn();
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: userA } }, error: null }),
        onAuthStateChange: vi.fn((handler) => {
          authHandler = handler;
        }),
      },
      from,
      rpc,
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");
    await api.getAuthState?.();
    const save = api.saveData?.(profileRow(userA.id, "Changed").data);
    await vi.waitFor(() => expect(from).toHaveBeenCalled());

    authHandler?.("SIGNED_IN", { user: userB });
    oldProfile.resolve({ data: profileRow(userA.id, "User A"), error: null });

    await expect(save).rejects.toThrow("Account changed while syncing");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("finishes password authentication before loading the cloud profile", async () => {
    const schemaCacheError = {
      message: "Could not query the database for the schema cache",
    };
    const user = { id: "user_1", email: "user@example.com" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: schemaCacheError });
    const insert = vi.fn().mockResolvedValue({ error: schemaCacheError });
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const from = vi.fn(() => ({ select, insert }));

    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from,
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");

    await expect(api.signIn?.("user@example.com", "password")).resolves.toEqual({ user });
    expect(maybeSingle).not.toHaveBeenCalled();

    await expect(api.getBootstrap?.({ force: true })).rejects.toThrow("Cloud profile load failed");
    expect(maybeSingle).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("never exposes a temporary empty workspace when an existing profile cannot load", async () => {
    const user = { id: "user_existing", email: "existing@example.com" };
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Cloud request timed out. Please try again." },
    });
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");

    await expect(api.getBootstrap?.({ force: true })).rejects.toThrow("Cloud profile load failed");
    await expect(api.getData()).rejects.toThrow("Cloud profile load failed");
  });

  it("applies newer profile revisions from realtime events and reconnect reconciliation", async () => {
    const user = { id: "user_1", email: "user@example.com" };
    const row = (revision: number, title: string) => ({
      revision,
      data: {
        version: 1,
        importedSeedVersion: "test",
        generatedAt: "2026-07-19T00:00:00.000Z",
        goals: [],
        projects: [],
        tasks: [{ id: `task_${revision}`, title, completed: false, createdAt: "2026-07-19T00:00:00.000Z" }],
        timeEntries: [],
        longTasks: [],
        events: [],
        notes: [],
        drafts: [],
        chat: [],
        aiConversations: [],
        aiMemories: [],
        taskLayouts: {},
      },
      settings: { language: "en" },
    });
    let currentRow = row(1, "Initial");
    const maybeSingle = vi.fn(async () => ({ data: currentRow, error: null }));
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
    const from = vi.fn(() => ({ select }));
    let changeHandler: ((payload: { new: unknown }) => void) | undefined;
    let statusHandler: ((status: string) => void) | undefined;
    const channelApi = {
      on: vi.fn((_event, _filter, handler) => {
        changeHandler = handler;
        return channelApi;
      }),
      subscribe: vi.fn((handler) => {
        statusHandler = handler;
        return channelApi;
      }),
    };
    const removeChannel = vi.fn();

    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(),
      },
      from,
      channel: vi.fn(() => channelApi),
      removeChannel,
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");
    await api.getBootstrap?.({ force: true });
    const listener = vi.fn();
    const unsubscribe = api.subscribeToRemoteChanges?.(listener);
    await vi.waitFor(() => expect(statusHandler).toBeTypeOf("function"));

    currentRow = row(2, "Recovered after reconnect");
    statusHandler?.("SUBSCRIBED");
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 })));

    changeHandler?.({ new: row(3, "Live update") });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 3 }));
    changeHandler?.({ new: row(2, "Stale update") });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe?.();
    expect(removeChannel).toHaveBeenCalledWith(channelApi);
  });

  it("merges habits and daily habit states by id when saving from another device", async () => {
    const user = { id: "user_1", email: "user@example.com" };
    const remoteHabit = { id: "habit_remote", title: "Remote habit", defaultDurationMinutes: 20, createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T01:00:00.000Z" };
    const remoteState = { id: "state_remote", habitId: remoteHabit.id, date: "2026-07-19", completed: true, createdAt: "2026-07-19T01:00:00.000Z", updatedAt: "2026-07-19T01:00:00.000Z" };
    const baseData = {
      version: 1, importedSeedVersion: "test", generatedAt: "2026-07-19T00:00:00.000Z",
      goals: [], projects: [], tasks: [], habits: [remoteHabit], habitDailyStates: [remoteState],
      timeEntries: [], longTasks: [], events: [], notes: [], drafts: [], chat: [], aiConversations: [], aiMemories: [], taskLayouts: {},
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: { revision: 1, data: baseData, settings: { language: "en" } }, error: null });
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }));
    const rpc = vi.fn(async (_name, args) => ({
      data: [{ revision: 2, data: args.next_data, settings: args.next_settings }],
      error: null,
    }));
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(),
      },
      from,
      rpc,
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");
    await api.getBootstrap?.({ force: true });
    const localHabit = { id: "habit_local", title: "Local habit", defaultDurationMinutes: 15, createdAt: "2026-07-19T02:00:00.000Z", updatedAt: "2026-07-19T02:00:00.000Z" };
    const saved = await api.saveData?.({ ...baseData, habits: [localHabit], habitDailyStates: [] });

    expect(saved?.habits?.map((habit) => habit.id).sort()).toEqual(["habit_local", "habit_remote"]);
    expect(saved?.habitDailyStates).toEqual([remoteState]);
  });

  it("retries calendar subscription generation after a transient pool timeout", async () => {
    const user = { id: "user_1", email: "user@example.com" };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: "Timed out acquiring connection from connection pool." } })
      .mockResolvedValueOnce({ data: [{ id: "token_1", token_prefix: "nvc_12345678", created_at: "2026-07-19T00:00:00.000Z", last_used_at: null }], error: null });
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(),
      },
      rpc,
    });

    const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
    const api = createSupabasePlannerApi("https://supabase.test", "anon");
    const created = await api.createCalendarFeedToken?.();

    expect(created?.metadata.id).toBe("token_1");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("stops retrying when the cloud service never responds", async () => {
    const timeoutSpy = vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return {} as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout").mockImplementation(() => undefined);
    const user = { id: "user_1", email: "user@example.com" };
    const abortSignal = vi.fn(() => new Promise(() => undefined));
    const rpc = vi.fn(() => ({ abortSignal }));
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: null }),
        onAuthStateChange: vi.fn(),
      },
      rpc,
    });

    try {
      const { createSupabasePlannerApi } = await import("./supabasePlannerApi");
      const api = createSupabasePlannerApi("https://supabase.test", "anon");
      const result = api.createCalendarFeedToken?.().catch((error) => error);

      await expect(result).resolves.toEqual(expect.objectContaining({ message: "Cloud request timed out. Please try again." }));
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(abortSignal).toHaveBeenCalledTimes(2);
    } finally {
      timeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });
});
