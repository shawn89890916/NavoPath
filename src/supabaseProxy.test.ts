import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../functions/api/supabase/[[path]]";

afterEach(() => vi.unstubAllGlobals());

describe("Supabase same-origin proxy", () => {
  it("forwards authenticated REST requests only to the fixed Supabase project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ revision: 3 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest({
      request: new Request("https://navopath.com/api/supabase/rest/v1/dayflow_profiles?select=revision", {
        headers: { Authorization: "Bearer test-token", apikey: "test-anon-key" },
      }),
      params: { path: ["rest", "v1", "dayflow_profiles"] },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://qplymrkgsnaaamxggwxw.supabase.co/rest/v1/dayflow_profiles?select=revision");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("rejects paths outside the authentication and database APIs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await onRequest({
      request: new Request("https://navopath.com/api/supabase/storage/v1/object"),
      params: { path: ["storage", "v1", "object"] },
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects Supabase admin authentication paths", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await onRequest({
      request: new Request("https://navopath.com/api/supabase/auth/v1/admin/users"),
      params: { path: ["auth", "v1", "admin", "users"] },
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
