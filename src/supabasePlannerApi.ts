import { createClient, type User } from "@supabase/supabase-js";
import type { AiAction, PlannerApi, PlannerData, Settings } from "./types";
import { fallbackData, normalizeData } from "./browserFallback";

const PROFILE_TABLE = "dayflow_profiles";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

const defaultSettings: Settings = {
  activeMode: "execute",
  language: "en",
  planningView: "tree",
  aiDockOpen: false,
  appTitle: "NavoPath",
  model: "deepseek-v4-flash",
  baseUrl: "",
  hasApiKey: false,
  apiKeyPreview: "",
  displayName: "NavoPath",
  avatarDataUrl: "",
  onboardingVersion: 1,
  onboardingStep: "done",
  dailyFocusTime: "20:00",
  weekStartsOn: 0,
  theme: "dark",
  typographyStyle: "editorial",
  accentColor: "",
  executeAccentColor: "",
  planningAccentColor: "",
  aiTone: "direct",
  hideCompleted: false,
  reminderLeadDays: 7,
  taskNoteDisplay: "summary",
  glassEnabled: false,
  backgroundImagePath: "",
  glassBlur: 18,
  glassOpacity: 88,
  backgroundDim: 12,
  collapsedPanels: [],
  collapsedSections: [],
  panelWidths: { left: 360, right: 390 },
  chatMessageMaxHeight: 220,
  aiMemoryEnabled: true,
  hideAi: false,
  addAdvancedOpen: false,
  uiStyle: "gradient"
};

function publicUser(user: User | null) {
  return user ? { id: user.id, email: user.email } : null;
}

function mergeSettings(settings: unknown): Settings {
  const stored = { ...((settings || {}) as Partial<Settings>) };
  if (stored.executeAccentColor === "#C69CF9") stored.executeAccentColor = "";
  if (stored.planningAccentColor === "#CAFF72") stored.planningAccentColor = "";
  return { ...defaultSettings, ...stored };
}

function emptyCloudData(): PlannerData {
  return {
    version: 1,
    importedSeedVersion: "cloud-empty-v1",
    generatedAt: now(),
    goals: [],
    projects: [],
    tasks: [],
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiMemories: [],
    taskLayouts: {},
  };
}

function authErrorMessage(message: string) {
  const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i);
  if (waitMatch) return `请求过于频繁，请在 ${waitMatch[1]} 秒后重试。`;
  if (/invalid login credentials/i.test(message)) return "邮箱或密码不正确。";
  if (/email not confirmed/i.test(message)) return "邮箱还没有完成确认，请先打开确认邮件中的链接。";
  if (/user already registered|already been registered|already exists/i.test(message)) return "这个邮箱已经注册过，请直接登录。";
  if (/password/i.test(message) && /weak|short|least/i.test(message)) return "密码强度不够，请至少使用 6 位字符。";
  if (/rate limit|security purposes/i.test(message)) return "请求过于频繁，请稍后再试。";
  return message || "账号请求失败，请稍后再试。";
}

export function createSupabasePlannerApi(supabaseUrl: string, supabaseAnonKey: string): PlannerApi {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
  let cachedUser: User | null | undefined;
  let userPromise: Promise<User | null> | null = null;
  let profileCache: { data: PlannerData; settings: Settings } | null = null;
  let profilePromise: Promise<{ data: PlannerData; settings: Settings }> | null = null;

  void supabase.auth.getSession().then(({ data }) => {
    cachedUser = data.session?.user ?? null;
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
    userPromise = null;
    profileCache = null;
    profilePromise = null;
  });

  async function getUser() {
    if (cachedUser !== undefined) return cachedUser;
    if (userPromise) return userPromise;
    const pending = supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        cachedUser = null;
        return null;
      }
      cachedUser = data.session?.user ?? null;
      return cachedUser;
    });
    userPromise = pending;
    try {
      return await pending;
    } finally {
      if (userPromise === pending) userPromise = null;
    }
  }

  async function requireUser() {
    const user = await getUser();
    if (!user) throw new Error("请先登录 NavoPath。");
    return user;
  }

  async function ensureProfile(user: User, force = false) {
    if (!force && profileCache) return profileCache;
    if (!force && profilePromise) return profilePromise;
    const pending = (async () => {
      const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select("data, settings")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (data) {
        profileCache = {
          data: normalizeData((data as any).data as PlannerData),
          settings: mergeSettings((data as any).settings)
        };
        return profileCache;
      }

      const initialData = emptyCloudData();
      const initialSettings = {
        ...defaultSettings,
        onboardingVersion: 0,
        onboardingStep: "add" as const,
      };
      const { error: insertError } = await supabase
        .from(PROFILE_TABLE)
        .insert({
          user_id: user.id,
          data: initialData,
          settings: initialSettings,
          created_at: now(),
          updated_at: now()
        });

      if (insertError) throw new Error(insertError.message);
      profileCache = { data: initialData, settings: initialSettings };
      return profileCache;
    })();
    profilePromise = pending;
    try {
      return await pending;
    } finally {
      if (profilePromise === pending) profilePromise = null;
    }
  }

  async function updateProfile(patch: { data?: PlannerData; settings?: Settings }) {
    const user = await requireUser();
    if (profileCache) {
      profileCache = {
        data: patch.data ? normalizeData(patch.data) : profileCache.data,
        settings: patch.settings ? mergeSettings(patch.settings) : profileCache.settings
      };
    }
    const { error } = await supabase
      .from(PROFILE_TABLE)
      .update({ ...patch, updated_at: now() })
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  const api: PlannerApi = {
    getAuthState: async () => ({
      mode: "cloud",
      user: publicUser(await getUser()),
      configured: true
    }),

    getBootstrap: async () => {
      const user = await getUser();
      const auth = {
        mode: "cloud" as const,
        user: publicUser(user),
        configured: true
      };
      if (!user) return { auth, data: null, settings: null };
      const profile = await ensureProfile(user);
      return { auth, data: profile.data, settings: profile.settings };
    },

    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw new Error(authErrorMessage(error.message));
      if (data.user && data.session) await ensureProfile(data.user, true);
      return {
        user: publicUser(data.user),
        message: data.user && !data.session ? "注册成功。请检查邮箱完成确认后再登录。" : undefined,
        requiresEmailConfirmation: Boolean(data.user && !data.session),
        email
      };
    },

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(authErrorMessage(error.message));
      if (data.user) await ensureProfile(data.user, true);
      return { user: publicUser(data.user) };
    },

    resendConfirmation: async (email) => {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw new Error(authErrorMessage(error.message));
      return { message: "确认邮件已重新发送。" };
    },

    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },

    deleteAccount: async () => {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw new Error(error.message);
      profileCache = null;
      cachedUser = null;
      await supabase.auth.signOut({ scope: "local" });
    },

    getData: async () => {
      const user = await requireUser();
      return (await ensureProfile(user)).data;
    },

    saveData: async (data) => {
      const saved = normalizeData({ ...data, savedAt: now() });
      await updateProfile({ data: saved });
      return saved;
    },

    applyActions: async (actions: AiAction[]) => {
      const data = await api.getData();
      const applied: Array<{ type: string; id: string; title: string }> = [];
      for (const action of actions) {
        if (action.type === "add_task" && action.title && action.dueDate) {
          const task: any = {
            id: uid("task"),
            title: action.title,
            dueDate: action.dueDate,
            category: action.category || "personal",
            priority: action.priority || "medium",
            notes: action.notes || "",
            goalId: action.goalId || "goal_admission",
            completed: false,
            subtasks: (action.subtasks || []).map((subtask) => ({
              id: uid("sub"),
              title: subtask.title,
              completed: false,
              done: false,
              order: 0,
              createdAt: now()
            })),
            createdAt: now(),
            updatedAt: now()
          };
          data.tasks.push(task);
          applied.push({ type: "add_task", id: task.id, title: task.title });
        }
        if (action.type === "add_note" && action.content) {
          const note = { id: uid("note"), content: action.content, createdAt: now(), tags: action.tags || [] };
          data.notes.push(note);
          applied.push({ type: "add_note", id: note.id, title: note.content.slice(0, 30) });
        }
        if (action.type === "add_memory" && action.content) {
          const memory = { id: uid("memory"), content: action.content, createdAt: now(), updatedAt: now(), tags: action.tags || [] };
          data.aiMemories = data.aiMemories || [];
          data.aiMemories.push(memory);
          applied.push({ type: "add_memory", id: memory.id, title: memory.content.slice(0, 30) });
        }
      }
      return { data: await api.saveData(data), applied };
    },

    resetSeed: async () => {
      const reset = fallbackData();
      await updateProfile({ data: reset });
      return reset;
    },

    getSettings: async () => {
      const user = await requireUser();
      return (await ensureProfile(user)).settings;
    },

    saveSettings: async (settings) => {
      const current = await api.getSettings();
      const next = mergeSettings({ ...current, ...settings, hasApiKey: false, apiKeyPreview: "" });
      await updateProfile({ settings: next });
      return next;
    },

    selectBackgroundImage: async () => ({ path: "" }),

    chat: async () => ({
      reply: "公开网页版暂不保存个人 AI API Key。你仍然可以使用本地版的 AI 设置，或后续接入服务端安全代理。",
      actions: []
    })
  };

  return api;
}
