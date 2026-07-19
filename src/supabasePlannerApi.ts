import { createClient, type User } from "@supabase/supabase-js";
import type { AiAction, CalendarFeedTokenMetadata, McpTokenMetadata, PlannerApi, PlannerData, Settings } from "./types";
import { fallbackData, normalizeData } from "./browserFallback";
import { DEFAULT_WIDGET_APPEARANCE, normalizeWidgetAppearance } from "./widget/widgetPreferences";
import { DEFAULT_WIDGET_TIMER_PREFERENCES, normalizeWidgetTimerPreferences } from "./widget/widgetTimer";

const PROFILE_TABLE = "dayflow_profiles";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function tokenMetadata(row: any): McpTokenMetadata {
  return { id: row.id, name: row.name, tokenPrefix: row.token_prefix, createdAt: row.created_at, lastUsedAt: row.last_used_at || undefined };
}

function calendarTokenMetadata(row: any): CalendarFeedTokenMetadata {
  return { id: row.id, tokenPrefix: row.token_prefix, createdAt: row.created_at, lastUsedAt: row.last_used_at || undefined };
}

const defaultSettings: Settings = {
  activeMode: "execute",
  defaultTimelineView: "daily",
  continuousCrossDayScroll: true,
  language: "en",
  planningView: "tree",
  metricsRangePreset: "today",
  metricsGroupBy: "project",
  metricsDisplayMetric: "percentage",
  metricsIncludeHabits: "include",
  metricsCompletionFilter: "all",
  aiDockOpen: false,
  appTitle: "NavoPath",
  model: "deepseek-ai/DeepSeek-V3.2",
  reasoningMode: "instant",
  baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
  hasApiKey: false,
  apiKeyPreview: "",
  displayName: "NavoPath",
  avatarDataUrl: "",
  onboardingVersion: 2,
  onboardingStep: "done",
  dailyFocusTime: "20:00",
  weekStartsOn: 0,
  theme: "light",
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
  uiStyle: "gradient",
  dayStartTime: "00:00",
  scheduleDayStartTime: "08:00",
  dayEndTime: "22:00",
  scheduleBufferMinutes: 5,
  autoEstimateTaskDuration: true,
  autoAssignTaskProject: true,
  syncIntervalMinutes: 60,
  lastSyncedAt: undefined,
  idleThresholdMinutes: 5,
  focusModeDefault: "stopwatch",
  featureKanbanViewEnabled: false,
  featureQuadrantViewEnabled: false,
  featureListViewEnabled: false,
  featureHabitsEnabled: true,
  featureHabitCandidatesEnabled: true,
  featureWidgetEnabled: true,
  widgetAlwaysOnTop: true,
  widgetOpenOnLaunch: false,
  compactWindowAlwaysOnTop: true,
  widgetAppearance: DEFAULT_WIDGET_APPEARANCE,
  widgetTimerPreferences: DEFAULT_WIDGET_TIMER_PREFERENCES,
  widgetAppearanceMigrated: false,
};

function publicUser(user: User | null) {
  return user ? { id: user.id, email: user.email } : null;
}

function mergeSettings(settings: unknown): Settings {
  const stored = { ...((settings || {}) as Partial<Settings>) };
  if (stored.executeAccentColor === "#C69CF9") stored.executeAccentColor = "";
  if (stored.planningAccentColor === "#CAFF72") stored.planningAccentColor = "";
  if (stored.model === "deepseek-v4-flash" || stored.model === "deepseek-chat" || /^deepseek-ai\/DeepSeek-V4-(?:Flash|Pro)$/i.test(stored.model || "")) stored.model = "deepseek-ai/DeepSeek-V3.2";
  if (!stored.baseUrl || stored.baseUrl === "https://api.deepseek.com/chat/completions") stored.baseUrl = "https://api.siliconflow.cn/v1/chat/completions";
  // Migrate syncIntervalMinutes: accept legacy plain numbers, fall back to default 60, normalize invalid values
  if (typeof stored.syncIntervalMinutes !== "number" || !Number.isFinite(stored.syncIntervalMinutes) || stored.syncIntervalMinutes < 0) {
    stored.syncIntervalMinutes = 60;
  }
  stored.widgetAppearance = normalizeWidgetAppearance(stored.widgetAppearance);
  stored.widgetTimerPreferences = normalizeWidgetTimerPreferences(stored.widgetTimerPreferences);
  return { ...defaultSettings, ...stored };
}

const SYNC_COLLECTIONS = ["goals", "projects", "tasks", "timeEntries", "longTasks", "notes", "drafts", "aiConversations", "aiMemories", "scheduleTemplates"] as const;

function itemTime(item: any) {
  return Date.parse(item?.updatedAt || item?.createdAt || item?.savedAt || "") || 0;
}

function mergePlannerData(remote: PlannerData, local: PlannerData): PlannerData {
  const deleted = { ...(remote.sync?.deleted || {}), ...(local.sync?.deleted || {}) };
  const merged: any = { ...remote, ...local, sync: { deleted } };
  for (const collection of SYNC_COLLECTIONS) {
    const byId = new Map<string, any>();
    for (const item of ((remote as any)[collection] || [])) if (item?.id) byId.set(item.id, item);
    for (const item of ((local as any)[collection] || [])) {
      if (!item?.id) continue;
      const current = byId.get(item.id);
      if (!current || itemTime(item) >= itemTime(current)) byId.set(item.id, item);
    }
    merged[collection] = Array.from(byId.values()).filter((item: any) => {
      const deletedAt = Date.parse(deleted[`${collection}:${item.id}`] || "") || 0;
      return deletedAt < itemTime(item);
    });
  }
  merged.chat = local.chat || remote.chat || [];
  merged.events = local.events || remote.events || [];
  merged.savedAt = new Date().toISOString();
  return normalizeData(merged);
}

function emptyCloudData(): PlannerData {
  return {
    version: 1,
    importedSeedVersion: "cloud-empty-v1",
    generatedAt: now(),
    goals: [],
    projects: [],
    tasks: [],
    timeEntries: [],
    longTasks: [],
    events: [],
    notes: [],
    drafts: [],
    chat: [],
    aiConversations: [],
    activeAiConversationId: undefined,
    aiMemories: [],
    scheduleTemplates: [],
    taskLayouts: {},
  };
}

function authErrorMessage(message: string) {
  const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i);
  if (waitMatch) return `请求过于频繁，请在 ${waitMatch[1]} 秒后重试。`;
  if (/invalid login credentials/i.test(message)) return "邮箱或密码不正确。";
  if (/email not confirmed/i.test(message)) return "邮箱还没有完成确认，请先打开确认邮件中的链接。";
  if (/email link.*invalid|link.*expired|otp.*expired|token.*expired/i.test(message)) return "确认链接无效或已过期，请重新发送确认邮件。";
  if (/user already registered|already been registered|already exists/i.test(message)) return "这个邮箱已经注册过，请直接登录。";
  if (/password/i.test(message) && /weak|short|least/i.test(message)) return "密码强度不够，请至少使用 6 位字符。";
  if (/rate limit|security purposes/i.test(message)) return "请求过于频繁，请稍后再试。";
  return message || "账号请求失败，请稍后再试。";
}

function isRetryableProfileError(message = "") {
  return /schema cache|Could not query the database|timeout|temporarily|PGRST/i.test(message);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function emailConfirmationRedirectUrl() {
  return new URL("/app?auth_callback=1", window.location.origin).toString();
}

function clearAuthCallbackUrl() {
  const url = new URL(window.location.href);
  const authKeys = ["auth_callback", "code", "token_hash", "type", "error", "error_code", "error_description"];
  authKeys.forEach((key) => url.searchParams.delete(key));
  if (url.hash && /access_token|refresh_token|error_description|type=signup/i.test(url.hash)) url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export function createSupabasePlannerApi(supabaseUrl: string, supabaseAnonKey: string): PlannerApi {
  const desktopStorage = window.desktopApi?.authStorage;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...(desktopStorage ? { storage: desktopStorage } : {})
    }
  });
  let cachedUser: User | null | undefined;
  let userPromise: Promise<User | null> | null = null;
  let profileCache: { data: PlannerData; settings: Settings; revision: number } | null = null;
  let profilePromise: Promise<{ data: PlannerData; settings: Settings; revision: number }> | null = null;

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
    const useTemporaryProfile = () => {
      const initialData = emptyCloudData();
      const initialSettings = {
        ...defaultSettings,
        onboardingVersion: 0,
        onboardingStep: "add" as const,
      };
      profileCache = { data: initialData, settings: initialSettings, revision: 0 };
      return profileCache;
    };
    const pending = (async () => {
      let data: any = null;
      let error: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await supabase
          .from(PROFILE_TABLE)
          .select("data, settings, revision")
          .eq("user_id", user.id)
          .maybeSingle();
        data = result.data;
        error = result.error;
        if (!error || !isRetryableProfileError(error.message)) break;
        await wait(260 * (attempt + 1));
      }

      if (error && isRetryableProfileError(error.message)) {
        const fallback = await supabase
          .from(PROFILE_TABLE)
          .select("data, settings")
          .eq("user_id", user.id)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        if (isRetryableProfileError(error.message)) return useTemporaryProfile();
        throw new Error(`Cloud profile load failed: ${error.message}`);
      }
      if (data) {
        profileCache = {
          data: normalizeData((data as any).data as PlannerData),
          settings: mergeSettings((data as any).settings),
          revision: Number((data as any).revision || 0),
        };
        return profileCache;
      }

      const initialData = emptyCloudData();
      const initialSettings = {
        ...defaultSettings,
        onboardingVersion: 0,
        onboardingStep: "add" as const,
      };
      let insertError: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await supabase
          .from(PROFILE_TABLE)
          .insert({
            user_id: user.id,
            data: initialData,
            settings: initialSettings,
            created_at: now(),
            updated_at: now()
          });
        insertError = result.error;
        if (!insertError || !isRetryableProfileError(insertError.message)) break;
        await wait(260 * (attempt + 1));
      }

      if (insertError) {
        if (isRetryableProfileError(insertError.message)) return useTemporaryProfile();
        throw new Error(`Cloud profile create failed: ${insertError.message}`);
      }
      profileCache = { data: initialData, settings: initialSettings, revision: 0 };
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
    let current = await ensureProfile(user);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nextData = patch.data ? mergePlannerData(current.data, normalizeData(patch.data)) : current.data;
      const nextSettings = patch.settings ? mergeSettings({ ...current.settings, ...patch.settings }) : current.settings;
      const { data: rows, error } = await supabase.rpc("save_dayflow_profile", {
        expected_revision: current.revision,
        next_data: nextData,
        next_settings: nextSettings,
      });
      if (!error && rows?.[0]) {
        profileCache = { data: normalizeData(rows[0].data), settings: mergeSettings(rows[0].settings), revision: Number(rows[0].revision) };
        return profileCache;
      }
      if (!/PROFILE_REVISION_CONFLICT|40001/i.test(error?.message || "") || attempt === 2) throw new Error(error?.message || "Sync failed");
      profileCache = null;
      current = await ensureProfile(user, true);
    }
    throw new Error("Sync failed");
  }

  const api: PlannerApi = {
    getAuthState: async () => ({
      mode: "cloud",
      user: publicUser(await getUser()),
      configured: true
    }),

    getBootstrap: async (options?: { force?: boolean }) => {
      const user = await getUser();
      const auth = {
        mode: "cloud" as const,
        user: publicUser(user),
        configured: true
      };
      if (!user) return { auth, data: null, settings: null };
      const profile = await ensureProfile(user, Boolean(options?.force));
      return { auth, data: profile.data, settings: profile.settings, revision: profile.revision };
    },

    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailConfirmationRedirectUrl()
        }
      });
      if (error) throw new Error(authErrorMessage(error.message));
      cachedUser = data.user ?? null;
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
      cachedUser = data.user ?? null;
      return { user: publicUser(data.user) };
    },

    resendConfirmation: async (email) => {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: emailConfirmationRedirectUrl()
        }
      });
      if (error) throw new Error(authErrorMessage(error.message));
      return { message: "确认邮件已重新发送。" };
    },

    completeEmailConfirmation: async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const errorDescription = url.searchParams.get("error_description")
          || hashParams.get("error_description")
          || url.searchParams.get("error_code")
          || hashParams.get("error_code");
        if (errorDescription) throw new Error(authErrorMessage(errorDescription));

        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error(authErrorMessage(error.message));
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email"
          });
          if (error) throw new Error(authErrorMessage(error.message));
        }

        let sessionUser: User | null = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw new Error(authErrorMessage(error.message));
          sessionUser = data.session?.user ?? null;
          if (sessionUser) break;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        cachedUser = sessionUser;
        return {
          confirmed: Boolean(sessionUser),
          user: publicUser(sessionUser),
          message: sessionUser ? "邮箱确认成功，正在打开工作区。" : "邮箱可能已确认，请使用邮箱和密码登录。"
        };
      } finally {
        clearAuthCallbackUrl();
      }
    },

    signOut: async () => {
      cachedUser = null;
      userPromise = null;
      profileCache = null;
      profilePromise = null;
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw new Error(error.message);
    },

    deleteAccount: async () => {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw new Error(error.message);
      profileCache = null;
      cachedUser = null;
      await supabase.auth.signOut({ scope: "local" });
    },

    sendPasswordResetEmail: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/app?auth_callback=1", window.location.origin).toString(),
      });
      if (error) throw new Error(authErrorMessage(error.message));
      return { message: "密码重置邮件已发送，请检查收件箱。" };
    },

    resetPassword: async (newPassword: string) => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        return { success: false, message: "重置链接已过期或无效，请重新发起密码重置。" };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(authErrorMessage(error.message));
      return { success: true, message: "密码已成功更改。" };
    },

    clearAuthCallbackUrl: () => {
      clearAuthCallbackUrl();
    },

    getData: async () => {
      const user = await requireUser();
      return (await ensureProfile(user)).data;
    },

    saveData: async (data) => {
      const saved = normalizeData({ ...data, savedAt: now() });
      return (await updateProfile({ data: saved })).data;
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
          const memory = { id: uid("memory"), content: action.content, createdAt: now(), updatedAt: now(), tags: action.tags || [], source: "auto" as const };
          data.aiMemories = data.aiMemories || [];
          data.aiMemories.push(memory);
          applied.push({ type: "add_memory", id: memory.id, title: memory.content.slice(0, 30) });
        }
      }
      return { data: await api.saveData(data), applied };
    },

    resetSeed: async () => {
      const reset = fallbackData();
      return (await updateProfile({ data: reset })).data;
    },

    getSettings: async () => {
      const user = await requireUser();
      return (await ensureProfile(user)).settings;
    },

    saveSettings: async (settings) => {
      const current = await api.getSettings();
      const next = mergeSettings({ ...current, ...settings, hasApiKey: false, apiKeyPreview: "" });
      return (await updateProfile({ settings: next })).settings;
    },
    subscribeToRemoteChanges: (listener) => {
      let channel: ReturnType<typeof supabase.channel> | null = null;
      let disposed = false;
      void requireUser().then((user) => {
        if (disposed) return;
        channel = supabase.channel(`dayflow-profile-${user.id}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: PROFILE_TABLE, filter: `user_id=eq.${user.id}` }, (payload) => {
            const row = payload.new as any;
            if (!row?.data || !row?.settings) return;
            const next = { data: normalizeData(row.data), settings: mergeSettings(row.settings), revision: Number(row.revision || 0) };
            if (!profileCache || next.revision > profileCache.revision) {
              profileCache = next;
              listener({ data: next.data, settings: next.settings, revision: next.revision });
            }
          })
          .subscribe();
      }).catch(() => undefined);
      return () => {
        disposed = true;
        if (channel) void supabase.removeChannel(channel);
      };
    },
    listMcpTokens: async () => {
      await requireUser();
      const { data, error } = await supabase.rpc("list_mcp_tokens");
      if (error) throw new Error(error.message);
      return (data || []).map(tokenMetadata);
    },
    createMcpToken: async (name) => {
      await requireUser();
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = `nvp_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const { data, error } = await supabase.rpc("create_mcp_token", {
        token_name: name.trim() || "MCP client",
        token_digest: await sha256(token),
        token_label_prefix: token.slice(0, 12),
      });
      if (error) throw new Error(error.message);
      return { token, metadata: tokenMetadata(data?.[0]) };
    },
    revokeMcpToken: async (id) => {
      await requireUser();
      const { error } = await supabase.rpc("revoke_mcp_token", { token_id: id });
      if (error) throw new Error(error.message);
    },
    listCalendarFeedTokens: async () => {
      await requireUser();
      const { data, error } = await supabase.rpc("list_calendar_feed_tokens");
      if (error) throw new Error(error.message);
      return (data || []).map(calendarTokenMetadata);
    },
    createCalendarFeedToken: async () => {
      await requireUser();
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = `nvc_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const { data, error } = await supabase.rpc("create_calendar_feed_token", {
        token_digest: await sha256(token),
        token_label_prefix: token.slice(0, 12),
      });
      if (error) throw new Error(error.message);
      return { token, metadata: calendarTokenMetadata(data?.[0]) };
    },
    revokeCalendarFeedToken: async (id) => {
      await requireUser();
      const { error } = await supabase.rpc("revoke_calendar_feed_token", { token_id: id });
      if (error) throw new Error(error.message);
    },

    selectBackgroundImage: async () => ({ path: "" }),

    chat: async () => ({
      reply: "公开网页版暂不保存个人 AI API Key。你仍然可以使用本地版的 AI 设置，或后续接入服务端安全代理。",
      actions: []
    })
  };

  return api;
}
