import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

beforeEach(() => {
  createClientMock.mockReset();
  vi.stubGlobal("window", {
    desktopApi: undefined,
    location: { origin: "https://navopath.test", href: "https://navopath.test/app" },
    history: { replaceState: vi.fn() },
    setTimeout,
  });
});

describe("createSupabasePlannerApi", () => {
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

    const bootstrap = await api.getBootstrap?.({ force: true });
    expect(bootstrap?.auth.user).toEqual(user);
    expect(bootstrap?.data?.importedSeedVersion).toBe("cloud-empty-v1");
    expect(bootstrap?.settings?.displayName).toBe("NavoPath");
    expect(maybeSingle).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
