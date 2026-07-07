const { app, BrowserWindow, ipcMain, safeStorage, dialog, shell, Tray, Menu, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
let _crypto; // lazy: only when uid() is first called
function getCrypto() { if (!_crypto) _crypto = require("node:crypto"); return _crypto; }

// Lazy-loaded: electron-updater is not needed until autoUpdater is configured
let _autoUpdaterModule;
let _autoUpdater;
function getAutoUpdaterModule() {
  if (!_autoUpdaterModule) _autoUpdaterModule = require("electron-updater");
  return _autoUpdaterModule;
}
function getAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  const updaterModule = getAutoUpdaterModule();
  const resolvedUpdater = updaterModule?.autoUpdater
    ?? updaterModule?.default?.autoUpdater
    ?? updaterModule?.default
    ?? updaterModule;
  if (!resolvedUpdater || typeof resolvedUpdater.on !== "function") {
    throw new TypeError("electron-updater autoUpdater instance is unavailable");
  }
  _autoUpdater = resolvedUpdater;
  return _autoUpdater;
}

app.setName("NavoPath");

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let manualUpdateRequested = false;
let updateState = {
  status: app.isPackaged ? "idle" : "unsupported",
  currentVersion: app.getVersion(),
  availableVersion: "",
  progress: 0,
  message: app.isPackaged ? "" : "Update checks are available in the installed desktop app."
};

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() };
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("updater:state", updateState);
  return updateState;
}

async function checkForDesktopUpdate(manual = false) {
  const autoUpdater = getAutoUpdater();
  if (!app.isPackaged) return publishUpdateState({ status: "unsupported" });
  if (["checking", "downloading"].includes(updateState.status)) return updateState;
  if (manual && updateState.status === "available") {
    manualUpdateRequested = false;
    publishUpdateState({ status: "downloading", progress: 0 });
    await autoUpdater.downloadUpdate();
    return updateState;
  }
  manualUpdateRequested = manual;
  publishUpdateState({ status: "checking", progress: 0, message: "" });
  await autoUpdater.checkForUpdates();
  return updateState;
}

function configureAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", async (info) => {
    publishUpdateState({ status: "available", availableVersion: info.version, progress: 0 });
    if (!manualUpdateRequested) return;
    manualUpdateRequested = false;
    publishUpdateState({ status: "downloading", progress: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });
  autoUpdater.on("update-not-available", () => {
    manualUpdateRequested = false;
    publishUpdateState({ status: "current", availableVersion: "", progress: 0 });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState({ status: "downloading", progress: Math.round(progress.percent || 0) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState({ status: "downloaded", availableVersion: info.version, progress: 100 });
  });
  autoUpdater.on("error", (error) => {
    manualUpdateRequested = false;
    publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
  });

  if (!app.isPackaged) return;
  const initialTimer = setTimeout(() => void checkForDesktopUpdate(false).catch((error) => publishUpdateState({ status: "error", message: String(error) })), 30_000);
  const interval = setInterval(() => void checkForDesktopUpdate(false).catch((error) => publishUpdateState({ status: "error", message: String(error) })), UPDATE_INTERVAL_MS);
  initialTimer.unref?.();
  interval.unref?.();
}

function todayIso() {
  return localDateIso(new Date());
}

function localDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${getCrypto().randomBytes(3).toString("hex")}`;
}

function makeTask(title, dueDate, category, priority = "medium", notes = "", goalId = "goal_admission") {
  return {
    id: uid("task"),
    title,
    dueDate,
    category,
    priority,
    notes,
    goalId,
    completed: false,
    workflowStatus: "backlog",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function inferWorkflowStatus(task) {
  if (task.completed) return "done";
  if (["backlog", "next", "doing", "waiting", "done"].includes(task.workflowStatus)) return task.workflowStatus;
  if ((task.timelineRecords || []).some((record) => record.executionStatus === "scheduled")) return "doing";
  if (task.plannedForDate) return "next";
  return "backlog";
}

function minutesBetween(startAt, endAt) {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

function normalizeTimeEntry(entry, tasks) {
  if (!entry || !entry.id || !entry.taskId) return null;
  const task = tasks.find((item) => item.id === entry.taskId);
  const durationMinutes = Number.isFinite(entry.durationMinutes) && entry.durationMinutes > 0
    ? Math.round(entry.durationMinutes)
    : minutesBetween(entry.startAt, entry.endAt);
  if (durationMinutes <= 0) return null;
  const now = new Date().toISOString();
  return {
    ...entry,
    projectId: entry.projectId || task?.projectId,
    durationMinutes,
    source: entry.source || "timer",
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now
  };
}

function makeEvent(title, date, category, details = "") {
  return {
    id: uid("event"),
    title,
    date,
    category,
    details,
    imported: true,
    createdAt: new Date().toISOString()
  };
}

let _smartNoteTemplates = null;
function getSmartNoteTemplates() {
  if (!_smartNoteTemplates) {
    _smartNoteTemplates = Object.freeze({
  "确认英国 UCAS 工程专业组合": "目标：在 2026-06-15 前锁定 5 个 UCAS 志愿的专业名称、课程代码和替代顺序，避免后续 PS 与考试准备方向反复摇摆。\n衡量：产出 1 张对比表，至少包含剑桥、Imperial、UCL、KCL 与 1 个替代工程项目；每个项目写清入学要求、ESAT/TARA 要求、核心课程匹配度和风险等级。\n行动：逐校打开官网课程页，核对 2027 Entry 要求；把不确定项标红；最后按“冲刺、匹配、保底”给出排序。\n资料：UCAS Search、各大学 Engineering/Robotics/AI/Mechanical/Aerospace 官网页面、升学指导报告。\n完成标准：对比表没有空项，并能用 3 句话解释为什么这 5 个专业组合适合工程/机器人/航空航天方向。",
  "启动 ESAT/TARA 训练计划": "目标：在 2026-06-20 前建立 ESAT Maths 1、Maths 2、Physics 和 TARA 的固定训练系统。\n衡量：建好 1 个错题表、1 个分数记录表和 1 个每周训练表；每个科目至少完成 1 次基线测试或样题训练。\n行动：下载官方样题和 guide；按 40 分钟限时做 ESAT module；TARA 单独整理题型、时间限制和弱点；每次训练后记录错误原因。\n资料：UAT ESAT 页面 https://esat-tmua.ac.uk/about-the-tests/esat-test/；UAT 备考材料 https://esat-tmua.ac.uk/esat-preparation-materials/；Pearson UAT 页面 https://www.pearsonvue.com/us/en/uatuk.html。\n完成标准：打开任务文件夹时能看到资料库、错题表、分数表和下一周训练安排，不需要临时找材料。",
  "整理项目证据文件夹": "目标：在 2026-06-25 前把 ISSDC、3D 打印、论文、火箭、TI-BASIC 等项目整理成可用于文书、活动表和推荐信的证据库。\n衡量：每个项目至少有 1 个项目简介、2-5 张图片/截图、关键成果数据、本人贡献说明和可引用链接或文件。\n行动：按项目建文件夹；把原始文件、照片、代码、论文、证书放入对应目录；写 100-150 字英文项目摘要；标注最能体现工程能力的证据。\n资料：电脑本地项目文件、照片、证书、论文稿、GitHub/网盘链接、升学指导报告。\n完成标准：任意打开一个项目文件夹，都能直接找到“我做了什么、结果是什么、能证明什么”的材料。",
  "完成 Common App 活动表初稿": "目标：在 2026-07-20 前完成 Common App 10 项活动的英文初稿，形成早申可继续打磨的版本。\n衡量：10 项活动按影响力排序；每项包含职位/组织、时间投入、英文 150 字符描述和对应证据。\n行动：先列全部活动，再按工程相关性、影响力、持续时间筛选；把动词改成具体贡献，如 designed、built、tested、led、published；删除泛泛描述。\n资料：Common App 活动栏格式、项目证据文件夹、竞赛/社团/研究记录。\n完成标准：活动表读起来能体现工程主线，并且每项都能被证据文件夹支持。",
  "英国 PS 第一版": "目标：在 2026-08-20 前完成英国 Personal Statement 第一版，主线聚焦工程思维和项目迭代能力。\n衡量：产出 1 篇完整英文 PS；覆盖学术兴趣、项目经历、数学/物理能力、工程反思和目标专业匹配；字数符合 UCAS 当前限制。\n行动：先写中文素材提纲，再转成英文段落；每段只保留一个核心论点；用项目证据支撑“建模-原型-测试-迭代”的主线。\n资料：UCAS PS 指南、目标专业课程页、项目证据文件夹、升学指导报告。\n完成标准：第一版不是素材堆砌，而是能清楚回答“为什么工程、为什么这些经历证明适合工程”。",
  "推荐信材料包发给老师": "目标：在 2026-08-25 前给推荐老师发送完整材料包，降低老师写信时信息不全的风险。\n衡量：材料包包含目标专业、申请学校、课程表现、项目贡献、希望强调的 3-5 个能力点、截止日期和联系方式。\n行动：整理 1 页 brag sheet；附成绩/课程表现亮点；列出最希望老师提到的具体课堂或项目例子；发出后确认老师收到。\n资料：成绩记录、课程作业、项目证据文件夹、申请学校清单。\n完成标准：老师不用再追问基础信息，就能基于材料写出具体推荐内容。",
  "ESAT/TARA 冲刺复盘": "目标：在 2026-09-20 前完成 ESAT/TARA 冲刺阶段复盘，明确最后三周的提分优先级。\n衡量：至少完成 2 套限时组合训练；统计 Maths 1、Maths 2、Physics 和 TARA 的正确率、耗时、错因 Top 5。\n行动：按考试时间限制做题；复盘时把错误分为知识漏洞、计算失误、读题误判、时间策略；为每类错误安排补救动作。\n资料：UAT/Pearson 官方样题、错题表、分数记录表、TARA 练习材料。\n完成标准：输出 1 页冲刺清单，写清每天练什么、为什么练、完成后如何检查。",
  "美国 ED/EA 文书定稿": "目标：在 2026-10-25 前完成美国 ED/EA 主文书、附文书和活动表最终检查。\n衡量：所有早申学校文书都有最终版；每篇完成拼写检查、学校匹配检查、事实核对和第三方反馈修改。\n行动：逐校建立提交清单；检查文书是否回答题目、是否有具体例子、是否重复活动表；最后统一核对 Common App 信息。\n资料：Common App、各校申请 portal、文书草稿、活动表、推荐信状态。\n完成标准：每所早申学校都达到“今天提交也不会遗漏材料”的状态。",
  "美国 RD 清单校准": "目标：在 2026-12-15 前根据 ED/EA 结果、预算和专业偏好校准 RD 学校清单。\n衡量：形成 1 份 RD 清单，按冲刺、匹配、保底分类；每校包含截止日期、补充文书数量、专业匹配、费用/奖学金信息。\n行动：先更新早申结果和家庭预算约束；删除明显不匹配学校；补入工程/机器人/AI 方向更强或风险更合理的选择。\n资料：Common App、College Board/学校官网费用页、专业课程页、早申结果。\n完成标准：RD 清单数量可执行，且每所学校都有明确申请理由。",
  "ESAT W1D1：建立资料库 + Maths 1 诊断": "目标：在 2026-06-01 完成 ESAT 资料库搭建，并拿到 Maths 1 第一次基线分数。\n衡量：完成 Pearson ESAT Mathematics 1 样题 40 分钟限时训练；记录总题数、正确数、空题数、超时题数和错因。\n行动：先保存 UAT、Pearson 资料链接；设置 40 分钟计时；做完立即把错题录入表格，标注知识点和错误原因。\n资料：UAT ESAT https://esat-tmua.ac.uk/about-the-tests/esat-test/；UAT 备考材料 https://esat-tmua.ac.uk/esat-preparation-materials/；Pearson https://www.pearsonvue.com/us/en/uatuk.html。\n完成标准：错题表里至少有题号、知识点、错误原因、正确思路和下次复习日期。",
  "ESAT W1D2：Maths 1 错题复盘 + 无计算器速度": "目标：在 2026-06-02 复盘 W1D1 Maths 1 错题，并提高无计算器短题速度。\n衡量：完成 W1D1 所有错题复盘；额外完成 20 道短题，每题控制在 90 秒内；记录正确率和超时数量。\n行动：先重做错题，不看答案写出正确解法；再做 20 道短题；把超过 90 秒或计算卡顿的题列入速度专项。\n资料：UAT Mathematics 1 guide https://esat-tmua.ac.uk/esat-preparation-materials/；YouTube ESAT Maths 1 walkthrough；TLMaths https://www.youtube.com/@TLMaths。\n完成标准：能说清 Maths 1 当前最弱的 3 个题型，以及下一次训练要优先补哪一个。",
  "ESAT W1D3：Maths 2 基线测试": "目标：在 2026-06-03 完成 Maths 2 第一次 40 分钟基线测试，找出高阶数学薄弱点。\n衡量：记录正确数、错误数、空题数和 Top 3 弱点；每个弱点至少对应 2 道具体题目。\n行动：按考试时限完成 Pearson Maths 2 sample/specimen；做完后先分类错因，再回看 guide 对应知识点。\n资料：Pearson UAT https://www.pearsonvue.com/us/en/uatuk.html；UAT Mathematics 2 guide https://esat-tmua.ac.uk/esat-preparation-materials/；YouTube Maths 2 walkthrough。\n完成标准：分数表和错题表已更新，并写出 Maths 2 下一周优先训练 topic。",
  "ESAT W1D4：Physics 基线测试": "目标：在 2026-06-04 完成 Physics 40 分钟基线测试，建立物理题干到公式/思路的映射表。\n衡量：记录正确率和错因；整理至少 5 条“题干信号 -> 公式/模型/解题入口”。\n行动：限时完成 Physics sample/specimen；复盘时不只写答案，而是写题目如何提示使用哪个模型。\n资料：Pearson UAT https://www.pearsonvue.com/us/en/uatuk.html；UAT Physics guide https://esat-tmua.ac.uk/esat-preparation-materials/；Physics Online https://www.youtube.com/@PhysicsOnline。\n完成标准：物理错题表至少覆盖公式选择、单位检查、图像/情境理解三类问题。",
  "ESAT W1D5：ENGAA/NSAA 风格入门 + 三科错题整理": "目标：在 2026-06-05 用 ENGAA/NSAA archive 补充 ESAT 相近题型，并整理本周三科弱点。\n衡量：完成 2022 或 2023 Section 1 中相关 Maths/Physics 题；整理 1-10 的弱点清单，按影响分排序。\n行动：选与 ESAT Maths/Physics 相近的题做限时练习；把本周 Maths 1、Maths 2、Physics 错题合并归类。\n资料：UAT ENGAA/NSAA archive https://esat-tmua.ac.uk/esat-preparation-materials/；ENGAA/NSAA walkthrough 搜索结果。\n完成标准：弱点清单每一项都有对应题号、错误原因和下一步练习方式。",
  "ESAT W1D6：两科连练 + 时间策略": "目标：在 2026-06-06 完成两个 ESAT module 连续限时训练，测试体力和时间策略。\n衡量：连续完成两个 40 分钟 module；记录每个 module 的正确率、跳题数量、flag 数量和最后 5 分钟处理情况。\n行动：模拟考试节奏，中间只短休息；训练 60-90 秒判断是否跳题；最后 5 分钟检查未答题并完成全填。\n资料：Pearson sample/specimen https://www.pearsonvue.com/us/en/uatuk.html；UAT 备考材料 https://esat-tmua.ac.uk/esat-preparation-materials/。\n完成标准：写出 3 条个人时间策略，例如哪些题先跳、何时回看、最后 5 分钟怎么分配。",
  "ESAT W1D7：周复盘 + 下周计划": "目标：在 2026-06-07 完成 ESAT 第一周复盘，并制定第二周训练重点。\n衡量：汇总 Maths 1、Maths 2、Physics 原始分；每科选出 2 个下周优先 topic；写 1 页周报。\n行动：看分数趋势和错因分类；不要只看正确率，要判断是知识问题、速度问题还是策略问题；把下周任务拆到每天。\n资料：Praneel Physics ESAT Hub https://praneelphysics.com/esat/hub；UAT 备考材料；YouTube ESAT Maths/Physics walkthrough。\n完成标准：周报包含本周数据、主要问题、下周每日安排和检查标准。"
    });
  }
  return _smartNoteTemplates;
}

function smartNoteForTask(task) {
  return task.notes || "";
}

const LEVELS = ["high", "medium", "low"];

function normalizeLevel(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  return LEVELS.includes(value) ? value : fallback;
}

function normalizeUrgencyLevel(value) {
  return normalizeLevel(value, "low") || "low";
}

function normalizeTimelineRecord(record) {
  return { ...record, scheduledEndDate: record.scheduledEndDate || record.scheduledDate };
}

function habitId(title) {
  return `habit-${String(title).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")}`;
}

function normalizeHabitsForClient(data) {
  if (Array.isArray(data.habits) && data.habits.length > 0) {
    return { habits: data.habits, habitDailyStates: Array.isArray(data.habitDailyStates) ? data.habitDailyStates : [] };
  }
  const raw = String(data.pluginConfigs?.["habit-tracker"]?.habits || "");
  const now = new Date().toISOString();
  const habits = raw.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title, index) => ({
      id: habitId(title),
      title,
      defaultDurationMinutes: 20,
      archived: false,
      order: index,
      createdAt: now,
      updatedAt: now
    }));
  return { habits, habitDailyStates: Array.isArray(data.habitDailyStates) ? data.habitDailyStates : [] };
}

function normalizePlannerData(data) {
  if (!data || !Array.isArray(data.tasks)) return data;
  const habitPatch = normalizeHabitsForClient(data);
  return {
    ...data,
    importedSeedVersion: data.importedSeedVersion === "admission-2027-v1" ? "admission-2027-v2-smart-notes" : data.importedSeedVersion,
    projects: Array.isArray(data.projects)
      ? data.projects.map((project) => ({
          ...project,
          color: project.color || "#C69CF9",
          importance: normalizeLevel(project.importance),
          urgency: normalizeLevel(project.urgency)
        }))
      : [],
    longTasks: Array.isArray(data.longTasks) ? data.longTasks : [],
    aiMemories: Array.isArray(data.aiMemories) ? data.aiMemories : [],
    scheduleTemplates: Array.isArray(data.scheduleTemplates) ? data.scheduleTemplates : [],
    drafts: Array.isArray(data.drafts)
      ? data.drafts
          .filter((draft) => draft && draft.title && !(typeof draft.details === "string" && draft.details.startsWith("[预设]")))
          .slice(-10)
      : [],
    events: Array.isArray(data.events)
      ? data.events.map((event) => ({
          ...event,
          date: event.date || event.startDate || todayIso(),
          startDate: event.startDate || event.date || todayIso(),
          endDate: event.endDate || event.startDate || event.date || todayIso(),
          startTime: event.startTime || "",
          endTime: event.endTime || ""
        }))
      : [],
    taskLayouts: data.taskLayouts && typeof data.taskLayouts === "object" ? data.taskLayouts : {},
    timeEntries: Array.isArray(data.timeEntries)
      ? data.timeEntries.map((entry) => normalizeTimeEntry(entry, data.tasks || [])).filter(Boolean)
      : [],
    habits: habitPatch.habits,
    habitDailyStates: habitPatch.habitDailyStates,
    tasks: data.tasks.map((task) => ({
      ...task,
      priority: normalizeLevel(task.priority),
      importance: normalizeLevel(task.importance),
      urgency: normalizeUrgencyLevel(task.urgency),
      completedAt: task.completed ? task.completedAt || task.updatedAt || task.dueDate || task.createdAt : undefined,
      workflowStatus: inferWorkflowStatus(task),
      timelineRecords: Array.isArray(task.timelineRecords) ? task.timelineRecords.map(normalizeTimelineRecord) : [],
      subtasks: (task.subtasks || []).map((subtask, index) => ({
        ...subtask,
        id: subtask.id || uid("sub"),
        title: subtask.title || "",
        completed: typeof subtask.completed === "boolean" ? subtask.completed : Boolean(subtask.done),
        done: typeof subtask.done === "boolean" ? subtask.done : Boolean(subtask.completed),
        order: typeof subtask.order === "number" ? subtask.order : index,
        createdAt: subtask.createdAt || new Date().toISOString()
      })),
      notes: smartNoteForTask(task)
    }))
  };
}

function findGuidanceReport() {
  const names = ["陈潇杨-2027Entry英美工程方向升学指导报告.docx"];
  const roots = [
    process.cwd(),
    path.join(process.cwd(), "outputs"),
    path.join(process.cwd(), "..", "outputs"),
    path.join(process.cwd(), "..", "..", "outputs"),
    path.join(app.getAppPath(), "..", "outputs"),
    path.join(app.getAppPath(), "..", "..", "outputs"),
    "D:\\233cxy\\OneDrive\\文档\\升学指导\\outputs"
  ];
  for (const root of roots) {
    for (const name of names) {
      const candidate = path.resolve(root, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}

function seedData() {
  const reportPath = findGuidanceReport();
  const tasks = [
    makeTask("确认英国 UCAS 工程专业组合", "2026-06-15", "uk", "high", "剑桥、Imperial、UCL、KCL 与替代工程项目。"),
    makeTask("启动 ESAT/TARA 训练计划", "2026-06-20", "exam", "high", "数学1、数学2、物理；单独准备 TARA。"),
    makeTask("整理项目证据文件夹", "2026-06-25", "materials", "high", "ISSDC、3D 打印、论文、火箭、TI-BASIC。"),
    makeTask("完成 Common App 活动表初稿", "2026-07-20", "us", "medium", "按活动影响力排序，准备英文描述。"),
    makeTask("英国 PS 第一版", "2026-08-20", "essay", "high", "围绕建模-原型-测试-迭代主线。"),
    makeTask("推荐信材料包发给老师", "2026-08-25", "materials", "high", "课程表现、项目贡献、目标专业、希望强调的能力。"),
    makeTask("ESAT/TARA 冲刺复盘", "2026-09-20", "exam", "high", "限时套题、错题归因、薄弱模块。"),
    makeTask("美国 ED/EA 文书定稿", "2026-10-25", "us", "high", "早申学校附文书和活动表检查。"),
    makeTask("美国 RD 清单校准", "2026-12-15", "us", "medium", "结合 ED/EA 结果、预算和专业偏好。"),
    makeTask("ESAT W1D1：建立资料库 + Maths 1 诊断", "2026-06-01", "exam", "high", "UAT 官方 ESAT 页面：https://esat-tmua.ac.uk/about-the-tests/esat-test/；UAT 备考材料：https://esat-tmua.ac.uk/esat-preparation-materials/；Pearson sample/specimen：https://www.pearsonvue.com/us/en/uatuk.html。任务：做 Pearson ESAT Mathematics 1，限时 40 分钟，建立错题表。"),
    makeTask("ESAT W1D2：Maths 1 错题复盘 + 无计算器速度", "2026-06-02", "exam", "high", "资料：UAT Mathematics 1 guide：https://esat-tmua.ac.uk/esat-preparation-materials/；YouTube：https://www.youtube.com/results?search_query=ESAT+Maths+1+walkthrough；TLMaths：https://www.youtube.com/@TLMaths。任务：复盘 W1D1 错题，做 20 道 90 秒内短题。"),
    makeTask("ESAT W1D3：Maths 2 基线测试", "2026-06-03", "exam", "high", "资料：Pearson ESAT Mathematics 2 sample/specimen：https://www.pearsonvue.com/us/en/uatuk.html；UAT Mathematics 2 guide：https://esat-tmua.ac.uk/esat-preparation-materials/；YouTube：https://www.youtube.com/results?search_query=ESAT+Maths+2+walkthrough。任务：限时 40 分钟做 Maths 2，整理 Top 3 弱点。"),
    makeTask("ESAT W1D4：Physics 基线测试", "2026-06-04", "exam", "high", "资料：Pearson ESAT Physics sample/specimen：https://www.pearsonvue.com/us/en/uatuk.html；UAT Physics guide：https://esat-tmua.ac.uk/esat-preparation-materials/；Physics Online：https://www.youtube.com/@PhysicsOnline；YouTube：https://www.youtube.com/results?search_query=ESAT+Physics+walkthrough。任务：限时 40 分钟做 Physics，写 5 条题干信号到公式/思路。"),
    makeTask("ESAT W1D5：ENGAA/NSAA 风格入门 + 三科错题整理", "2026-06-05", "exam", "medium", "资料：UAT 官方 ENGAA/NSAA archive：https://esat-tmua.ac.uk/esat-preparation-materials/；ENGAA walkthrough：https://www.youtube.com/results?search_query=ENGAA+Section+1+walkthrough；NSAA walkthrough：https://www.youtube.com/results?search_query=NSAA+Section+1+walkthrough。任务：选 2022/2023 Section 1 做相关 Maths/Physics 题，整理本周弱点 1-10。"),
    makeTask("ESAT W1D6：两科连练 + 时间策略", "2026-06-06", "exam", "high", "资料：Pearson sample/specimen：https://www.pearsonvue.com/us/en/uatuk.html；UAT 备考材料：https://esat-tmua.ac.uk/esat-preparation-materials/。任务：连续做两个 40 分钟 module，训练 60-90 秒跳题、flag 和最后 5 分钟全填。"),
    makeTask("ESAT W1D7：周复盘 + 下周计划", "2026-06-07", "exam", "high", "资料：Praneel Physics ESAT Hub：https://praneelphysics.com/esat/hub；UAT：https://esat-tmua.ac.uk/esat-preparation-materials/；YouTube：https://www.youtube.com/results?search_query=ESAT+Maths+Physics+walkthrough。任务：汇总三科原始分，每科选 2 个下周优先 topic，写一页周报。")
  ];

  // Add sample subtasks to a few key tasks for demonstration
  const tasksWithSubs = tasks.map(t => {
    const sub = (titles) => titles.map(st => ({ id: uid("sub"), title: st, completed: false, createdAt: new Date().toISOString() }));
    if (t.title === "整理项目证据文件夹") t.subtasks = sub(["整理 ISSDC 项目文件", "整理 3D 打印作品照片", "整理论文初稿和终稿", "整理火箭项目资料", "每个项目写 100 字英文摘要"]);
    if (t.title === "英国 PS 第一版") t.subtasks = sub(["列出核心工程经历清单", "写出中文素材提纲", "转成英文段落初稿", "修改主线逻辑（建模-原型-测试）", "请老师/同学反馈"]);
    if (t.title === "推荐信材料包发给老师") t.subtasks = sub(["整理 1 页 brag sheet", "列出最希望老师提到的 3 个例子", "打包成绩单和项目证据", "确认推荐信截止日期", "发邮件并确认老师收到"]);
    if (t.title === "Common App 活动表初稿") t.subtasks = sub(["列出全部活动和角色", "按影响力排序", "筛选 10 项最重要的", "写英文 150 字符描述", "润色语法和动词"]);
    return t;
  });

  const events = [
    makeEvent("确认 UCAS 专业组合", "2026-06-15", "uk", "锁定剑桥、Imperial、UCL、KCL 与替代志愿策略。"),
    makeEvent("启动 ESAT/TARA 系统训练", "2026-06-20", "exam", "建立限时训练、错题本和模块弱点表。"),
    makeEvent("UAT-UK 10 月考试预约开放", "2026-07-20", "exam", "预约 ESAT/TARA，确认考点和证件。"),
    makeEvent("Common App 活动表初稿", "2026-07-25", "us", "完成活动排序、英文描述和影响力证据。"),
    makeEvent("英国 PS 第一版", "2026-08-20", "essay", "形成工程学术主线和素材取舍。"),
    makeEvent("Common App 通常开放", "2026-08-01", "us", "开始填写信息和学校附文书。"),
    makeEvent("推荐信材料包", "2026-08-25", "materials", "把 brag sheet 发给推荐老师。"),
    makeEvent("UCAS 信息与推荐信审核", "2026-09-10", "uk", "学校内部审核、预测分、申请信息。"),
    makeEvent("ESAT/TARA 冲刺", "2026-09-20", "exam", "限时模拟、薄弱模块补强。"),
    makeEvent("ESAT", "2026-10-12", "exam", "中国/港澳 October sitting: 10 月 12-13 日。"),
    makeEvent("ESAT", "2026-10-13", "exam", "中国/港澳 October sitting: 10 月 12-13 日。"),
    makeEvent("TARA", "2026-10-14", "exam", "UCL Robotics and AI 2027 cycle 要求。"),
    makeEvent("剑桥 UCAS 截止", "2026-10-15", "uk", "2027 Entry 常规本科申请截止。"),
    makeEvent("美国早申提交检查", "2026-10-25", "us", "ED/EA 文书、活动、推荐信、标化。"),
    makeEvent("剑桥面试准备", "2026-11-20", "uk", "通常集中在 11 月下旬-12 月上旬。"),
    makeEvent("美国 RD 文书与补充材料", "2026-12-15", "us", "结合早申结果调整 RD。"),
    makeEvent("UCAS 常规截止", "2027-01-13", "uk", "2027 Entry equal consideration deadline。"),
    makeEvent("美国 RD 提交窗口", "2027-01-05", "us", "多数 RD 截止在 1 月上旬至中旬。"),
    makeEvent("录取结果比较", "2027-03-25", "materials", "比较英美 offer、奖学金、专业匹配。"),
    makeEvent("英国 offer 回复与后续准备", "2027-05-01", "uk", "条件 offer、AP/语言、签证、住宿。"),
    makeEvent("ESAT 本周诊断周复盘", "2026-06-07", "exam", "检查 2026-06-01 到 2026-06-07 的 Maths 1、Maths 2、Physics 基线分数、错题分类和下周弱点优先级。资料总入口：UAT https://esat-tmua.ac.uk/esat-preparation-materials/；Pearson https://www.pearsonvue.com/us/en/uatuk.html。")
  ];

  return {
    version: 1,
    importedSeedVersion: "admission-2027-v1",
    sourceReportPath: reportPath,
    generatedAt: new Date().toISOString(),
    goals: [
      {
        id: "goal_admission",
        title: "2027 Entry 英美工程方向申请",
        description: "围绕工程、机器人、航空航天、软硬件结合完成申请准备。",
        targetDate: "2027-05-01",
        status: "active"
      }
    ],
    projects: [],
    tasks: tasksWithSubs,
    longTasks: [],
    events,
    notes: [
      {
        id: uid("note"),
        content: reportPath
          ? `应用已检测到升学指导报告并导入时间线：${reportPath}`
          : "未检测到升学指导报告文件，已使用内置升学时间线初始化。可以在右侧让 AI 帮你拆分任务、调整日程或记录想法。",
        createdAt: new Date().toISOString(),
        tags: ["系统", "升学规划"]
      },
      {
        id: uid("note"),
        content: "ESAT 本周资料索引：UAT 官方 ESAT 格式/日期：https://esat-tmua.ac.uk/about-the-tests/esat-test/；UAT 官方 ESAT guide + ENGAA/NSAA archive：https://esat-tmua.ac.uk/esat-preparation-materials/；Pearson 官方机考 specimen/sample：https://www.pearsonvue.com/us/en/uatuk.html；Praneel Physics ESAT Hub：https://praneelphysics.com/esat/hub；YouTube：Maths 1 https://www.youtube.com/results?search_query=ESAT+Maths+1+walkthrough；Maths 2 https://www.youtube.com/results?search_query=ESAT+Maths+2+walkthrough；Physics https://www.youtube.com/results?search_query=ESAT+Physics+walkthrough。",
        createdAt: new Date().toISOString(),
        tags: ["ESAT", "本周计划", "资料"]
      }
    ],
    drafts: [],
    chat: []
  };
}

function getPaths() {
  const dir = app.getPath("userData");
  return {
    dir,
    dataPath: path.join(dir, "planner-data.json"),
    settingsPath: path.join(dir, "settings.json"),
    authSessionPath: path.join(dir, "auth-session.json"),
    backgroundDir: path.join(dir, "backgrounds"),
    pluginsDir: path.join(dir, "plugins")
  };
}

function ensureData() {
  const { dir, dataPath } = getPaths();
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(seedData(), null, 2), "utf8");
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function validateAuthStorageKey(key) {
  if (typeof key !== "string" || !/^sb-[a-z0-9-]+-(?:auth-token|code-verifier)$/i.test(key)) {
    throw new Error("Invalid authentication storage key.");
  }
}

function readAuthStorage(key) {
  validateAuthStorageKey(key);
  const { authSessionPath } = getPaths();
  const stored = readJson(authSessionPath, {});
  const storedValue = stored[key];
  if (typeof storedValue !== "string" || !storedValue) return null;
  try {
    if (storedValue.startsWith("plain:")) {
      return Buffer.from(storedValue.slice("plain:".length), "base64").toString("utf8");
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    const encryptedValue = storedValue.startsWith("safe:") ? storedValue.slice("safe:".length) : storedValue;
    return safeStorage.decryptString(Buffer.from(encryptedValue, "base64"));
  } catch {
    delete stored[key];
    writeJson(authSessionPath, stored);
    return null;
  }
}

function writeAuthStorage(key, value) {
  validateAuthStorageKey(key);
  if (typeof value !== "string" || value.length > 1024 * 1024) {
    throw new Error("Invalid authentication storage value.");
  }
  const { dir, authSessionPath } = getPaths();
  fs.mkdirSync(dir, { recursive: true });
  const stored = readJson(authSessionPath, {});
  try {
    if (safeStorage.isEncryptionAvailable()) {
      stored[key] = `safe:${safeStorage.encryptString(value).toString("base64")}`;
    } else {
      stored[key] = `plain:${Buffer.from(value, "utf8").toString("base64")}`;
    }
  } catch {
    stored[key] = `plain:${Buffer.from(value, "utf8").toString("base64")}`;
  }
  writeJson(authSessionPath, stored);
}

function removeAuthStorage(key) {
  validateAuthStorageKey(key);
  const { authSessionPath } = getPaths();
  const stored = readJson(authSessionPath, {});
  if (!(key in stored)) return;
  delete stored[key];
  writeJson(authSessionPath, stored);
}

const allowedPluginPermissions = new Set(["tasks", "settings", "ui", "events", "calendar"]);
const allowedPluginFieldTypes = new Set(["boolean", "number", "string", "select"]);
const maxExternalPluginEntryBytes = 512 * 1024;

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : fallback;
}

function cleanLocalizedText(value) {
  if (!value || typeof value !== "object") return undefined;
  const result = {};
  for (const lang of ["zh", "en"]) {
    const text = cleanText(value[lang]);
    if (text) result[lang] = text;
  }
  return Object.keys(result).length ? result : undefined;
}

function cleanPluginConfigFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, 20).flatMap((field) => {
    if (!field || typeof field !== "object") return [];
    const key = cleanText(field.key).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64);
    const type = cleanText(field.type);
    if (!key || !allowedPluginFieldTypes.has(type)) return [];
    const cleanField = {
      key,
      label: cleanText(field.label, key),
      labelI18n: cleanLocalizedText(field.labelI18n),
      type,
      default: field.default,
    };
    if (type === "number") {
      if (Number.isFinite(field.min)) cleanField.min = Number(field.min);
      if (Number.isFinite(field.max)) cleanField.max = Number(field.max);
    }
    if (type === "select" && Array.isArray(field.options)) {
      cleanField.options = field.options.slice(0, 50).flatMap((option) => {
        if (!option || typeof option !== "object") return [];
        const value = cleanText(option.value).slice(0, 100);
        if (!value) return [];
        return [{
          value,
          label: cleanText(option.label, value),
          labelI18n: cleanLocalizedText(option.labelI18n),
        }];
      });
    }
    return [cleanField];
  });
}

function readExternalPluginManifests() {
  const { pluginsDir } = getPaths();
  if (!fs.existsSync(pluginsDir)) return { dir: pluginsDir, plugins: [] };
  const plugins = [];
  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folderId = entry.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
    const manifestPath = path.join(pluginsDir, entry.name, "manifest.json");
    if (!folderId || !fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!manifest || typeof manifest !== "object") continue;
      const id = cleanText(manifest.id, folderId).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
      const name = cleanText(manifest.name, id);
      if (!id || !name) continue;
      plugins.push({
        id,
        name,
        nameI18n: cleanLocalizedText(manifest.nameI18n),
        description: cleanText(manifest.description, "Local plugin installed in the desktop plugin directory.").slice(0, 500),
        descriptionI18n: cleanLocalizedText(manifest.descriptionI18n),
        enabledSummaryI18n: cleanLocalizedText(manifest.enabledSummaryI18n) || {
          zh: "本地插件已保留在用户插件目录中；当前版本加载 manifest 和配置，不执行外部脚本。",
          en: "This local plugin is preserved in the user plugin directory; this build loads its manifest and config, not external scripts.",
        },
        version: cleanText(manifest.version, "0.0.0").slice(0, 40),
        author: cleanText(manifest.author, "Local").slice(0, 80),
        icon: cleanText(manifest.icon, "P").slice(0, 4),
        permissions: Array.isArray(manifest.permissions)
          ? manifest.permissions.filter((permission) => allowedPluginPermissions.has(permission)).slice(0, 5)
          : [],
        configFields: cleanPluginConfigFields(manifest.configFields),
        source: "external",
        directoryName: entry.name,
        hasEntry: fs.existsSync(path.join(pluginsDir, entry.name, "index.js")),
      });
    } catch (error) {
      console.warn(`[plugins] failed to read ${manifestPath}:`, error);
    }
  }
  return { dir: pluginsDir, plugins };
}

function readExternalPluginEntry(pluginId) {
  const safeId = cleanText(pluginId).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
  if (!safeId) throw new Error("Invalid plugin id.");
  const manifests = readExternalPluginManifests();
  const plugin = manifests.plugins.find((item) => item.id === safeId);
  if (!plugin) throw new Error(`External plugin not found: ${safeId}`);
  const entryPath = path.join(manifests.dir, plugin.directoryName, "index.js");
  const resolvedPluginsDir = path.resolve(manifests.dir);
  const resolvedEntryPath = path.resolve(entryPath);
  if (!resolvedEntryPath.startsWith(resolvedPluginsDir + path.sep)) {
    throw new Error("External plugin entry escaped the plugin directory.");
  }
  if (!fs.existsSync(resolvedEntryPath)) {
    return { id: plugin.id, code: "", path: resolvedEntryPath, missing: true };
  }
  const stat = fs.statSync(resolvedEntryPath);
  if (!stat.isFile()) throw new Error("External plugin entry is not a file.");
  if (stat.size > maxExternalPluginEntryBytes) {
    throw new Error(`External plugin entry is too large (${stat.size} bytes).`);
  }
  return {
    id: plugin.id,
    code: fs.readFileSync(resolvedEntryPath, "utf8"),
    path: resolvedEntryPath,
    missing: false,
  };
}

function backupCurrentData(reason) {
  const { dataPath, dir } = getPaths();
  if (!fs.existsSync(dataPath)) return "";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const backupPath = path.join(dir, `planner-data.${reason}-${stamp}.json`);
  fs.copyFileSync(dataPath, backupPath);
  return backupPath;
}

function readData() {
  ensureData();
  const data = normalizePlannerData(readJson(getPaths().dataPath, seedData()));
  saveData(data);
  return data;
}

function saveData(data) {
  const next = { ...data, savedAt: new Date().toISOString() };
  writeJson(getPaths().dataPath, next);
  return next;
}

function getSettings() {
  const raw = readJson(getPaths().settingsPath, {});
  let apiKey = "";
  if (raw.encryptedApiKey) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(raw.encryptedApiKey, "base64"));
    } catch {
      apiKey = "";
    }
  }
  return {
    activeMode: ["today", "calendar", "planning"].includes(raw.activeMode) ? raw.activeMode : "today",
    defaultTimelineView: ["daily", "3day", "weekly", "month"].includes(raw.defaultTimelineView) ? raw.defaultTimelineView : "daily",
    continuousCrossDayScroll: raw.continuousCrossDayScroll !== false,
    planningView: ["tree", "matrix", "split"].includes(raw.planningView) ? raw.planningView : "tree",
    aiDockOpen: Boolean(raw.aiDockOpen),
    appTitle: "NavoPath",
    model: raw.model || DEFAULT_MODEL,
    baseUrl: raw.baseUrl || DEEPSEEK_URL,
    hasApiKey: Boolean(apiKey),
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "",
    displayName: raw.displayName || "陈潇杨",
    dailyFocusTime: raw.dailyFocusTime || "20:00",
    weekStartsOn: raw.weekStartsOn === 1 ? 1 : 0,
    theme: raw.theme || "light",
    accentColor: raw.accentColor || "#175cd3",
    executeAccentColor: raw.executeAccentColor || "#C69CF9",
    planningAccentColor: raw.planningAccentColor || "#CAFF72",
    themeGradientEnabled: typeof raw.themeGradientEnabled === "boolean" ? raw.themeGradientEnabled : true,
    aiTone: raw.aiTone || "direct",
    hideCompleted: Boolean(raw.hideCompleted),
    reminderLeadDays: Number.isFinite(raw.reminderLeadDays) ? raw.reminderLeadDays : 7,
    taskNoteDisplay: ["summary", "collapsed", "full"].includes(raw.taskNoteDisplay) ? raw.taskNoteDisplay : "summary",
    glassEnabled: Boolean(raw.glassEnabled),
    backgroundImagePath: raw.backgroundImagePath || "",
    glassBlur: Number.isFinite(raw.glassBlur) ? raw.glassBlur : 18,
    glassOpacity: Number.isFinite(raw.glassOpacity) ? raw.glassOpacity : 88,
    backgroundDim: Number.isFinite(raw.backgroundDim) ? raw.backgroundDim : 12,
    collapsedPanels: Array.isArray(raw.collapsedPanels) ? raw.collapsedPanels : [],
    collapsedSections: Array.isArray(raw.collapsedSections) ? raw.collapsedSections : [],
    panelWidths: {
      left: Number.isFinite(raw.panelWidths?.left) ? raw.panelWidths.left : 310,
      right: Number.isFinite(raw.panelWidths?.right) ? raw.panelWidths.right : 360
    },
    chatMessageMaxHeight: Number.isFinite(raw.chatMessageMaxHeight) ? raw.chatMessageMaxHeight : 220,
    aiMemoryEnabled: raw.aiMemoryEnabled !== false,
    addAdvancedOpen: Boolean(raw.addAdvancedOpen),
    dayStartTime: raw.dayStartTime || "00:00",
    idleThresholdMinutes: Number.isFinite(raw.idleThresholdMinutes) ? raw.idleThresholdMinutes : 5,
    focusModeDefault: ["stopwatch", "pomodoro", "flowtime"].includes(raw.focusModeDefault) ? raw.focusModeDefault : "stopwatch"
  };
}

function saveSettings(settings) {
  const existing = readJson(getPaths().settingsPath, {});
  const next = {
    activeMode: ["today", "calendar", "planning"].includes(settings.activeMode) ? settings.activeMode : existing.activeMode || "today",
    defaultTimelineView: ["daily", "3day", "weekly", "month"].includes(settings.defaultTimelineView)
      ? settings.defaultTimelineView
      : ["daily", "3day", "weekly", "month"].includes(existing.defaultTimelineView)
        ? existing.defaultTimelineView
        : "daily",
    continuousCrossDayScroll: typeof settings.continuousCrossDayScroll === "boolean" ? settings.continuousCrossDayScroll : existing.continuousCrossDayScroll !== false,
    planningView: ["tree", "matrix", "split"].includes(settings.planningView) ? settings.planningView : existing.planningView || "tree",
    aiDockOpen: typeof settings.aiDockOpen === "boolean" ? settings.aiDockOpen : Boolean(existing.aiDockOpen),
    addAdvancedOpen: typeof settings.addAdvancedOpen === "boolean" ? settings.addAdvancedOpen : Boolean(existing.addAdvancedOpen),
    appTitle: "NavoPath",
    model: settings.model || existing.model || DEFAULT_MODEL,
    baseUrl: settings.baseUrl || existing.baseUrl || DEEPSEEK_URL,
    displayName: settings.displayName || existing.displayName || "陈潇杨",
    dailyFocusTime: settings.dailyFocusTime || existing.dailyFocusTime || "20:00",
    weekStartsOn: typeof settings.weekStartsOn === "number" ? (settings.weekStartsOn === 1 ? 1 : 0) : existing.weekStartsOn === 1 ? 1 : 0,
    theme: settings.theme || existing.theme || "light",
    accentColor: settings.accentColor || existing.accentColor || "#175cd3",
    executeAccentColor: settings.executeAccentColor || existing.executeAccentColor || "#C69CF9",
    planningAccentColor: settings.planningAccentColor || existing.planningAccentColor || "#CAFF72",
    themeGradientEnabled: typeof settings.themeGradientEnabled === "boolean" ? settings.themeGradientEnabled : existing.themeGradientEnabled !== false,
    aiTone: settings.aiTone || existing.aiTone || "direct",
    hideCompleted: typeof settings.hideCompleted === "boolean" ? settings.hideCompleted : Boolean(existing.hideCompleted),
    reminderLeadDays: Number.isFinite(settings.reminderLeadDays) ? settings.reminderLeadDays : existing.reminderLeadDays || 7,
    taskNoteDisplay: ["summary", "collapsed", "full"].includes(settings.taskNoteDisplay)
      ? settings.taskNoteDisplay
      : existing.taskNoteDisplay || "summary",
    glassEnabled: typeof settings.glassEnabled === "boolean" ? settings.glassEnabled : Boolean(existing.glassEnabled),
    backgroundImagePath: typeof settings.backgroundImagePath === "string" ? settings.backgroundImagePath : existing.backgroundImagePath || "",
    glassBlur: Number.isFinite(settings.glassBlur) ? settings.glassBlur : Number.isFinite(existing.glassBlur) ? existing.glassBlur : 18,
    glassOpacity: Number.isFinite(settings.glassOpacity) ? settings.glassOpacity : Number.isFinite(existing.glassOpacity) ? existing.glassOpacity : 88,
    backgroundDim: Number.isFinite(settings.backgroundDim) ? settings.backgroundDim : Number.isFinite(existing.backgroundDim) ? existing.backgroundDim : 12,
    collapsedPanels: Array.isArray(settings.collapsedPanels) ? settings.collapsedPanels : Array.isArray(existing.collapsedPanels) ? existing.collapsedPanels : [],
    collapsedSections: Array.isArray(settings.collapsedSections) ? settings.collapsedSections : Array.isArray(existing.collapsedSections) ? existing.collapsedSections : [],
    panelWidths: {
      left: Number.isFinite(settings.panelWidths?.left)
        ? settings.panelWidths.left
        : Number.isFinite(existing.panelWidths?.left)
          ? existing.panelWidths.left
          : 310,
      right: Number.isFinite(settings.panelWidths?.right)
        ? settings.panelWidths.right
        : Number.isFinite(existing.panelWidths?.right)
          ? existing.panelWidths.right
          : 360
    },
    chatMessageMaxHeight: Number.isFinite(settings.chatMessageMaxHeight)
      ? settings.chatMessageMaxHeight
      : Number.isFinite(existing.chatMessageMaxHeight)
        ? existing.chatMessageMaxHeight
        : 220,
    aiMemoryEnabled: typeof settings.aiMemoryEnabled === "boolean" ? settings.aiMemoryEnabled : existing.aiMemoryEnabled !== false,
    dayStartTime: settings.dayStartTime || existing.dayStartTime || "00:00",
    idleThresholdMinutes: Number.isFinite(settings.idleThresholdMinutes)
      ? settings.idleThresholdMinutes
      : Number.isFinite(existing.idleThresholdMinutes)
        ? existing.idleThresholdMinutes
        : 5,
    focusModeDefault: ["stopwatch", "pomodoro", "flowtime"].includes(settings.focusModeDefault)
      ? settings.focusModeDefault
      : ["stopwatch", "pomodoro", "flowtime"].includes(existing.focusModeDefault)
        ? existing.focusModeDefault
        : "stopwatch",
    updatedAt: new Date().toISOString()
  };
  if (settings.apiKey && settings.apiKey.trim()) {
    next.encryptedApiKey = safeStorage.encryptString(settings.apiKey.trim()).toString("base64");
  } else if (settings.clearApiKey) {
    next.encryptedApiKey = "";
  } else {
    next.encryptedApiKey = existing.encryptedApiKey || "";
  }
  writeJson(getPaths().settingsPath, next);
  return getSettings();
}

function getApiKey() {
  const raw = readJson(getPaths().settingsPath, {});
  if (!raw.encryptedApiKey) return "";
  try {
    return safeStorage.decryptString(Buffer.from(raw.encryptedApiKey, "base64"));
  } catch {
    return "";
  }
}

function summarizeData(data) {
  const openTasks = data.tasks.filter((task) => !task.completed).slice(0, 30);
  const events = data.events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40);
  const notes = data.notes.slice(-8);
  return JSON.stringify(
    {
      today: todayIso(),
      goals: data.goals,
      openTasks,
      longTasks: data.longTasks || [],
      upcomingEvents: events,
      recentNotes: notes,
      aiMemories: (data.aiMemories || []).slice(-20)
    },
    null,
    2
  );
}

function extractJson(content) {
  // Try ```json fence first, then plain ``` fence, then raw { }
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : content;
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(source.slice(first, last + 1));
  } catch {
    return null;
  }
}

function normalizeAiResponse(content) {
  const parsed = extractJson(content);
  if (parsed && (parsed.reply || Array.isArray(parsed.actions))) {
    return {
      reply: parsed.reply || content,
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    };
  }
  return { reply: content, actions: [] };
}

function applyActions(actions) {
  const data = readData();
  const applied = [];
  for (const action of actions || []) {
    if (!action || typeof action !== "object") continue;
    if (action.type === "add_task" && action.title && action.dueDate) {
      const task = makeTask(
        String(action.title),
        String(action.dueDate),
        action.category || "personal",
        action.priority || "medium",
        action.notes || "",
        action.goalId || "goal_admission"
      );
      if (Array.isArray(action.subtasks) && action.subtasks.length > 0) {
        task.subtasks = action.subtasks.map((st, i) => ({
          id: uid("sub"),
          title: String(st.title || st),
          completed: false,
          createdAt: new Date().toISOString()
        }));
      }
      data.tasks.push(task);
      applied.push({ type: "add_task", id: task.id, title: task.title });
    }
    if (action.type === "reschedule_task" && action.taskId && action.dueDate) {
      const task = data.tasks.find((item) => item.id === action.taskId);
      if (task) {
        task.dueDate = String(action.dueDate);
        task.updatedAt = new Date().toISOString();
        applied.push({ type: "reschedule_task", id: task.id, title: task.title });
      }
    }
    if (action.type === "add_event" && action.title && action.date) {
      const event = makeEvent(String(action.title), String(action.date), action.category || "personal", action.details || "");
      event.imported = false;
      data.events.push(event);
      applied.push({ type: "add_event", id: event.id, title: event.title });
    }
    if (action.type === "add_note" && action.content) {
      const note = {
        id: uid("note"),
        content: String(action.content),
        createdAt: new Date().toISOString(),
        tags: Array.isArray(action.tags) ? action.tags : []
      };
      data.notes.push(note);
      applied.push({ type: "add_note", id: note.id, title: note.content.slice(0, 30) });
    }
    if (action.type === "add_memory" && action.content) {
      const now = new Date().toISOString();
      const memory = {
        id: uid("memory"),
        content: String(action.content).slice(0, 500),
        tags: Array.isArray(action.tags) ? action.tags.slice(0, 6).map(String) : [],
        createdAt: now,
        updatedAt: now
      };
      data.aiMemories = Array.isArray(data.aiMemories) ? data.aiMemories : [];
      const exists = data.aiMemories.some((item) => item.content.trim() === memory.content.trim());
      if (!exists) {
        data.aiMemories.push(memory);
        applied.push({ type: "add_memory", id: memory.id, title: memory.content.slice(0, 30) });
      }
    }
  }
  return { data: saveData(data), applied };
}

async function selectBackgroundImage() {
  const result = await dialog.showOpenDialog({
    title: "选择背景图片",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { path: "" };
  const source = result.filePaths[0];
  const ext = path.extname(source).toLowerCase() || ".png";
  const { backgroundDir } = getPaths();
  fs.mkdirSync(backgroundDir, { recursive: true });
  const target = path.join(backgroundDir, `background${ext}`);
  fs.copyFileSync(source, target);
  const settings = saveSettings({ backgroundImagePath: target });
  return { path: settings.backgroundImagePath };
}

async function callDeepSeek({ messages = [], draftText = "" }) {
  const settings = getSettings();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("请先在右上角设置 DeepSeek API Key。");
  }
  const data = readData();
  const system = [
    "你是一个留学升学对话助手。你需要根据用户输入决定返回格式。",
    "如果需要创建任务 / 事件 / 笔记 / 记忆，必须只返回纯 JSON，不要用 markdown 代码块（不要用 ```），不要加任何前缀文字：",
    '{"reply":"你的中文回复","actions":[{"type":"add_task","title":"...","dueDate":"YYYY-MM-DD","category":"exam|uk|us|essay|materials|project|personal","priority":"high|medium|low","notes":"目标：...\\n衡量：...\\n行动：...\\n资料：...\\n完成标准：...","subtasks":[{"title":"子任务"}]}]}',
    "如果只是普通聊天、不需要创建/修改任何数据，直接返回纯文本，不要用 JSON。",
    "任务备注必须严格按 SMART 五段写（目标：/衡量：/行动：/资料：/完成标准：）。每个子任务标题 15 字以内。",
    "可用 action：add_task、reschedule_task、add_event、add_note、add_memory。",
    "除了 add_memory，其他 action 不要说'已执行'——应用会展示预览，由用户点击确认。",
    `本地数据摘要：${summarizeData(data)}`
  ].join("\n");

  const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
  const body = {
    model: settings.model || DEFAULT_MODEL,
    messages: [
      ...(hasSystemMessage ? [] : [{ role: "system", content: system }]),
      ...messages.slice(-10),
      ...(draftText ? [{ role: "user", content: draftText }] : [])
    ],
    temperature: 0.4,
    max_tokens: 4096,
    stream: false
  };

  const response = await fetch(settings.baseUrl || DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek 请求失败：${response.status} ${text.slice(0, 200)}`);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || "";
  return normalizeAiResponse(content);
}

let isQuitting = false;
let tray = null;

function showMainWindow() {
  const existingWin = BrowserWindow.getAllWindows()[0];
  if (existingWin) {
    if (existingWin.isMinimized()) existingWin.restore();
    existingWin.show();
    existingWin.focus();
    return existingWin;
  }
  createWindow();
  return BrowserWindow.getAllWindows()[0] || null;
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");

  // Determine app URL: prefer local built file, fall back to dev server or remote
  let appUrl;
  let allowedOrigin;
  const localIndex = path.join(__dirname, "..", "dist", "index.html");
  const useLocalFile = app.isPackaged || (fs.existsSync(localIndex) && !process.env.VITE_DEV_SERVER_URL);
  if (useLocalFile) {
    // Production or local build: load local file
    const indexPath = app.isPackaged
      ? path.join(app.getAppPath(), "dist", "index.html")
      : localIndex;
    appUrl = new URL(`file://${indexPath}`);
    allowedOrigin = "file://";
  } else {
    // Development with dev server
    const configuredUrl = process.env.VITE_DEV_SERVER_URL || process.env.NAVOPATH_APP_URL || "https://navopath-xiaoyang.pages.dev";
    appUrl = new URL("/app", configuredUrl);
    allowedOrigin = appUrl.origin;
  }

  const isWorkspaceUrl = (url) => {
    try {
      const target = new URL(url);
      if (app.isPackaged) {
        // In production, allow local files
        return target.protocol === "file:";
      }
      return target.origin === allowedOrigin && (target.pathname === "/app" || target.pathname.startsWith("/app/"));
    } catch {
      return false;
    }
  };

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: "NavoPath",
    icon: iconPath,
    backgroundColor: "#f5f7fb",
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Show window when content is ready for faster perceived performance
  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[did-fail-load] code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  win.webContents.on("will-navigate", (e, url) => {
    if (!isWorkspaceUrl(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWorkspaceUrl(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (useLocalFile) {
    win.loadFile(app.isPackaged ? path.join(app.getAppPath(), "dist", "index.html") : localIndex);
  } else {
    win.loadURL(appUrl.toString());
  }
}

// Single-instance lock: focus existing window instead of launching a duplicate
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

app.whenReady().then(() => {
  // Create window first for fastest perceived startup
  createWindow();
  
  // Defer non-critical initialization to background
  setImmediate(() => {
    ensureData();
    createTray();
    configureAutoUpdater();
  });
  
  app.on("activate", () => {
    showMainWindow();
  });
});

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty();
  } catch {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "显示 NavoPath", click: () => { const win = BrowserWindow.getAllWindows()[0]; if (win) { win.show(); win.focus(); } else createWindow(); } },
    { type: "separator" },
    { label: "退出", click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip("NavoPath");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { win.show(); win.focus(); } else createWindow();
  });
}

app.on("before-quit", () => { isQuitting = true; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep app alive in tray; only quit when user explicitly exits from tray
    if (!isQuitting) {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.hide();
    } else {
      app.quit();
    }
  }
});

ipcMain.handle("planner:getData", () => readData());
ipcMain.handle("planner:saveData", (_event, data) => saveData(data));
ipcMain.handle("planner:applyActions", (_event, actions) => applyActions(actions));
ipcMain.handle("planner:resetSeed", () => {
  backupCurrentData("before-reset");
  return saveData(normalizePlannerData(seedData()));
});
ipcMain.handle("settings:get", () => getSettings());
ipcMain.handle("settings:save", (_event, settings) => saveSettings(settings));
ipcMain.handle("settings:selectBackgroundImage", () => selectBackgroundImage());
ipcMain.handle("auth-storage:get", (_event, key) => readAuthStorage(key));
ipcMain.handle("auth-storage:set", (_event, key, value) => writeAuthStorage(key, value));
ipcMain.handle("auth-storage:remove", (_event, key) => removeAuthStorage(key));
ipcMain.handle("plugins:listExternal", () => readExternalPluginManifests());
ipcMain.handle("plugins:readExternalEntry", (_event, pluginId) => readExternalPluginEntry(pluginId));
ipcMain.handle("ai:chat", (_event, payload) => callDeepSeek(payload));
ipcMain.handle("updater:getState", () => updateState);
ipcMain.handle("updater:check", async () => {
  try {
    return await checkForDesktopUpdate(true);
  } catch (error) {
    return publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
ipcMain.handle("updater:install", () => {
  if (updateState.status !== "downloaded") return false;
  setImmediate(() => {
    const autoUpdater = getAutoUpdater();
    if (typeof autoUpdater.quitAndInstall !== "function") {
      publishUpdateState({
        status: "error",
        message: "The downloaded update cannot be installed automatically. Please download the latest installer manually."
      });
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  });
  return true;
});

// Auto-launch at system startup (toggled from Settings)
ipcMain.handle("autolaunch:get", () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});
ipcMain.handle("autolaunch:set", (_event, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled });
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});

// Local JSON snapshot — written on every app launch (and on demand) so users
// always have an offline backup next to their auth session in userData.
ipcMain.handle("backup:writeSnapshot", (_event, payload) => {
  try {
    const { dir } = getPaths();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const stampedPath = path.join(dir, `navopath-snapshot-${stamp}.json`);
    const latestPath = path.join(dir, "navopath-snapshot-latest.json");
    const body = JSON.stringify({
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      data: payload?.data ?? null,
      settings: payload?.settings ?? null,
      authUser: payload?.authUser ?? null,
    }, null, 2);
    fs.writeFileSync(stampedPath, body, "utf8");
    fs.writeFileSync(latestPath, body, "utf8");
    // Keep only the 10 most recent stamped snapshots (latest is preserved separately).
    const snapshots = fs.readdirSync(dir)
      .filter((name) => /^navopath-snapshot-\d{4}-\d{2}-\d{2}T.+\.json$/.test(name))
      .sort()
      .reverse();
    for (const stale of snapshots.slice(10)) {
      try { fs.unlinkSync(path.join(dir, stale)); } catch { /* ignore */ }
    }
    return { ok: true, path: latestPath, stampedPath };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle("backup:readLatest", () => {
  try {
    const { dir } = getPaths();
    const latestPath = path.join(dir, "navopath-snapshot-latest.json");
    if (!fs.existsSync(latestPath)) return { ok: false, reason: "not-found" };
    const raw = fs.readFileSync(latestPath, "utf8");
    return { ok: true, payload: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

// ============================================================
// Desktop widget window (always-on-top mini panel)
// ============================================================
let widgetWindow = null;

function createWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show();
    widgetWindow.focus();
    return widgetWindow;
  }
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");

  widgetWindow = new BrowserWindow({
    width: 320,
    height: 240,
    minWidth: 280,
    minHeight: 180,
    title: "NavoPath Widget",
    icon: iconPath,
    alwaysOnTop: true,
    frame: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the same renderer bundle with ?widget=1 so it mounts WidgetApp
  // instead of the full App (no Supabase auth / data boot in the widget).
  const localIndex = path.join(__dirname, "..", "dist", "index.html");
  const useLocalFile = app.isPackaged || (fs.existsSync(localIndex) && !process.env.VITE_DEV_SERVER_URL);
  if (useLocalFile) {
    const indexPath = app.isPackaged
      ? path.join(app.getAppPath(), "dist", "index.html")
      : localIndex;
    widgetWindow.loadFile(indexPath, { query: { widget: "1" } });
  } else {
    const configuredUrl = process.env.VITE_DEV_SERVER_URL || process.env.NAVOPATH_APP_URL || "https://navopath-xiaoyang.pages.dev";
    widgetWindow.loadURL(`${configuredUrl}/app?widget=1`);
  }

  widgetWindow.once("ready-to-show", () => widgetWindow?.show());
  widgetWindow.on("closed", () => { widgetWindow = null; });
  return widgetWindow;
}

ipcMain.handle("widget:open", () => {
  createWidgetWindow();
  return true;
});
ipcMain.handle("widget:close", () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.close();
  return true;
});
ipcMain.handle("widget:set-always-on-top", (_event, enabled) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.setAlwaysOnTop(Boolean(enabled));
  return true;
});
ipcMain.handle("widget:set-position", (_event, x, y) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    try { widgetWindow.setPosition(Math.round(x), Math.round(y)); } catch { /* ignore off-screen */ }
  }
  return true;
});
ipcMain.handle("widget:get-position", () => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return null;
  const [x, y] = widgetWindow.getPosition();
  const [width, height] = widgetWindow.getSize();
  return { x, y, width, height };
});

// Relay: widget renderer → main window (action requests)
ipcMain.on("widget:action", (_event, action) => {
  const main = BrowserWindow.getAllWindows().find((w) => w !== widgetWindow && !w.isDestroyed());
  if (main) main.webContents.send("widget:action", action);
});

// Relay: main window → widget renderer (snapshot pushes)
ipcMain.on("widget:push-snapshot", (_event, snapshot) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("widget:snapshot", snapshot);
  }
});
