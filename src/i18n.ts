// ═══════════════════════════════════════════
// NavoPath i18n — centralized translation dictionary
// ═══════════════════════════════════════════

export type Language = "en" | "zh";

/** Detect user's system language. Returns "zh" only for zh-CN/zh-SG/zh-* etc.; everything else → "en". */
export function detectSystemLanguage(): Language {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  return /^zh\b/i.test(nav) ? "zh" : "en";
}

// ── Date Helpers ─────────────────────────────

const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZH_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function weekdayName(lang: Language, index: number): string {
  return lang === "zh" ? ZH_WEEKDAYS[index] : EN_WEEKDAYS[index];
}

export function formatDateTitle(lang: Language, year: number, month: number, day: number): string {
  const wd = weekdayName(lang, new Date(year, month - 1, day).getDay());
  if (lang === "zh") {
    return `${month}月${day}日 ${wd}`;
  }
  const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${enMonths[month - 1]} ${day} ${wd}`;
}

export function monthTitle(lang: Language, year: number, month: number): string {
  if (lang === "zh") return `${year}年${month}月`;
  const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${enMonths[month - 1]} ${year}`;
}

export function shortDateStr(lang: Language, dateStr: string): string {
  if (!dateStr) return lang === "zh" ? "未定" : "N/A";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  if (lang === "zh") return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function nowLabel(lang: Language): string {
  return lang === "zh" ? "现在" : "Now";
}

// ── Translation Dictionary ──────────────────

export const TR = {

  // ── Categories ──────────────────────────
  categories: {
    zh: ["考试", "英国申请", "美国申请", "文书", "材料", "项目", "个人"],
    en: ["Exams", "UK App", "US App", "Essays", "Materials", "Projects", "Personal"],
  },

  // ── Priority labels ─────────────────────
  priorities: {
    zh: ["必须做", "应该做", "有空做"],
    en: ["Must Do", "Should Do", "Could Do"],
  },

  // ── View mode labels ────────────────────
  views: {
    zh: { daily: "天", "3day": "3天", weekly: "周", month: "月" },
    en: { daily: "Day", "3day": "3-Day", weekly: "Week", month: "Month" },
  },

  // ── Header / Modes ─────────────────────
  header: {
    zh: { execute: "执行", planning: "规划", settings: "设置" },
    en: { execute: "Execute", planning: "Planning", settings: "Settings" },
  },

  // ── AuthGate ────────────────────────────
  auth: {
    zh: {
      tagline: "从长期规划里选出今天要推进的事。",
      login: "登录",
      register: "注册",
      username: "用户名",
      email: "邮箱",
      password: "密码",
      confirmPassword: "确认密码",
      showPassword: "显示密码",
      passwordMismatch: "两次输入的密码不一致。",
      checkInbox: "请先确认邮箱",
      emailSent: "确认邮件已发送到",
      resend: "重发邮件",
      confirmedGoLogin: "我已确认，去登录",
      processing: "处理中...",
      enterApp: "进入 NavoPath",
      createAccount: "创建账号",
      note: "每个账号的数据独立保存。已注册过请直接登录；连续注册会触发邮件安全限流。公开网页版不会保存个人 AI API Key。",
      afterConfirm: "邮箱确认完成后，请直接登录。",
    },
    en: {
      tagline: "Pick what moves today forward from your long-term plan.",
      login: "Log In",
      register: "Sign Up",
      username: "Display Name",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      showPassword: "Show Password",
      passwordMismatch: "Passwords do not match.",
      checkInbox: "Check your inbox",
      emailSent: "Confirmation email sent to",
      resend: "Resend Email",
      confirmedGoLogin: "I've confirmed, sign in",
      processing: "Processing...",
      enterApp: "Enter NavoPath",
      createAccount: "Create Account",
      note: "Account data is stored independently. If already registered, sign in directly. Repeated signups may trigger email rate limiting. Public web app does not store personal AI API Keys.",
      afterConfirm: "After confirming your email, sign in with your password.",
    },
  },

  // ── Candidate Panel ─────────────────────
  candidate: {
    zh: {
      title: "今日候选",
      hideCompleted: "隐藏已完成",
      showCompleted: "显示已完成",
      ungroup: "取消分组",
      groupByProject: "按项目分组",
      pickFromPlanning: "从规划选择",
      emptyTitle: "今天还没有任务",
      emptyDesc: "从规划页选择任务，或直接添加一个。",
      unassigned: "未归属",
      deletedTask: "已删除任务",
      addPlaceholder: "添加任务 #项目",
      add: "添加",
      collapse: "收起面板",
      expand: "展开面板",
      simpleView: "简洁显示",
      fullscreen: "全屏",
    },
    en: {
      title: "Today's Candidates",
      hideCompleted: "Hide Completed",
      showCompleted: "Show Completed",
      ungroup: "Ungroup",
      groupByProject: "Group by Project",
      pickFromPlanning: "Pick from Planning",
      emptyTitle: "No tasks yet today",
      emptyDesc: "Pick tasks from Planning, or add one directly.",
      unassigned: "Unassigned",
      deletedTask: "Deleted task",
      addPlaceholder: "Add task #project",
      add: "Add",
      collapse: "Collapse Panel",
      expand: "Expand Panel",
      simpleView: "Simple View",
      fullscreen: "Fullscreen",
    },
  },

  // ── Timeline ────────────────────────────
  timeline: {
    zh: {
      prevSegment: "前一段",
      nextSegment: "后一段",
      aiPlanToday: "AI 规划今天",
      aiPlanningSettings: "AI 规划设置",
      analyzing: "分析中...",
      adopting: "采纳中...",
      regenerate: "重新生成",
      planningSuggestion: "规划建议",
      adoptAll: "全部采纳",
      cancelPreview: "取消全部预览",
      source: "任务来源",
      fromCandidates: "今日候选",
      allUnfinished: "全部未完成",
      scope: "安排范围",
      strategy: "规划策略",
      alternateByProject: "按项目交替",
      scheduleByProject: "按项目安排",
      alternateLongShort: "长短任务交替",
      random: "随机安排",
      previewPlan: "预览 X 个安排",
      backToToday: "回到今天",
      allDay: "全天",
      timeAdjusted: "已调整时间",
      addedToTimeline: "已添加到时间轴",
      taskAdded: "已添加任务",
      dragHere: "拖任务到这里安排时间",
      switchView: "切换时间视图",
    },
    en: {
      prevSegment: "Previous",
      nextSegment: "Next",
      aiPlanToday: "AI Plan Today",
      aiPlanningSettings: "AI Plan Settings",
      analyzing: "Analyzing...",
      adopting: "Adopting...",
      regenerate: "Regenerate",
      planningSuggestion: "Plan Suggestions",
      adoptAll: "Adopt All",
      cancelPreview: "Cancel All Previews",
      source: "Task Source",
      fromCandidates: "Today's Candidates",
      allUnfinished: "All Unfinished",
      scope: "Scheduling Range",
      strategy: "Strategy",
      alternateByProject: "Alternate by Project",
      scheduleByProject: "Schedule by Project",
      alternateLongShort: "Alternate Long/Short",
      random: "Random",
      previewPlan: "Preview X plans",
      backToToday: "Back to Today",
      allDay: "All Day",
      timeAdjusted: "Time Adjusted",
      addedToTimeline: "Added to Timeline",
      taskAdded: "Task Added",
      dragHere: "Drag tasks here to schedule",
      switchView: "Switch Time View",
    },
  },

  // ── TaskCard ────────────────────────────
  taskCard: {
    zh: {
      dragHint: "拖到时间轴进行安排",
      recurringHint: "重复任务请点开详情调整安排",
      markIncomplete: "标记未完成",
      markComplete: "标记完成",
      recurring: "重复",
      adjustDuration: "修改时长",
      openScheduling: "打开时间安排",
      expandMore: "更多",
      collapseMore: "收起更多",
      expectedAt: "预计放到 ...",
      autoFocused: "已自动对焦到时间轴",
      addToQueue: "加入安排队列",
      cancel: "取消",
      unassigned: "# 未归属",
      notes: "备注",
      editNotes: "编辑备注",
      cancelEdit: "取消编辑",
      noNotes: "暂无备注",
      addNotePlaceholder: "添加备注...",
      saveNote: "保存备注",
      project: "归属",
      delete: "删除",
      duplicate: "重复",
    },
    en: {
      dragHint: "Drag to timeline to schedule",
      recurringHint: "Recurring task — open details to adjust",
      markIncomplete: "Mark Incomplete",
      markComplete: "Mark Complete",
      recurring: "Recurring",
      adjustDuration: "Adjust Duration",
      openScheduling: "Open Scheduling",
      expandMore: "More",
      collapseMore: "Less",
      expectedAt: "Expected at ...",
      autoFocused: "Auto-focused on timeline",
      addToQueue: "Add to Queue",
      cancel: "Cancel",
      unassigned: "# Unassigned",
      notes: "Notes",
      editNotes: "Edit Notes",
      cancelEdit: "Cancel",
      noNotes: "No notes yet",
      addNotePlaceholder: "Add a note...",
      saveNote: "Save",
      project: "Project",
      delete: "Delete",
      duplicate: "Duplicate",
    },
  },

  // ── TimeBlock ───────────────────────────
  timeBlock: {
    zh: {
      returnedHint: "已回到规划，可重新安排",
      recurringHint: "重复任务请通过编辑调整时间",
      pending: "待确认",
      adjustStart: "调整开始时间",
      adjustEnd: "调整结束时间",
      markIncomplete: "标记未完成",
      markComplete: "标记完成",
      adopt: "采纳",
      cancel: "取消",
      nextStep: "下一步",
      unassigned: "# 未归属",
      newProjectPlaceholder: "新项目名",
      newProjectColor: "新项目颜色",
    },
    en: {
      returnedHint: "Returned to planning — reschedule",
      recurringHint: "Recurring task — adjust via edit",
      pending: "Needs Review",
      adjustStart: "Adjust Start Time",
      adjustEnd: "Adjust End Time",
      markIncomplete: "Mark Incomplete",
      markComplete: "Mark Complete",
      adopt: "Adopt",
      cancel: "Cancel",
      nextStep: "Next",
      unassigned: "# Unassigned",
      newProjectPlaceholder: "New Project Name",
      newProjectColor: "New Project Color",
    },
  },

  // ── EditDrawer — Detail View (TrevorAI-style) ──
  drawer: {
    zh: {
      todayUnscheduled: "今天 · 未安排具体时间",
      unscheduled: "未安排",
      completed: "已完成",
      unfinishedReturned: "未完成 · 已回到候选",
      scheduledOnTimeline: "已安排到时间轴",
      candidateStatus: "今日候选",
      titlePlaceholder: "未命名任务",
      complete: "完成",
      unfinished: "未完成",
      remove: "移除",
      quickReschedule: "快速改期",
      cancelSchedule: "取消安排",
      setRepeat: "设置重复",
      duplicate: "复制",
      assignProject: "归属项目",
      unassigned: "# 未归属",
      newProjectPlaceholder: "新项目名",
      duration: "任务时长",
      startDate: "开始日期",
      startTime: "开始时间",
      frequency: "频率",
      subtasks: "子任务",
      addSubtask: "添加",
      noSubtasks: "暂无子任务",
      notes: "备注",
      cancel: "取消",
      edit: "编辑",
      addNotePlaceholder: "添加备注...",
      save: "保存",
      noNotes: "暂无备注",
    },
    en: {
      todayUnscheduled: "Today · No specific time",
      unscheduled: "Unscheduled",
      completed: "Completed",
      unfinishedReturned: "Unfinished · Returned to Candidates",
      scheduledOnTimeline: "Scheduled on Timeline",
      candidateStatus: "Today's Candidate",
      titlePlaceholder: "Untitled Task",
      complete: "Complete",
      unfinished: "Unfinished",
      remove: "Remove",
      quickReschedule: "Quick Reschedule",
      cancelSchedule: "Unschedule",
      setRepeat: "Set Repeat",
      duplicate: "Duplicate",
      assignProject: "Assign Project",
      unassigned: "# Unassigned",
      newProjectPlaceholder: "New Project Name",
      duration: "Duration",
      startDate: "Start Date",
      startTime: "Start Time",
      frequency: "Frequency",
      subtasks: "Subtasks",
      addSubtask: "Add",
      noSubtasks: "No subtasks yet",
      notes: "Notes",
      cancel: "Cancel",
      edit: "Edit",
      addNotePlaceholder: "Add a note...",
      save: "Save",
      noNotes: "No notes yet",
    },
  },

  // ── EditDrawer — New/Edit Form (Compact) ──
  form: {
    zh: {
      edit: "编辑",
      add: "添加",
      close: "关闭",
      task: "任务",
      project: "项目",
      event: "事件",
      completed: "已完成",
      name: "名称",
      projectLabel: "项目",
      date: "日期",
      unassigned: "# 未归属",
      newProjectPlaceholder: "新项目名",
      projectNotes: "项目说明",
      color: "颜色",
      startDate: "开始日期",
      startTime: "开始时间",
      endDate: "结束日期",
      endTime: "结束时间",
      collapseAdvanced: "收起高级",
      expandAdvanced: "展开高级",
      estimatedTime: "预计用时",
      notes: "备注",
      delete: "删除",
      clarifyNext: "明确下一步",
      saveChanges: "保存修改",
    },
    en: {
      edit: "Edit",
      add: "Add",
      close: "Close",
      task: "Task",
      project: "Project",
      event: "Event",
      completed: "Completed",
      name: "Name",
      projectLabel: "Project",
      date: "Date",
      unassigned: "# Unassigned",
      newProjectPlaceholder: "New Project Name",
      projectNotes: "Project Notes",
      color: "Color",
      startDate: "Start Date",
      startTime: "Start Time",
      endDate: "End Date",
      endTime: "End Time",
      collapseAdvanced: "Hide Advanced",
      expandAdvanced: "Show Advanced",
      estimatedTime: "Est. Time",
      notes: "Notes",
      delete: "Delete",
      clarifyNext: "Clarify Next Step",
      saveChanges: "Save Changes",
    },
  },

  // ── Settings / Utility Panel ────────────
  settings: {
    zh: {
      settings: "设置",
      aboutNavo: "关于 NavoPath",
      close: "关闭",
      usernamePlaceholder: "用户名",
      freePlan: "免费版",
      uiMode: "界面模式",
      dark: "深色",
      light: "浅色",
      executeAccent: "执行页主色",
      planningAccent: "规划页主色",
      defaultView: "默认视图",
      hideCompleted: "隐藏已完成任务",
      allowAiContext: "允许 AI 使用任务上下文",
      hideAllAi: "隐藏所有 AI 功能",
      language: "语言",
      account: "当前账号",
      about: "关于NavoPath",
      logout: "退出登录",
      version: "NavoPath v0.4.1",
      aboutDesc: "从长期项目里选出今天要推进的事，排进时间轴，并明确下一步怎么做。",
      lastUpdated: "最新版本时间：2026-06-05",
    },
    en: {
      settings: "Settings",
      aboutNavo: "About NavoPath",
      close: "Close",
      usernamePlaceholder: "Display Name",
      freePlan: "Free Plan",
      uiMode: "Interface Mode",
      dark: "Dark",
      light: "Light",
      executeAccent: "Execute Accent",
      planningAccent: "Planning Accent",
      defaultView: "Default View",
      hideCompleted: "Hide Completed Tasks",
      allowAiContext: "Allow AI to Use Task Context",
      hideAllAi: "Hide All AI Features",
      language: "Language",
      account: "Account",
      about: "About NavoPath",
      logout: "Log Out",
      version: "NavoPath v0.4.1",
      aboutDesc: "Pick what moves today forward from long-term projects, schedule on a timeline, and clarify your next steps.",
      lastUpdated: "Last updated: 2026-06-05",
    },
  },

  // ── AI Panel ────────────────────────────
  aiPanel: {
    zh: {
      close: "关闭",
      thinkPlaceholder: "例如：今天晚上设计火箭模型 #准备ESAT",
      thinking: "思考中",
      send: "发送",
      createScheduled: "Create scheduled tasks",
      adopt: "采纳",
      cancel: "取消",
      adopted: "已采纳",
    },
    en: {
      close: "Close",
      thinkPlaceholder: "e.g. Design rocket model tonight #ESAT Prep",
      thinking: "Thinking...",
      send: "Send",
      createScheduled: "Create scheduled tasks",
      adopt: "Adopt",
      cancel: "Cancel",
      adopted: "Adopted",
    },
  },

  // ── FAB ─────────────────────────────────
  fab: {
    zh: { add: "添加", askNavo: "问Navo" },
    en: { add: "Add", askNavo: "Ask Navo" },
  },

  // ── Toast Notifications ─────────────────
  toast: {
    zh: {
      addedToToday: "已加入今日执行",
      addedToWeek: "已加入本周计划",
      addedToCandidates: "已加入今日候选",
      projectCreated: "已创建项目",
      projectSelected: "已选择已有项目",
      createdAndAssigned: "已创建并归属项目",
      assignedToProject: "已归属到已有项目",
      newTaskName: "新任务名称",
      addedToProject: "已添加到项目",
      addedToAllDay: "已添加到全天任务",
      addedToTimeline: "已添加到时间轴",
      allDayTaskAdded: "已添加全天任务",
      setToAllDay: "已设为全天任务",
      draggedBackToCandidates: "松开放回今日候选",
      noSlotFound: "没有找到可放置的空档",
      cancelledPlan: "已取消本次安排",
      oneTimeCandidateCreated: "已生成一次性候选任务",
      futureRecurringCleared: "已清空未来重复安排",
      clearedSchedule: "已清除安排",
      putBackToPlanning: "已放回规划",
      movedBackToCandidates: "已移回今日候选",
      durationAdjusted: "已调整时长",
      taskDuplicated: "已复制任务",
      clarifyTask: "请帮我明确「%TITLE%」的下一步行动。",
      analyzingRequest: "正在分析你的请求...",
      planGenerated: "已生成安排",
      networkError: "网络异常，请稍后重试。",
      requestFailed: "请求失败",
      created: "已创建「%TITLE%」",
      undo: "撤回",
      adopted: "已采纳",
      scheduledToDate: "已安排任务到 %DATE%",
      noTaskToSchedule: "没有可安排的任务。",
      noCandidateYet: "今天还没有候选任务。请先从规划中选择任务，或快速添加一个任务。",
      noContinuousSlot: "没有连续空档可安排 %COUNT% 个任务",
      adoptedOne: "已采纳 1 个安排",
      adoptedMany: "已采纳 %COUNT% 个安排",
      undone: "已撤回",
      clarifyPrompt: "帮我明确这个任务的下一步具体行动",
      clarifyHint: "先打开相关材料，完成 %TITLE% 的最小可检查版本。",
      clarifyHintGeneric: "先打开相关材料，完成的最小可检查版本。",
      loading: "NavoPath 加载中...",
    },
    en: {
      addedToToday: "Added to Today's Execution",
      addedToWeek: "Added to This Week's Plan",
      addedToCandidates: "Added to Today's Candidates",
      projectCreated: "Project Created",
      projectSelected: "Existing Project Selected",
      createdAndAssigned: "Created and Assigned to Project",
      assignedToProject: "Assigned to Existing Project",
      newTaskName: "New Task Name",
      addedToProject: "Added to Project",
      addedToAllDay: "Added to All-Day Tasks",
      addedToTimeline: "Added to Timeline",
      allDayTaskAdded: "All-Day Task Added",
      setToAllDay: "Set to All-Day",
      draggedBackToCandidates: "Returned to Candidates",
      noSlotFound: "No available time slot found",
      cancelledPlan: "Plan Cancelled",
      oneTimeCandidateCreated: "One-Time Candidate Created",
      futureRecurringCleared: "Future Recurring Tasks Cleared",
      clearedSchedule: "Schedule Cleared",
      putBackToPlanning: "Returned to Planning",
      movedBackToCandidates: "Moved Back to Candidates",
      durationAdjusted: "Duration Adjusted",
      taskDuplicated: "Task Duplicated",
      clarifyTask: "Help me clarify the next action for \"%TITLE%\".",
      analyzingRequest: "Analyzing your request...",
      planGenerated: "Plan Generated",
      networkError: "Network error, please try again later.",
      requestFailed: "Request Failed",
      created: "Created \"%TITLE%\"",
      undo: "Undo",
      adopted: "Adopted",
      scheduledToDate: "Scheduled task to %DATE%",
      noTaskToSchedule: "No tasks to schedule.",
      noCandidateYet: "No candidate tasks for today. Pick tasks from Planning first, or quickly add a task.",
      noContinuousSlot: "No continuous slot available for %COUNT% tasks",
      adoptedOne: "Adopted 1 plan",
      adoptedMany: "Adopted %COUNT% plans",
      undone: "Undone",
      clarifyPrompt: "Help me clarify the next concrete action for this task",
      clarifyHint: "Open the relevant materials and complete the minimum checkable version of %TITLE%.",
      clarifyHintGeneric: "Open the relevant materials and complete the minimum checkable version.",
      loading: "Loading NavoPath...",
    },
  },

  // ── SourceModal ─────────────────────────
  sourceModal: {
    zh: {
      selectTodayTasks: "选择今天要推进的任务",
      close: "关闭",
      hideAdded: "隐藏已添加",
      showAdded: "显示已添加",
      addSelected: "添加选中项",
      allProjects: "全部项目",
      unassigned: "未归属",
      overdue: "逾期任务",
      thisWeek: "本周任务",
      browseByProject: "按项目浏览",
      noUnfinished: "这个项目下还没有未完成的任务",
      added: "已添加",
      noNotes: "暂无备注",
    },
    en: {
      selectTodayTasks: "Select Tasks for Today",
      close: "Close",
      hideAdded: "Hide Added",
      showAdded: "Show Added",
      addSelected: "Add Selected",
      allProjects: "All Projects",
      unassigned: "Unassigned",
      overdue: "Overdue",
      thisWeek: "This Week",
      browseByProject: "Browse by Project",
      noUnfinished: "No unfinished tasks in this project",
      added: "Added",
      noNotes: "No notes",
    },
  },

  // ── Planning View ───────────────────────
  planning: {
    zh: {
      markIncomplete: "标记未完成",
      markComplete: "标记完成",
      moveToPlanning: "移到规划",
      more: "更多",
      editName: "编辑名称",
      setDate: "设置日期",
      moveToProject: "移动到项目",
      delete: "删除",
      expandSubtasks: "展开子任务",
      collapseSubtasks: "折叠子任务",
      addToCandidate: "加入候选",
      addTask: "添加任务",
      addSubtask: "添加子任务",
      expandProject: "展开项目",
      collapseProject: "折叠项目",
      unassigned: "未归属",
      selectingTasks: "正在从规划中选择任务",
      selectInstruction: "点击任务旁的 → 加入候选框，确认后加入执行列表。",
      exit: "退出",
      unassignedTasks: "未归属任务",
      candidateTasks: "候选任务",
      countItems: " X 项",
      selectPrompt: "从左侧选择几个今天想做的任务",
      none: "暂无",
      remove: "移除",
      addToToday: "加入今日执行",
      addToWeek: "加入本周计划",
      clearCandidates: "清空候选",
      showAdded: "显示已添加",
    },
    en: {
      markIncomplete: "Mark Incomplete",
      markComplete: "Mark Complete",
      moveToPlanning: "Move to Planning",
      more: "More",
      editName: "Edit Name",
      setDate: "Set Date",
      moveToProject: "Move to Project",
      delete: "Delete",
      expandSubtasks: "Expand Subtasks",
      collapseSubtasks: "Collapse Subtasks",
      addToCandidate: "Add to Candidate",
      addTask: "Add Task",
      addSubtask: "Add Subtask",
      expandProject: "Expand Project",
      collapseProject: "Collapse Project",
      unassigned: "Unassigned",
      selectingTasks: "Selecting Tasks from Planning",
      selectInstruction: "Click → next to a task to add it to the candidate box, then confirm to add to execution list.",
      exit: "Exit",
      unassignedTasks: "Unassigned Tasks",
      candidateTasks: "Candidate Tasks",
      countItems: " item(s)",
      selectPrompt: "Pick a few tasks you want to work on today from the left",
      none: "None",
      remove: "Remove",
      addToToday: "Add to Today's Execution",
      addToWeek: "Add to Weekly Plan",
      clearCandidates: "Clear Candidates",
      showAdded: "Show Added",
    },
  },

  // ── API / AI Error Messages ─────────────
  apiErrors: {
    zh: {
      tooManyRequests: "请求过于频繁，请在 X 秒后重试。",
      wrongCredentials: "邮箱或密码不正确。",
      emailNotConfirmed: "邮箱还没有完成确认，请先打开确认邮件中的链接。",
      emailAlreadyRegistered: "这个邮箱已经注册过，请直接登录。",
      weakPassword: "密码强度不够，请至少使用 6 位字符。",
      tooFrequent: "请求过于频繁，请稍后再试。",
      accountFailed: "账号请求失败，请稍后再试。",
      pleaseLogin: "请先登录 NavoPath。",
      registerSuccess: "注册成功。请检查邮箱完成确认后再登录。",
      emailResent: "确认邮件已重新发送。",
      noAiKeyPublic: "公开网页版暂不保存个人 AI API Key。你仍然可以使用本地版的 AI 设置，或后续接入服务端安全代理。",
      aiNotConfigured: "AI 服务未配置，请在设置中连接 Supabase。",
      connectAi: "连接 AI 服务",
      aiKeyNotSet: "AI 服务未配置 API Key，请联系管理员。",
      verifyApiKey: "验证 API Key",
      aiNotDeployed: "AI 服务未部署，请在 Supabase 部署 ai-assistant 函数。",
      aiRequestFailed: "AI 请求失败，请稍后重试。",
      requestAi: "请求 AI 服务",
      aiResponseMalformed: "AI 返回格式异常，请重试。",
      parseAiResponse: "解析 AI 响应",
      aiReply: "AI 回复",
      done: "完成",
      networkError: "网络异常，请检查连接后重试。",
      networkConnection: "网络连接",
      configureDeepSeek: "请先在本地预览设置里配置 DeepSeek API Key。",
    },
    en: {
      tooManyRequests: "Too many requests. Please try again in X seconds.",
      wrongCredentials: "Incorrect email or password.",
      emailNotConfirmed: "Email not confirmed. Open the confirmation link in your inbox first.",
      emailAlreadyRegistered: "This email is already registered. Sign in instead.",
      weakPassword: "Password too weak. Use at least 6 characters.",
      tooFrequent: "Too many requests. Please try again later.",
      accountFailed: "Account request failed. Please try again later.",
      pleaseLogin: "Please sign in to NavoPath first.",
      registerSuccess: "Registration successful. Check your email to confirm, then sign in.",
      emailResent: "Confirmation email resent.",
      noAiKeyPublic: "Personal AI API Keys are not stored in the public web app. Use the local app AI settings or connect a server-side proxy.",
      aiNotConfigured: "AI service not configured. Connect Supabase in settings.",
      connectAi: "Connect AI Service",
      aiKeyNotSet: "AI service API Key not set. Contact the administrator.",
      verifyApiKey: "Verify API Key",
      aiNotDeployed: "AI service not deployed. Deploy the ai-assistant function in Supabase.",
      aiRequestFailed: "AI request failed. Please try again later.",
      requestAi: "Request AI Service",
      aiResponseMalformed: "AI response format error. Please try again.",
      parseAiResponse: "Parse AI Response",
      aiReply: "AI Reply",
      done: "Done",
      networkError: "Network error. Please check your connection and try again.",
      networkConnection: "Network Connection",
      configureDeepSeek: "Please configure your DeepSeek API Key in local preview settings first.",
    },
  },

  // ── Auto Schedule ───────────────────────
  autoSchedule: {
    zh: {
      missingDuration: "个任务缺少时长，已用默认值",
      priorityFirst: "优先安排",
      todayDeadline: "今日截止",
      autoSchedule: "自动安排",
      noSlot: "没有 X 分钟连续空档",
    },
    en: {
      missingDuration: " tasks missing duration, using default",
      priorityFirst: "Priority First",
      todayDeadline: "Due Today",
      autoSchedule: "Auto Schedule",
      noSlot: "No X-min continuous slot available",
    },
  },

  // ── Seed / Preview Data ─────────────────
  seed: {
    zh: {
      appMaterials: "申请材料冲刺",
      appProjectNotes: "本地预览项目，用于验证状态切换和项目属性修改流程。",
      siteLaunch: "网站上线推进",
      esatMistakes: "整理 ESAT 题型错因",
      candidateHint: "候选任务示例。点击安排只应展开时间面板，不应自动创建时间轴记录。",
      portfolioCopy: "更新作品集首页文案",
      mentorRecommendation: "给导师确认推荐信节奏",
      moreOpenHint: "候选卡 more-open 应只保留备注输出区，不直接铺开表单。",
      weeklyReview: "每周申请复盘",
      recurringHint: "这是 recurring timed block，用来验证重复任务在时间轴的视觉区分。",
      demoRehearsal: "产品演示彩排",
      scheduledHint: "普通 scheduled task，应保持现有非 recurring 样式。",
      lastNightReading: "昨晚未完成的阅读任务",
      returnedHint: "returned_unfinished 不应命中 recurring block 视觉。",
      previewEnabled: "预览模式已启用。用 ?preview=local 强制走本地 seed 数据。",
      aiSystemPrompt: "你是 NavoPath 助手...",
    },
    en: {
      appMaterials: "Application Materials Sprint",
      appProjectNotes: "Local preview project for verifying state transitions and project property editing.",
      siteLaunch: "Website Launch Progress",
      esatMistakes: "Organize ESAT Question Mistakes",
      candidateHint: "Sample candidate task. Clicking 'schedule' should only expand the time panel, not auto-create a timeline record.",
      portfolioCopy: "Update Portfolio Homepage Copy",
      mentorRecommendation: "Confirm Recommendation Letter Timeline with Mentor",
      moreOpenHint: "Candidate card more-open should only show the notes area, not expand a full form.",
      weeklyReview: "Weekly Application Review",
      recurringHint: "Recurring timed block to verify visual distinction of recurring tasks on the timeline.",
      demoRehearsal: "Product Demo Rehearsal",
      scheduledHint: "Regular scheduled task — should keep existing non-recurring styling.",
      lastNightReading: "Unfinished Reading from Last Night",
      returnedHint: "returned_unfinished should not trigger recurring block visuals.",
      previewEnabled: "Preview mode enabled. Use ?preview=local to force local seed data.",
      aiSystemPrompt: "You are the NavoPath assistant...",
    },
  },

  // ── Release Notes (static) ──────────────
  releaseNotes: [
    {
      zh: "优化了规划栏的交互和结果展示",
      en: "Optimized planning sidebar interaction and result display",
    },
    {
      zh: "优化了时间轴的快速添加栏",
      en: "Optimized timeline quick-add bar",
    },
    {
      zh: "优化了部分深色模式UI不适配的问题",
      en: "Fixed dark mode UI compatibility issues",
    },
    {
      zh: "优化了 3天 / 周 / 月视图和'全天'栏的体验，并支持任务堆叠",
      en: "Optimized 3-day / week / month views and all-day lane with task stacking",
    },
    {
      zh: "在一定程度上优化了深色模式的体验",
      en: "Improved dark mode experience across the app",
    },
    {
      zh: "优化了网站主页面，并且加入了深色模式(beta)",
      en: "Revamped landing page with dark mode (beta)",
    },
    {
      zh: "加入 3天 / 周 / 月视图。UI支持自定义颜色",
      en: "Added 3-day / week / month views. Customizable UI colors",
    },
    {
      zh: "规划树支持候选挑选模式，任务可从长期项目流入今日执行。",
      en: "Planning tree now supports candidate picking. Tasks flow from long-term projects to daily execution.",
    },
    {
      zh: "网页版上线",
      en: "Web version launched",
    },
  ],
} as const;

// ── Convenience Accessor ──────────────────

/**
 * Main translation function.
 * Usage: t(lang, "header.execute") or t(lang, "toast.addedToToday")
 *
 * Path uses dot notation: "section.key" or "section.sub.key"
 * For nested objects like priorities/categories, returns the array directly.
 */
export function t(lang: Language, path: string): string {
  const keys = path.split(".");
  let node: any = TR;

  for (let i = 0; i < keys.length; i++) {
    if (node === undefined || node === null) return path;

    // If the current node has language keys (zh / en), step into the lang layer first
    if (_isLangLayer(node)) {
      node = node[lang];
      if (node === undefined || node === null) return path;
    }

    node = node[keys[i]];
  }

  // After consuming all path keys, if the final node is a lang layer, unwrap it
  if (_isLangLayer(node)) {
    const leaf = node[lang];
    if (typeof leaf === "string") return leaf;
    return path; // not a translatable string leaf
  }

  if (typeof node === "string") return node;
  return path;
}

function _isLangLayer(obj: any): boolean {
  return typeof obj === "object" && obj !== null && "zh" in obj && "en" in obj;
}

/** Get category label array for the given language. */
export function catLabels(lang: Language): string[] {
  return [...TR.categories[lang]];
}

/** Get priority label array for the given language. */
export function priLabels(lang: Language): string[] {
  return [...TR.priorities[lang]];
}

/** Get view mode label for the given language. */
export function viewLabel(lang: Language, key: "daily" | "3day" | "weekly" | "month"): string {
  return TR.views[lang][key];
}

/** Get release notes for the given language and index. */
export function releaseNote(lang: Language, index: number): string {
  if (index < 0 || index >= TR.releaseNotes.length) return "";
  return TR.releaseNotes[index][lang];
}
