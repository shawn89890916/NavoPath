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
});
