# NavoPath 更新日志

## 2026-07-15 · 时间轴拖拽修复与独立竖屏窗口

### 新增
- 桌面端新增独立于「正在做」小组件的完整竖屏窗口：默认以 420 × 760 打开，可自由调整大小，并可单独开启或关闭始终置顶。

### 修复
- 重做竖屏工作区：移除顶栏和搜索入口，底部改为纸面风格 Dock，提供添加、执行／规划切换和设置；候选区仅保留筛选与优化建议；规划视图切换移至顶部横栏，并在拖回任务时明确提示「移回今日候选」。默认主题色改为深棕墨色，减少泛红、泛绿的背景感。
- 合并「今日候选」的项目和已完成筛选为可完整显示的两级筛选器；现在可按项目多选并显示已完成任务，也可一键清空筛选，并移除按项目分组按钮。
- 修复桌面小组件在主窗口转入后台后计时器更新缓慢的问题；点击时间可在如 `38min` 的分钟显示和精确到秒之间切换。今日候选习惯不再显示编辑按钮，任务详情的备注编辑入口改为图标按钮。
- 修复竖屏候选任务行中勾选框占位过大、标题被挤成竖排的问题；现在保留 44 像素触控范围，同时使用紧凑勾选标记、双行标题和更均衡的时长与操作间距。候选区标题和工具栏也改为上下分行，避免标题与操作图标互相挤压。
- 修复今日候选拖拽习惯时残留的半透明占位框；移除候选栏顶部「正在做」状态栏，并将专注入口移至与日程模板、规划建议同一顶栏工具区；设置左侧新增全局搜索入口。
- 修复桌面小组件未按当前时间轴定位任务、正计时与倒计时绑定错误的问题：现在会显示当前任务；没有当前任务时显示距下一任务开始的时间；倒计时到任务截止时间后切换为带「已超时」标注的红色正计时，并在每超时 15 分钟时将当前任务块延长 15 分钟。
- 修复从任务块上边缘调整时间时预览先改变下边界的问题；上边缘与高度现在在同一帧按跨天绝对坐标更新。
- 修复习惯无法稳定拖入日、三日、周及跨天时间轴的问题；习惯现在与普通候选任务共用一致的时间轴命中与落点计算。
- 习惯拖拽现在与普通候选任务保持一致，只显示单一浮动任务卡片，不再出现重复透明框；原列表布局仍会保留以避免跳动。
- 设置页不再显示任何尚未实现的「即将支持」占位设置。
- 修复 AI 拆解子任务后结果无法正常预览和采用的问题；拆解建议现在按顺序显示并写回原任务，任务详情中的勾选框也与子任务名保持齐平。

### 改进
- 设置页由 15 个并列入口收敛为「通用、外观、工作流、账户与数据、高级」五类，新增中英文设置搜索、移动端分类选择器和高级详情页；原有设置与即时保存保持不变，旧入口仍会定位到新的准确位置。
- 任务详情的子任务标题栏新增 AI 自动拆解图标，并将手动添加改为相邻的纯图标操作；两者均沿用当前主题与「规划建议」图标语言。

## 2026-07-15 · Timeline drag fixes and independent portrait window

### Added
- Added a complete desktop portrait window independent from the current-task widget. It opens at 420 × 760 by default, remains resizable, and has its own always-on-top control.

### Fixed
- Redesigned the portrait workspace: removed the header and search entry, replaced the bottom navigation with a paper-style dock for Add, Execute/Planning, and Settings, kept only filtering and schedule suggestions in Candidates, moved Planning view choices into a top rail, and added an explicit return-to-candidates drop hint. Default accents now use deep brown ink to reduce red/green background casts.
- Consolidated Today's Candidate project and completed controls into a fully visible two-level filter, with multi-project selection, completed-task visibility, a single clear-all action, and no project-grouping control.
- Fixed slow desktop-widget timer updates after the main window enters the background. Clicking the displayed time now switches between a minute label such as `38min` and second precision. Habit rows no longer show edit buttons, and task-detail notes now use an icon-only edit control.
- Fixed portrait candidate rows wasting width on oversized checkbox visuals and squeezing titles into near-vertical text. The rows now retain 44px touch targets while using compact check marks, two-line titles, and balanced duration/action spacing. The candidate heading and toolbar now use separate rows so the title no longer competes with action icons.
- Fixed the residual transparent placeholder when dragging a habit in Today’s Candidates. Removed the candidate-panel “Working” bar, moved Focus into the same header tool group as Schedule Templates and Plan Suggestions, and added a global search action to the left of Settings.
- Fixed the desktop widget selecting tasks outside the current timeline slot and binding stopwatch/countdown state to the wrong task. It now shows the current task, counts down to the next task when the timeline is idle, switches deadline countdowns to a labeled red overdue stopwatch, and extends the current task block by 15 minutes at each completed 15-minute overrun interval.
- Fixed start-edge task resizing previewing a lower-boundary change first; the top edge and height now update in the same frame using continuous cross-day coordinates.
- Fixed habits failing to drag reliably into day, three-day, week, and continuous timelines by sharing the same target and drop calculation used by regular candidate tasks.
- Habit dragging now matches regular candidate tasks and shows a single floating task card without a duplicate transparent frame, while keeping the original list layout stable.
- Removed every unimplemented “Coming soon” placeholder setting from Settings.
- Fixed AI-generated subtask breakdowns failing to preview and apply correctly; suggestions now appear in order and write back to the original task, while detail checkboxes align with subtask names.

### Improved
- Consolidated Settings from 15 peer entries into General, Appearance, Workflow, Account & Data, and Advanced, with bilingual search, a mobile category picker, and focused Advanced detail pages. Existing settings and instant-save behavior remain intact, while legacy targets still resolve to their exact new locations.
- Added an AI breakdown icon beside the now icon-only manual add action in task details, using the active theme and the same icon language as Plan Suggestions.

## 2026-07-13 · 小组件截止时间联动计时器

### 新增
- 桌面小组件的番茄钟会按当前任务时间轴结束时间生成可预览的专注 / 休息计划；工作段会均匀调整，最后一段始终为专注并精确对齐任务结束时间。
- 新增可靠的 AI 服务网关与健康检查：主服务鉴权失败、限流或超时时会在总时限内切换备用服务，并返回可诊断且不包含任务正文的错误信息。
- 新建任务现在会在本地自动估算时长，并根据相似任务、实际计时与既有项目给出个性化归属；高置信度归属可撤销，中置信度建议可一键采用。

### 改进
- 核心工作区采用统一的纸面动效节奏：执行 / 规划、四种时间视图与双向翻页会在稳定导航下轻微交叉淡化；任务与设置抽屉现在对称退场并把键盘焦点还给触发按钮，减少动态模式则直接呈现最终状态。
- 候选任务完成时会依次显示勾选、标题淡化与行高收拢后再提交；候选任务、习惯、规划树与时间轴拖拽共享克制的墨色浮层、平滑占位和无缩放的放置反馈。
- 落地页首屏会无声自动演示一次从候选任务到时间轴的完整路径，并提供“重播演示”；页面失焦或首屏不可见时暂停，后续内容只在首次进入视口时轻微淡入，持续扫光、抖动、呼吸和循环引导已移除。
- “计划建议”现支持今天、未来三天和本周，以固定事件为锚点生成不冲突的临时时间块；当前候选栏可直接选择范围与策略、批量采用或放弃，长任务可预览分段，未安排任务会说明原因并提供缩短、拆分或移至下一天的操作。
- AI 对话支持随时取消、失败后保留草稿，并移除打开面板时的模型列表请求；模型路由和高级偏好集中在设置中。
- 设置页的分区导航在移动端改为横向滚动，不再被桌面端双栏规则挤压或裁切。
- 规划设置会显示今日待安排量与剩余容量风险，并提供复用同一上下文的“开工简报”和“收工复盘”入口；模糊任务可在任务抽屉中生成明确的下一步行动。
- 正计时、番茄钟和倒计时现在与当前任务的时间轴记录联动：倒计时默认使用任务结束时间，超时继续工作会延长当前任务，但不会移动后续安排。
- 三种计时模式在同一个“更多”面板中完成选择和设置；悬停只预览固定说明，单击才切换草稿模式，参数与计划预览可在保存前调整。
- 小组件时间现在保持垂直居中；“更多”面板将重置、置顶和关闭集中为紧凑图标，并把模式说明改为跟随指针的悬停提示。番茄钟运行时用番茄和草图标区分专注与休息，正计时继续使用播放 / 暂停图标，倒计时启动后不提供暂停。
- 小组件播放与更多图标现在在主卡片中保持垂直居中；“更多”面板加宽透明度滑条、改用当前墨水色并上移顶部工具栏。面板会在三个计时选项下方直接结束，点击模式立即生效，不再显示底部操作栏；悬停说明不再带边框，并会根据实际尺寸在窗口四边自动翻转和约束位置，彻底避免裁切。
- “背景透明度”与百分比现移至面板第一排左侧，透明度滑条独占下一排并横向铺满；滑轨和滑块不再使用系统紫色，浅色模式采用炭黑墨水色，深色模式自动切换为暖白墨水色。

### 修复
- 修复关闭小组件时主进程向已销毁窗口发送消息而报错的问题。
- 修复 AI 服务 403/502 后对话长期停留在“思考中”的问题，并修复规划策略被内部最长任务排序覆盖的问题。
- 修复网站更新后仍打开的旧页面无法加载已替换 AI 模块、导致对话直接显示“请求失败”的问题；AI 请求代码现随主入口加载，页面与脚本会重新验证版本，并在检测到部署切换时自动刷新一次。

## 2026-07-13 · Deadline-linked widget timers

### Added
- The desktop widget now generates a previewable Pomodoro focus/break plan from the active task's timeline end; work phases are balanced, the final phase is always focus, and it ends exactly at the task deadline.
- Added a reliable AI gateway and health check: authentication failures, rate limits, and timeouts fail over within a total request budget, with diagnostic errors that exclude task content.
- New tasks now receive local duration estimates and personalized existing-project suggestions based on similar tasks, actual timer history, and prior choices; high-confidence assignments are undoable and medium-confidence suggestions are one click away.

### Improved
- The core workspace now uses one paper-like motion rhythm: Execute / Planning, all four time views, and bidirectional paging cross-fade gently beneath stable navigation. Task and Settings drawers now exit symmetrically and return keyboard focus to their trigger, while reduced-motion mode renders the final state directly.
- Completing a candidate task now shows the check, fades the title, and collapses the row before committing. Candidate, habit, Planning-tree, and timeline drags share a restrained ink overlay, smooth placeholders, and scale-free placement feedback.
- The landing hero now silently autoplays the complete candidate-to-timeline story once and offers Replay demo. It pauses when the page or hero is hidden, later sections reveal only on their first viewport entry, and continuous sweeps, nudges, breathing, and looping guides have been removed.
- Plan Suggestions now covers today, the next three days, or this week, anchors around fixed events, and exposes scope, strategy, adopt-all, and reject controls in the current candidate header; long tasks can be previewed as segments, while unscheduled work includes reasons and shorten, split, or next-day actions.
- AI conversations can be cancelled, retain the draft after failure, and no longer fetch a model list when the panel opens; routing and advanced preferences live in Settings.
- Settings navigation now scrolls horizontally on mobile instead of being squeezed or clipped by the desktop two-column rule.
- Planning settings now show today's unscheduled demand and remaining-capacity risk, with start-of-day brief and day-review prompts that reuse the same context; vague tasks can generate a concrete next action from the task drawer.
- Stopwatch, Pomodoro, and countdown now follow the active timeline record: countdown defaults to the task end, while overtime extends only the current task without moving later plans.
- All three timer modes are selected and configured inside the same More panel; hover only previews fixed guidance, click changes the draft mode, and parameters plus the plan preview remain editable before saving.
- Widget time now stays vertically centered; the More panel groups reset, pin, and close as compact icons, while mode guidance appears as a pointer-following hover tip. A running Pomodoro uses tomato and grass icons for focus and break, stopwatch keeps play/pause icons, and countdown does not offer pause after starting.
- Play and More now stay vertically centered in the widget card; the More panel widens its opacity slider, uses the current ink color, and moves the utility row upward. It now ends directly below the three timer modes, applies a mode immediately without a bottom action bar, and measures borderless hover guidance so it can flip and clamp against all four window edges without clipping.
- Background opacity and its percentage now sit at the left of the first panel row, while the slider occupies the full row below. The track and thumb no longer use the system purple, using charcoal ink in light mode and warm ivory ink in dark mode.

### Fixed
- Fixed a main-process error caused by sending to a destroyed window while closing the widget.
- Fixed conversations remaining stuck in Thinking after AI 403/502 failures, and fixed planner strategies being overwritten by an internal longest-task sort.
- Fixed pages left open across a website deployment failing to load a replaced AI module and immediately showing “Request failed”; AI request code now loads with the main entry, page and script versions are revalidated, and a detected deployment transition triggers one automatic refresh.

## 2026-07-12 · 习惯候选显示开关

### 修复
- 修复“在今日候选中显示习惯区”开关无效的问题：该开关现独立控制今日候选区的习惯显示，不再意外关闭全部习惯功能；既有用户默认继续显示习惯。
- 修复旧版习惯插件数据无法显示在今日候选中的问题：应用现在会一次性迁移旧习惯及其完成记录到新的习惯区，避免重复创建。

### 改进
- 桌面小组件的“更多”面板现以紧凑工具面板贴附于小组件：透明度标签、滑杆与百分比合并为单行，三个计时模式改为内联文字标签页，选中模式的详细设置继续在同一面板内显示。
- 桌面小组件现将播放/暂停与“更多”放到主界面，“更多”内提供置顶和关闭图标操作，并移除阴影设置；任务标题在更窄宽度下仍保持可见，窗口缩放时会固定相对的另一侧边缘。

## 2026-07-12 · Habit candidate visibility toggle

### Fixed
- Fixed the “Show habits in today's candidates” toggle: it now independently controls the habit area in Today’s Candidates without disabling all habit features, while existing users continue to see habits by default.
- Fixed legacy habit-plugin data not appearing in Today’s Candidates: the app now migrates legacy habits and completion history once into the new habit area without creating duplicates.

### Improved
- The desktop widget More panel is now a compact tool panel attached to the widget: opacity label, slider, and percentage share one row, the three timer modes are inline text tabs, and the selected mode's details remain inside the same panel.
- The desktop widget now keeps play/pause and More on its primary surface, with pin and close icon actions in More, and removes shadow settings; task titles remain visible at narrower widths, while resizing keeps the opposite edge anchored.

## 2026-07-11 · 桌面小组件自适应计时器

### 新增
- 桌面小组件现支持正计时、自动轮换专注与休息的番茄钟，以及结束后进入红色闪烁超时正计时的倒计时；小组件跟随主页面深浅模式，详细设置可分别调整两套主题颜色、字体、字号、背景透明度、置顶、阴影与各模式时长。

### 改进
- 小组件可从任意原生边缘自由缩放，横向收窄时依次精简为“时间与更多”和仅时间，纵向拉伸则平滑放大文字；独立“更多”面板保持简洁，并会根据屏幕边缘自动翻转、钳制或滚动，避免被桌面边缘遮挡。
- 小组件边缘现显示八向缩放光标，默认与重置尺寸统一为紧凑的 400 × 80，便于快速定位与调整。
- 倒计时现在以当前任务截止日为目标；没有截止日时需要先安排任务。详细设置与“更多”共用草稿式保存和重置，置顶与阴影也可独立切换。

## 2026-07-11 · Adaptive desktop widget timer

### Added
- The desktop widget now supports a stopwatch, a Pomodoro timer that automatically alternates focus and break phases, and a countdown that continues as a red flashing overrun stopwatch; it follows the main app's light or dark theme, while detailed settings expose separate theme colors, font, type scale, background opacity, always-on-top, shadow, and mode durations.

### Improved
- The widget freely resizes from every native edge, progressively simplifies to timer plus More and then timer-only as it narrows, and smoothly scales its type when made taller; the separate compact More panel flips, clamps, or scrolls around screen edges so it is never obscured by the desktop boundary.
- Eight directional resize cursors now make each widget edge visible, while the compact 400 × 80 geometry is used consistently for both defaults and resets.
- Countdown now targets the current task's deadline; tasks without one must be scheduled first. Detailed settings and More share draft-based Save and Reset actions, while always-on-top and shadow can be toggled independently.

## 2026-07-10 · 桌面小组件交互与响应式重构

### 修复
- 桌面小组件采用更紧凑的 500 × 88 默认与重置尺寸，状态文字更小、更柔和，任务标题和时间更大、更醒目，并移除底部项目颜色条；窗口支持原生边缘缩放并记住尺寸和位置，用户将窗口高度增加到足够时会自动切换为两行布局，显示器或 DPI 变化后会保持在可见区域。“更多”控制在可关闭的独立浮层中打开，失焦、小组件移动、缩放或关闭时会自动收起，且始终不会改变小组件尺寸；透明度可在 0%–100% 间调整且只影响背景，文字和图标始终清晰。面板只保留置顶、透明度、重置位置和关闭，支持鼠标、触屏、键盘与 Esc。背景色、字体色和强调色位于“设置 > 桌面小组件”，旧版外观偏好会迁移一次，默认强调不再使用荧光绿色。

## 2026-07-10 · Desktop widget interaction and responsive layout rebuild

### Fixed
- The desktop widget now uses a more compact 500 × 88 default and reset size, with smaller muted status text, larger task titles and times, and no project-color footer. The window supports native edge resizing and remembers its bounds; increasing the window height enough switches it to a two-row layout, while display or DPI changes keep it visible. More controls open in a separate dismissible popover that automatically closes when focus leaves or the widget moves, resizes, or closes, and never changes the widget size. Opacity adjusts only the background from 0% to 100%, keeping text and icons unaffected and clear. The panel is reduced to always-on-top, opacity, reset position, and close, with mouse, touch, keyboard, and Escape support. Background, font, and accent colors live under Settings > Desktop Widget, legacy appearance preferences migrate once, and the default accent no longer uses neon green.

## 2026-07-08 · 设置页统一迁移、模板弹窗按钮归位、候选列表间距精简与模板页排版收紧

### 新增
- 设置页改为左侧分类栏 + 右侧内容的统一布局，分类包括：通用、外观、执行、规划、模板、习惯、指标、桌面小组件、数据与备份、快捷键、Navo AI、MCP、插件、账户、高级。所有设置项复用同一套「设置行」原语（标题 + 说明 + 开关 / 下拉 / 输入 / 按钮），视觉节奏与纸面风格一致，不再每个分区各写一套行样式。
- 新增「模板」功能开关：关闭后今日候选顶栏的「模板」入口隐藏，模板设置子项同步禁用。
- 新增「指标视图」功能开关：关闭后规划页的「指标」视图入口隐藏，指标设置子项同步禁用；若当前正停在指标视图，会自动回落到树状视图，不会渲染被关闭的视图。
- 新增「数据与备份」分类：把导出 JSON / 导出 CSV / 导入 JSON / 导入任务 CSV 集中到一处，并新增「清空本地数据」——需输入 DELETE 确认，仅清除本地浏览器 / 桌面端数据，保留云端登录态。
- 新增「高级」分类与「重置所有设置」：把所有设置项恢复为默认值（任务、项目、习惯、时间记录等数据不受影响），操作前需二次确认。

### 修复
- 修复桌面端检测不到最新小组件改动的问题：桌面自动更新只读取 GitHub Release 中的 `latest.yml`，不会读取 `main` 或 `release` 分支；现在新增 tag 触发的桌面发布流程，并将版本推进到 1.2.34，确保安装包和更新清单随正式 tag 自动发布。
- 修复设置页下拉选项文字被裁切、开关状态看不清的问题：下拉控件此前误带了为「包裹层」设计的 `df-utility-select` 类（强制 50px 高度与大内边距），导致原生 `<select>` 被撑成空白窄条，中文选项（如「今日」「本月」「开启」「关闭」）只露出一半。现已将下拉改为独立原生控件，统一 36px 高、132–220px 宽、14px 字号，并自绘下拉箭头不压住文字；开关由 34×18 加大为 44×24，关闭态使用浅纸灰轨道（不再是空白小框）、开启态使用 sage 点缀色并右移旋钮，disabled 与 focus 状态均清晰可辨；设置行右侧控件区固定 140px 最小宽度，文字不再挤压控件。
- 设置页开关改为手绘纸面质感：关闭态用深砖红（`#8E4B46`）填充、开启态用深橄榄绿（`#5D7A52`）填充，两种填色均叠加多层细密径向颗粒与轻微纵向阴影，模拟彩铅/蜡笔在纸面上的涂色感，而非扁平纯色块；滑块保持浅纸白色与清晰描边，与填充分离明显；hover 略加深外框与填色、active 有轻微压下感、focus 保留键盘可访问的细环、disabled 降透明度但仍能看出开/关。新增 `--toggle-off-fill` / `--toggle-on-fill` 等 token 供后续统一。
- 设置页开关的圆形滑块（thumb）也按状态着色：关闭态滑块用更亮的砖红 `#A85A50`、开启态用更亮的橄榄绿 `#6F9464`，并配同色系深描边，使滑块本身成为状态指示，而非纯白圆圈；track 叠加一层极淡的斜向 hatch（`::before`，opacity .26）作为蜡笔纸面纹理，状态一眼可辨。新增 `--toggle-off-thumb` / `--toggle-on-thumb` token。
- 修复模板弹窗底部「取消」「应用到今天」等按钮看起来消失或错位的问题：底部操作栏此前使用 4 列网格，按钮数量不足 4 个时取消会占据 1fr 列拉伸至整行、应用落在中间而非右下角。改为 flex 布局并右对齐操作组，取消 / 保存 / 应用到今天始终锚定在右下角。
- 修复模板弹窗右侧时间轴与执行页布局不一致的问题：模板时间轴此前缺少执行页的 `df-timeline-body` > `df-timeline-content` 弹性包裹层。现在使用与执行页完全相同的 `df-timeline-panel` > `df-timeline-body` > `df-timeline-content` > `df-timeline-daily` 包裹层级。
- 移除「今日候选」任务列表顶部多出的虚框占位区域：候选面板中「正在做」卡片与第一条任务之间此前夹着一个已废弃的 AI 规划按钮容器（`df-candidate-ai-planner-legacy`，内联 `display:none` 但仍渲染在 DOM 中），在部分环境下会撑出额外高度并呈现为虚框/落点占位。现已将该废弃容器从 JSX 中彻底删除，并将卡片底部外边距由 4px 调整为 7px，使卡片到首条任务的间距与任务卡之间的间距一致（均为 14px）。
- 修复未拖拽时今日候选任务块底部仍可能出现虚块的问题：候选排序的插入指示线（`.df-list-insertion-line`，2px 高脉冲条）此前仅以 `candidateDropTarget` 作为渲染条件，未显式断言当前有指针拖拽在进行，存在状态泄漏时残留占位的风险。现在四处渲染点（分组/平铺的前/后插入线）均要求 `drag.source === "candidate"` 同时成立才渲染，并新增以 `body:not(.df-timeline-pointer-drag)` 为条件的防御性 `display:none` 兜底（仅在 `beginShelfDrag`/`beginBlockDrag` 活动期间才会给 body 加上该类），确保未拖拽时插入线完全不占布局空间；同时清理了无 JSX 引用的 `.df-candidate-task-new` 旧虚框样式。拖拽中的插入线与候选排序、候选到时间轴的拖放均不受影响。
- 修复今日候选任务卡之间出现淡色背景块、间距被撑大的问题：每个候选任务卡外层包裹的 `.df-candidate-task-row` 此前带有 `padding: 7px 8px`，加上任务卡自身全局样式里的 `margin-bottom: 6px`，在两张白色任务卡之间形成约 20px 的纸色面板底色带，在部分屏幕上读起来像淡红/粉红色块。现将外层 wrapper 的 padding/margin/background/border 全部清零（`padding:0; background:transparent; border:0`），并中和候选列表内任务卡的 `margin-bottom`，改由 `.df-candidate-list` 的 `display:flex; flex-direction:column; gap:6px` 统一控制间距；分组模式下 `.df-project-group` 同样改为 flex+gap。任务卡自身的背景、边框、圆角、左侧项目色条、checkbox、标题、时长、按钮均未改动，右侧时间轴不受影响。
- 修复今日候选任务卡外侧仍露出淡粉/淡红面板底色的问题：经运行时 DOM 与 computed style 检查，真实元素不是 placeholder/drop zone/selected state，而是 `.df-candidate-panel` 的纸面背景透过透明 `.df-candidate-task-row` 暴露出来；原因是 `.df-task-card` 在 flex row 中按内容收缩，未填满整行。现在候选列表内的任务卡设为 `flex: 1 1 auto; width: 100%; min-width: 0`，外层 wrapper 继续只做结构容器、不参与视觉，卡片外侧不再露出额外色块，项目色左侧细条和拖拽插入线保持不变。

### 改进
- 桌面置顶小组件的「更多」菜单进一步收敛为简约设置面板：保留关闭小组件、切换置顶、背景颜色、透明度、字体颜色、强调颜色、恢复默认外观与重置位置；背景、透明度、字体和强调色会即时生效并持久化到小组件本地设置中。
- 未实现的设置项（如默认任务时长、点击空白创建任务、拖拽吸附间隔、桌面小组件的显示正在做 / 快速添加 / 计时器 / 紧凑模式、开发者模式等）统一显示为「即将支持」禁用行，不再出现只改 UI 不接实际状态的假开关。
- 原「页面」「功能」两个旧分区已移除，内容按真实归属迁移到通用 / 外观 / 执行 / 规划 / 模板 / 习惯 / 指标 / 桌面小组件等新分类；旧版本持久化的分区标识会自动映射到对应新分类，不会落到空白面板。
- 收紧执行页左侧「今日候选」任务卡之间的垂直间距：候选行垂直内边距由 9px 调整为 7px，卡片间视觉间隙从约 18px 收紧到约 14px，列表更紧凑但不拥挤。
- 删除「习惯」标题旁的小方形设置按钮：该按钮此前与卡片点击打开习惯总览重复，现从 JSX 中彻底移除（非隐藏），不留空白占位；同时将「习惯」标题字重由 650 提升至 700，与面板标题体系更统一，但不抢过任务卡标题。
- 模板页左侧列表支持拖动排序：抽出通用 `usePointerReorder` hook，镜像今日候选 `beginShelfDrag` 的指针捕获 / 5px 阈值 / 半高度前后判定 / 源占位 / 插入线 / 点击抑制手感，模板列表通过 `selector` + `attrName` + `onReorder` 接入，不再维护第二份拖拽代码。仅自定义模板可拖动（内置模板与草稿行不可拖），松手后通过既有 `onSaveCustomTemplates` 持久化新顺序；拖拽中按 Esc 可取消，拖拽释放不会误触发模板选中。
- 收紧模板页信息密度与标题层级：左侧模板卡片名称字重提升至 700、副信息保持 400；右侧时间轴模板块标题字重由 600 提升至 700；顶部当前模板名由 500/12px/弱化色提升为 600/13px/主文本色，更像标题层级但不抢过面板标题。同时去掉冗余时间文字——右侧时间轴块不再显示「08:00-08:45」区间（时间范围已由方块在网格上的位置与高度表达），左侧模板卡片与顶部名称栏不再显示「08:00–20:15」起止跨度，仅保留「8 个时间段」摘要。
- 重做模板页「新建模板」入口：原先的 `CandidateBlock mode="template-new"` 看起来像第三张模板卡，现替换为更小、更窄、横向居中的独立添加按钮（虚线细边框、`+` 图标 + 「新建模板」文案、hover 轻微纸色反馈），不再显示「创建一个空白模板」长说明，视觉上像「添加习惯 / 添加任务」那样的轻操作入口而非大面积空卡片。
- 桌面置顶小组件改为横向极简「当前任务条」：移除品牌名、WORKING / QUICK ADD 分区、多区块面板与表单式输入框主体，改为单行卡片——「正在做」状态（项目色加粗）+ 当前任务名（超长省略）+ 计时 + 播放/暂停 + 更多按钮，底部一条当前项目色高亮线。窗口改为无边框透明悬浮卡（无 File/Edit/View 菜单栏、紧凑长条尺寸），关闭 / 切换置顶 / 快速添加 / 重置位置全部收进「⋯」更多菜单；菜单内新增透明度（60%–100%）、时间颜色、任务名颜色三项偏好，点击即时生效并持久化在小组件本地，下次打开保留。无任务时仍保持横条布局，状态显示「空闲」、播放按钮禁用。

## 2026-07-08 · Settings page unified migration, template modal footer fix, candidate list spacing refinement, and template page polish

### Added
- Settings page rebuilt as a left-sidebar category list + right content pane. Categories: General, Appearance, Execution, Planning, Templates, Habits, Metrics, Desktop Widget, Data & Backup, Shortcuts, Navo AI, MCP, Plugins, Account, Advanced. Every setting row reuses one unified SettingRow primitive (title + description + toggle / select / input / button) so the paper-style rhythm stays consistent — no section hand-rolls its own row markup.
- New Templates feature toggle: when off, the Templates button in the today-candidate header is hidden and the template sub-settings are disabled.
- New Metrics view toggle: when off, the Metrics entry in the planning-page view switcher is hidden and the metrics sub-settings are disabled. If you are currently on the metrics view when you disable it, the view falls back to the tree view instead of rendering a gated mode.
- New "Data & Backup" category: consolidates Export JSON / Export CSV / Import JSON / Import Tasks CSV into one place, and adds "Clear local data" — requires typing DELETE to confirm, wipes only local browser / desktop data and preserves the cloud sign-in session.
- New "Advanced" category with "Reset all settings": restores every setting to its default (tasks, projects, habits, and time entries are unaffected), with a confirmation dialog before applying.

### Fixed
- Fixed desktop update checks not detecting the latest widget changes: the desktop updater reads `latest.yml` from GitHub Releases, not the `main` or `release` branches. A tag-triggered desktop release workflow now publishes installer assets and the update manifest for version 1.2.34.
- Fixed settings-page dropdown options being clipped and toggle state being unreadable: the select control was incorrectly carrying the `df-utility-select` wrapper class (which forces a 50px height and large padding), turning the native `<select>` into a blank narrow sliver where Chinese options (e.g. Today / This month / On / Off) only showed half. The select is now a standalone native control with a unified 36px height, 132–220px width, 14px font, and a self-drawn arrow that never overlaps the text; the toggle grew from 34×18 to 44×24, with a muted paper track in the off state (no longer an empty box), a sage accent in the on state with the knob shifted right, and clearly distinguishable disabled / focus states; the row's control column now has a stable 140px min-width so labels never squeeze the control.
- Settings toggle restyled as a hand-drawn paper switch: the off state now fills with a deep brick red (`#8E4B46`) and the on state with a deep olive green (`#5D7A52`), each overlaid with layered fine radial speckle and a soft vertical shade so it reads as colored pencil / crayon on paper rather than a flat SaaS pill; the thumb stays paper-white with a clear border so it separates cleanly from the fill; hover slightly deepens the border and fill, active gives a faint press, focus keeps a thin accessible ring, and disabled dims while still showing on/off. New `--toggle-off-fill` / `--toggle-on-fill` tokens added for reuse.
- Settings toggle thumb now also takes the state color: the off thumb uses a brighter brick red (`#A85A50`) and the on thumb a brighter olive green (`#6F9464`), each with a same-hue dark border, so the thumb itself signals the state instead of reading as a plain white circle; the track gains a very faint diagonal hatch (`::before`, opacity .26) for a crayon / paper tooth so the state is unmistakable at a glance. New `--toggle-off-thumb` / `--toggle-on-thumb` tokens added.
- Fixed the template modal footer buttons (Cancel / Apply to Today) appearing missing or misaligned: the footer previously used a 4-column grid, so when fewer than 4 buttons were present Cancel stretched across the 1fr column and Apply landed in the middle instead of the bottom-right. Switched to a flex layout with a right-aligned action group so Cancel / Save / Apply to Today always anchor to the bottom-right.
- Fixed the template modal right-side timeline not matching the execution page layout: the template timeline was missing the execution page's `df-timeline-body` > `df-timeline-content` flex wrapper. It now uses the exact same `df-timeline-panel` > `df-timeline-body` > `df-timeline-content` > `df-timeline-daily` wrapper hierarchy as the execution page.
- Removed the stray dashed placeholder box at the top of the today-candidate list: a deprecated AI-planner button container (`df-candidate-ai-planner-legacy`, inline `display:none` but still in the DOM) sat between the "Doing now" card and the first task and could stretch into a dashed drop placeholder in some environments. The deprecated container is now deleted from the JSX, and the card's bottom margin was adjusted from 4px to 7px so the gap to the first task matches the 14px gap between task cards.
- Fixed a faint ghost block that could still appear under today-candidate task cards when not dragging: the candidate-reorder insertion line (`.df-list-insertion-line`, a 2px pulsing band) was previously gated only on `candidateDropTarget`, without explicitly asserting that a pointer drag was actually in progress, so a leaked state could leave a placeholder occupying space. All four render sites (grouped / flat × before / after) now require `drag.source === "candidate"` as well, and a defensive `display:none` fallback keyed on `body:not(.df-timeline-pointer-drag)` was added (that body class is only present while `beginShelfDrag` / `beginBlockDrag` is active), guaranteeing the insertion line takes zero layout space when nothing is being dragged. The unused `.df-candidate-task-new` dashed-box styles were also removed. The in-drag insertion line, candidate reorder, and candidate-to-timeline drop are all unaffected.
- Fixed a faint background block appearing between today-candidate task cards that pushed them apart: the `.df-candidate-task-row` wrapper around each card carried `padding: 7px 8px`, and combined with the task card's own global `margin-bottom: 6px` this created a ~20px band of panel surface between two white cards that read as a light red / pink block on some displays. The wrapper's padding / margin / background / border are now all zeroed (`padding:0; background:transparent; border:0`), the card's `margin-bottom` is neutralized inside the candidate list, and spacing is instead controlled by `.df-candidate-list { display:flex; flex-direction:column; gap:6px }`; in grouped mode `.df-project-group` also uses flex+gap. The card's own background, border, border-radius, left project accent stripe, checkbox, title, duration, and buttons are all untouched, and the right timeline is unaffected.
- Fixed the remaining pale pink/red panel surface showing outside today-candidate task cards: runtime DOM and computed-style inspection showed the real element was not a placeholder, drop zone, selected state, or drag residue. It was the `.df-candidate-panel` paper background showing through the transparent `.df-candidate-task-row` because the `.df-task-card` flex child was shrinking to content width instead of filling the row. Candidate-list task cards now use `flex: 1 1 auto; width: 100%; min-width: 0`, keeping the outer wrapper structural and invisible while preventing exposed side blocks. The project-color left rule and in-drag insertion line behavior are unchanged.

### Improved
- Desktop always-on-top widget "More" menu refined into a minimal settings panel: Close widget, Toggle always-on-top, Background color, Opacity, Font color, Accent color, Reset appearance, and Reset position. Background, opacity, font, and accent changes apply instantly and persist in widget-local settings.
- Unimplemented settings (e.g. default task duration, click-blank-to-create-task, drag snap interval, widget show-current-task / quick-add / timer / compact mode, developer mode) now render as disabled "Coming soon" rows instead of fake toggles that only change UI without wiring real state.
- The legacy "Page" and "Features" sections are removed; their contents are migrated to the new categories by real ownership. Persisted section ids from older builds are auto-mapped to the matching new category so they never land on an empty panel.
- Tightened the vertical spacing between today-candidate task cards on the execution page: candidate row vertical padding went from 9px to 7px, reducing the visual gap from ~18px to ~14px for a denser but not cramped list.
- Removed the small square settings button next to the "Habits" heading: it duplicated the card-click action for opening the habit overview and is now deleted from the JSX (not hidden) with no empty placeholder left behind. The "Habits" heading font-weight was also raised from 650 to 700 to better match the panel title hierarchy without overpowering task card titles.
- Template page left list now supports drag-to-reorder: a shared `usePointerReorder` hook was extracted, mirroring the today-candidate `beginShelfDrag` feel (pointer capture, 5px threshold, half-height before/after judgment, source placeholder, insertion line, click suppression). The template list plugs in via `selector` + `attrName` + `onReorder`, so no second drag codebase is maintained. Only custom templates are draggable (built-in templates and the draft row stay anchored); on drop the new order is persisted through the existing `onSaveCustomTemplates` path; Escape cancels an in-flight drag, and a drag release no longer misclicks a template.
- Tightened the template page information density and title hierarchy: the left-list template name went to font-weight 700 while the meta line stays at 400; the right-timeline period title went from 600 to 700; the top current-template name went from 500 / 12px / muted to 600 / 13px / main text color so it reads as a header without overpowering the panel title. Redundant time strings were also removed — right-timeline blocks no longer show "08:00-08:45" (the range is already expressed by the block's position and height on the grid), and left-list cards and the top name bar no longer show the "08:00–20:15" span, keeping only the "8 time slots" summary.
- Redesigned the template page "New template" entry: the previous `CandidateBlock mode="template-new"` looked like a third template card, so it is now a smaller, narrower, horizontally-centered standalone add button (thin dashed border, `+` icon + "New template" label, faint paper-tint hover) — the long "create a blank template" description is gone, and the entry reads like a light "add habit / add task" action rather than a large empty card.
- Redesigned the always-on-top desktop widget into a minimal single-row "current task strip": the brand name, WORKING / QUICK ADD sections, multi-block panel body, and inline form input are gone. The strip now shows a "Working" status (bold, project color) + the current task title (ellipsis when long) + the timer + a play/pause button + a "more" button, with a thin project-color accent line along the bottom. The window is now a frameless transparent floating card (no File/Edit/View menu bar, compact strip dimensions); Close / Toggle always-on-top / Quick add / Reset position all moved into the "⋯" more menu, which also adds three new widget-local preferences — Opacity (60%–100%), Time color, and Task-title color — applied instantly and persisted so they survive reopen. With no active task the strip layout is preserved, the status reads "Idle", and the play button is disabled.

## 2026-07-07 · 模板模式重构为时间轴编辑器、时间轴无限滚动与现在线修复、指标圆环图标注优化与桌面小组件

### 修复
- 修复打开「日程模版」时应用白屏的问题：`ScheduleTemplateModal` 中 `const zh = lang === "zh"` 声明在 `useState` 之后，而 `useState<TemplatePeriod[]>(() => makeBuiltInPeriods("school"))` 的初始化函数在挂载时立即执行，调用链 `makeBuiltInPeriods → slotToPeriod` 引用了 `zh`，触发 `ReferenceError: Cannot access 'zh' before initialization`（暂时性死区），React 树崩溃白屏。已将 `zh` 声明移到所有 `useState` 之前。
- 修复开启无限跨天滚动后应用启动直接白屏的问题：连续时间轴的滚动监听在 effect 初始化时立即调用 `updateVisibleTimelineDate()`，此时 `scrollTop=0` 满足"接近顶部"条件，立刻触发 `setSelectedDate` 日期位移；如果时间轴容器尚未完成布局（`scrollHeight ≤ clientHeight`），`useLayoutEffect` 的 `scrollTop` 补偿会被钳制为 0，rAF 释放锁后 effect 重跑再次触发位移，形成"Maximum update depth exceeded"无限循环导致白屏。现在将标签更新与 prepend/append 逻辑分离——effect 初始化只更新可见日期标签、不触发位移，prepend/append 仅在真实滚动事件中执行，并增加 `scrollHeight ≤ clientHeight` 守卫跳过不可滚动容器，彻底消除启动时的状态反馈循环。
- 修复开启无限跨天滚动后日/3 天/周时间轴向上滚动到画布顶部即触底、无法继续加载前几天的问题：此前连续时间轴是一个以选中日为中心的固定窗口（日 7 天、3 天 21 天、周 49 天），滚动监听只更新顶部日期标签而不滑动窗口。现在滚动接近顶部时自动向前 prepend 一段日期、接近底部时向后 append 一段日期，并通过 `useLayoutEffect` 在窗口重算后按位移波段补偿 `scrollTop`，视口不跳动；任务拖拽/调整时长/候选拖入仍基于重算后的连续坐标，落点不受影响。
- 修复关闭无限跨天滚动后"现在"时间线在日/3 天/周视图中不显示或位置错误的问题：`NowLine` 组件以 `style={{ top, ...extraStyle }}` 合并样式，非连续模式下 `extraStyle.top` 为 `undefined`，展开后覆盖了组件内部按 `dayStartHour` 计算出的 `top`，导致绝对定位失效。改为显式合并——仅当 `extraStyle` 未提供 `top` 时才使用内部计算值，连续模式仍由 `continuousTimedTop` 接管，非连续模式恢复正确的日间偏移位置。
- 重构指标视图甜甜圈图外部标注为紧凑的两段式引线 + 侧标 annotation 系统，且每个项目默认常驻显示外部项目名：圆环外缘短径向 tick（outer+34 折点）接 42px 水平段，项目名贴在线末端外侧（右侧 start、左侧 end），字号 12px/600，引线 1.5px、22% 半透明灰（激活 36%），整体回归安静的数据图表标注风格。项目名是常驻 annotation 而非 hover tooltip——圆环中出现的每个项目（含"日常""文书"等小扇区）默认都有外部项目名，不再有"占比 ≥6% 或前 5 名才显示、其余 hover 才出现"的过滤逻辑；同侧标签做一次 Y 排序避让（minGap 20px），若整列溢出则整体上移再 clamp 到图表安全区内，保证全部标签可见、不隐藏、不飞到边缘。右侧指标摘要删除"最高投入/Top focus"一项（与圆环图和列表重复），仅保留已安排时间、未安排时间、任务数量、完成率；圆环中心悬停态移除彩色圆点，仅保留项目名、时长与百分比。hover 只负责当前扇区外径轻微扩展、中心文字切换、当前 label/引线轻微高亮，不让其他项目名消失或重排。

### 改进
- 重构「模板模式」为执行页时间轴的模板态：今日候选顶栏的「日程模版」按钮打开的不再是表格编辑器，而是左侧模板列表 + 右侧模板时间轴的两栏编辑器。左侧列表展示默认 1 / 默认 2 / 自定义模板与「+ 新建模板」，每行显示模板名、时间段数量与时间跨度（如 `8 个时间段 · 08:00–17:20`），支持选择、行内重命名、复制、删除；右侧时间轴以执行页 15 分钟槽位网格呈现，点击空白创建时间段、拖动方块移动、拖动上下边缘调整时长、点击方块编辑标题、右上角删除。时间段仅存储 `{标题, 起始分钟, 时长}`，不写入真实任务数据；点击「应用到今天」才按选中日期把不冲突的时间段写入当天时间轴（默认跳过与现有安排重叠的时间段并提示冲突数）。原有「加入当天」勾选列、「当天目标」列、「新增 Period」「恢复当前模板」工具栏与表格行编辑器已移除，对应旧版表格与列表/时间轴 UI 的残留样式也一并清理。`ScheduleTemplate` / `ScheduleTemplateSlot` 数据结构与 `applyTemplateToDate` 流程保持不变，已保存模板可继续复用。模板弹窗与执行页现在共用同一套真实 React 组件（而非仅共享 CSS 类）：抽出 `ExecutionLayoutShell`（`<main class="df-execute">` 网格）、`CandidatePanelShell`（`<section class="df-candidate-panel">`）、`CandidatePanelHeader`（`<div class="df-panel-title">`）、`CandidateBlock`（基于 `TaskBlock variant="candidate"` 的列表行原语）、`TimelineCanvas`（`df-timeline-scroll` + `df-timeline-canvas` 滚动画布容器）、`TimelineEventBlock`（基于 `TaskBlock variant="scheduled"` 的时间块原语，含 resize 点/正文/删除）六个共享组件，执行页与模板弹窗均直接渲染这些组件——执行页日视图的时间轴不再内联 `df-timeline-scroll`/`df-timeline-canvas` 的 JSX，而是与模板弹窗一样调用 `<TimelineCanvas>`；模板列表项不再使用自定义 `df-candidate-task-row`，而是 `<CandidateBlock mode="template">`；模板时间段块不再内联 `TaskBlock` 包装 JSX，而是 `<TimelineEventBlock mode="template">`。列宽、间距、边框、滚动行为、纸面背景全部由共享组件统一决定，不再保留任何模板专属左右布局样式（`df-template-split` / `df-template-candidate` / `df-template-timeline-panel` 与巨大标题区已删除）。模板名仅以一行紧凑 name bar 出现在时间轴面板顶部，不再有独立大标题与说明文字。同时引入 `TimelineAdapter<T>` 接口与 `templatePeriodAdapter` 实现，将模板时间段草稿数据与真实任务 store 隔离，模板编辑不污染当天任务，只有应用后才生成真实 scheduled tasks；模板拖拽/调整时长保留独立的 `beginPeriodDrag`（操作草稿而非真实任务），与执行页 `beginBlockDrag` 通过 adapter 契约隔离，是刻意的数据边界而非遗漏复用。
- 新增桌面端置顶小组件：真正的 Electron `BrowserWindow`（`alwaysOnTop`、`frame`、可拖动、可调整大小、记住位置），通过 `?widget=1` 路由渲染独立的 `WidgetApp` 而非完整 App，不启动 Supabase 登录/数据加载。小组件为纯 IPC 客户端——不持有任何任务数据，所有状态由主窗口 React store 维护并通过 IPC 中继同步：小组件发动作（快速添加、计时开始/暂停/继续/保存、完成、置顶切换、重置位置）经主进程转发到主窗口执行，主窗口将 `WidgetSnapshot`（当前任务、计时、候选数量、语言、置顶设置）推送给小组件。小组件本地每秒 tick 计时显示并在快照到达时对齐。入口在候选区面板标题栏的图标按钮（仅桌面端、且功能开关开启时显示）；设置 > 功能新增"启用桌面小组件""小组件始终置顶""启动时自动打开"三项开关。快速添加默认未归属项目、加入今日候选，与主窗口共用同一 store，不引入独立假数据。视觉为 NavoPath 纸感风格（暖白底、细边框、克制阴影、紧凑按钮），无 dashboard/glow 感。移动端与纯 Web 环境不显示入口。
- 指标视图新增"全部"时间范围选项，可统计所有时间内的项目时间占比与任务完成情况，不再局限于今天/昨天/本周/上周/本月/自定义；同步补全 `MetricRangePreset` 类型与对应日期范围计算逻辑。
- 将模板弹窗与执行页共享的六个布局组件抽到独立模块 `src/components/ExecutionSharedLayout.tsx`，通过真实的 ES-module `import` 强制复用，而非靠同文件作用域：`src/main.tsx` 第 54 行 `import { ExecutionSplitLayout, CandidatePanelShell, CandidatePanelHeader, CandidateBlock, TimelineCanvas, TimelineEventBlock } from "./components/ExecutionSharedLayout"`，执行页 `App` 与 `ScheduleTemplateModal` 都引用同一组导入绑定。原先定义在 `main.tsx` 末尾的六个本地函数（`ExecutionLayoutShell` 等）已删除，`ExecutionLayoutShell` 同步更名为 `ExecutionSplitLayout`。每个共享组件渲染 `data-reuse` 属性（`execution-split-layout` / `candidate-panel-shell` / `candidate-panel-header` / `timeline-canvas` / `timeline-event-block`），打开模板弹窗后可在 DOM 中验证复用组件确实在树上。模板拖拽/调整时长仍保留独立的 `beginPeriodDrag`（操作草稿而非真实任务），与执行页 `beginBlockDrag` 通过 `TimelineAdapter<T>` 契约隔离——这是刻意的数据边界，不是遗漏复用。
- 完成模板弹窗与执行页的视觉一致性（Visual Parity）修复：删除模板专属的时间轴网格 CSS 覆盖（`.df-template-shell .df-slot`、`.df-template-shell .df-timeline-canvas`），让模板时间轴直接使用执行页的全局 CSS——小时网格来自 `.df-timeline-canvas` 的 `repeating-linear-gradient` 背景，小时标签位于左侧 gutter（`.df-slot span { left: -56px }`，滚动容器的 `padding-left: 56px`），画布边框来自全局 `border-left`。模板时间轴现在渲染全部 96 个槽位（小时 + 刻钟 + major），与执行页日视图的槽位结构完全一致，不再只渲染 25 个小时槽。模板时间段块的定位从 `left: 56px` 改为 `left: 8px`（与执行页 `baseLeft` 一致），让方块坐在内容区而非避让画布内的标签。模板弹窗外框（`.df-template-modal`）仅提供 overlay、关闭按钮和底部操作栏，主体布局完全由 `<ExecutionSplitLayout>` 控制——列宽、间距、边框、滚动行为、纸面背景全部来自共享组件，弹窗外框不再控制左右分栏。

## 2026-07-06 · 习惯总览重构与功能开关

### 修复
- 修复从今日候选拖拽任务到时间轴时时间轴画面跳动、落点不准、垂直位移的问题：候选→时间轴拖拽此前仍走单日 `getDropTargetFromPointer`，在无限跨天滚动下会按 X 列推断日期、并把时间钳制在画布首日，导致预览块和最终排程落在错误日期/时间；同时拖拽经过时间轴边缘时会持续改写 `scrollTop`，造成画面垂直漂移。现已改用与时间轴事件拖拽相同的 `resolveDropTarget`（连续模式下按 Y 波段推断日期），并移除候选拖拽过程中的自动滚动，拖拽期间不再改写时间轴位置或当前日期，落点与预览完全跟随指针。时间轴事件本身的拖拽/调整时长不受影响。
- 修复关闭无限跨天滚动后“现在”时间线在 3 天/周视图中消失的问题：多日视图分支的 `NowLine` 此前未传入 `dayStartHour`，在非连续模式下会回退到以午夜为原点计算纵向位置，当用户设置了非零的“一天开始时间”时，现在线会偏移到可见滚动区域之外。现已传入正确的 `dayStartHour`，并补充了“今天是否在已渲染日期范围内”的守卫，确保连续与非连续模式下今天可见时现在线都能正确出现。
- 修复开启无限跨天滚动时日时间轴在一天底部强制切换日期并重置滚动位置的问题；日、3 天和周视图现在按连续垂直画布呈现前后日期，可继续向上滚动，顶部日期跟随当前时间轴窗口更新，跨天边界统一显示为 `0:00`，不再出现 `24:00` 或翻页式跳转；“回到现在”会在跨日滚动离开今天时出现，并把当前时间线居中。
- 修复无限跨天滚动后时间轴任务拖放与调整时长失效的问题：拖动/调整现在使用连续绝对分钟坐标（指针 Y + 当前画布几何 → 日期 + 时间），不再按单日 X 列推断日期。跨午夜拖动（如 23:30 拖到次日 00:30）会正确切换到第二天且保持原时长；跨午夜向下拉长（23:30/30m 拉到次日 00:30）会得到 60m 时长而非崩溃。短任务（15m/30m）仍按原像素高度渲染，标题/项目/完成状态在拖动与调整时长过程中保持不变。
- 修复指标视图甜甜圈图悬停效果错误的问题：此前悬停时段使用 `translate` 整体向外平移，导致内圈与外圈一起位移、中心孔变形。现在悬停时仅扩大外半径（88 → 94），内半径保持不变，中心孔大小不受影响，段块呈现为向外生长而非整体平移或缩放。
- 修复指标视图甜甜圈图 hover 命中区域过大、引线太平、项目名位置不对、中心文字错位的问题：hover 命中区域从 `bounding-box`（整个扇形包围盒，包括中心洞和外部空白）改为 `visiblePainted`（仅填充的弧形扇区本身可触发 hover），引线和标签设为 `pointer-events: none`，`onMouseEnter`/`onMouseLeave` 只绑在 arc path 上，不再绑到 svg/g/container；SVG viewBox 改为以圆环中心对称（`-70 0 380 240`），中心文字严格对齐圆环几何中心；引线径向段加长（elbow 半径 108 → 128），项目名放在水平段上方。
- 修复指标视图甜甜圈图悬停时出现原生黑色 tooltip、项目名不够贴合引线、引线斜向段仍太平的问题：删除了 segment path 上的 `<title>` 元素，不再触发浏览器原生 tooltip，悬停只影响扇区外径扩展和中心文字切换；引线 elbow 半径从 128 增至 148，水平段距离从 165 缩至 158，斜向段更明显、折角更清晰；项目名紧贴水平段上方（y 偏移从 -4 减至 -2，dominantBaseline 改为 alphabetic），像标注文字一样贴合引线。
- 修复指标视图甜甜圈图外部项目名位置不对的问题：项目名此前锚定在水平段末端（p2），看起来像是贴在水平线左侧/右侧末端的标签，而非"标注在水平线上方"。现在项目名锚定在水平段（p1 折点 → p2 末端）的中点，配合 `text-anchor: middle`，左右两侧项目名都严格居中于水平段正上方，像标注文字一样压在水平线上方，不再偏到线的末端外侧。
- 优化指标视图甜甜圈图外部标注：项目名垂直位置统一为水平段上方 8px（`labelY = p1.y - 8`），与水平段保持稳定呼吸距离，不再贴线或飘忽；外部引线描边从 1px 加粗至 1.5px，颜色仍为柔和中性灰（80% 纸面规则色），更清晰稳定但不抢眼，保持 NavoPath 安静纸面风格。
- 重做指标视图甜甜圈图 hover 判定为分层结构：将视觉圆环与命中层分离——新增透明饼形命中层（`pieSectorPath`，innerRadius=0，outerRadius=96），每个项目扇区从圆心延伸到外缘，鼠标在圆环中心空洞区域内也会按角度归属到对应项目（右侧中心 → 右侧项目，左下中心 → 左下项目，左上中心 → 左上项目）；视觉弧层、引线、标签、装饰圈与中心文字全部设为 `pointer-events: none`，事件穿透到命中层；命中层外缘不超过视觉外径+2px，外部空白区域不会误触。hover 时仍仅扩大当前扇区外半径（88→94），内半径不变。
- 修复指标视图甜甜圈图悬停时鼠标光标在 pointer 和 default 之间抽搐闪烁的问题：根因是多个 SVG 元素（视觉弧、命中扇区、引线、标签）各自接收指针事件，鼠标在不同元素边界移动时 cursor 反复切换。现改为单一透明命中圆盘（`<circle r=98>`）置于最顶层统一处理所有 `onPointerMove` / `onPointerLeave` / `onClick`，其余 SVG 元素全部 `pointer-events: none`；hover 通过指针相对圆心的角度计算（`atan2 → 极角 → 扇区匹配`），不再依赖多个 path 互相抢事件；光标仅在命中圆盘上为 pointer，离开后回到 default，不再抖动。
- 修复指标视图甜甜圈图外部项目名位置仍偏移的问题：此前水平段长度仅 10px（elbow 半径 148 与 labelDistance 158 几乎相等），导致水平段过短、项目名实际锚点仍贴近 p2 末端。现改为按项目名长度驱动水平段长度（`horizontalLength = max(128, label.length * 16)`），p1 折点固定在 `visualOuter + 52`，p2 为 `p1.x ± horizontalLength`，项目名锚定在 `(p1.x + p2.x) / 2`、`p1.y - 8`、`text-anchor: middle`，左右两侧项目名都严格居中于水平段正上方，水平线像托住项目名的标注线。

### 改进
- 重做指标视图甜甜圈图为带引线的环形图：仍为一张整体甜甜圈图，每个色段代表一个项目；段块外侧通过两段式引线（径向段 + 水平段）只标注项目名，项目名放在水平段上方；百分比/时长不再出现在外部引线旁；中心默认显示总安排时长与范围标签，悬停某段时切换为当前项目的颜色点、名称、时长与百分比；右侧排名列表与 tooltip 仍提供完整 duration / percentage / task count。悬停时段块仅外径扩大、内径不变。
- Planning 页面新增“指标”视图，以已安排/计划时间为分母统计项目时间占比，提供今天/昨天/本周/上周/本月/自定义范围、项目 donut、排名列表、时间密度热力图、任务下钻明细与 Linear 风格筛选；未安排时间作为辅助指标单独显示，习惯默认参与统计，跨天任务按实际重叠切分，并尊重“一天开始时间”设置。
- 重做“习惯总览”面板：从一堆带边框的小方块改为结构化周视图表格，左列习惯名 + 右侧七天圆形完成单元，行与表头严格对齐，更像一张干净的纸面周表。
- 顶部控制区拆分为左右两组：左侧周范围标题（编辑级字体）+ 今日完成统计；右侧上一周 / 今天 / 下一周 / 新增习惯按钮，不再挤在一起。
- 日期列表头采用双行结构（周几 + 日期），今日列以克制 accent 色标注。
- 完成单元从 9px 小点升级为 18px 圆形：未完成空心、已计划浅色填充、已完成实心 accent 填充 + 白色勾，hover 有轻微背景反馈，无浮夸动画。
- 已禁用习惯区改为底部折叠栏（▸/▾ 指示），展开后每行提供查看/编辑与恢复启用的轻量图标操作，不再占据巨大空白框。
- 习惯名右侧弱化显示预设时长（mono 字体小号），保持视觉层级清晰。
- 习惯面板宽度从 520px 调整为 560px，给八列表格更舒适的呼吸感；窄屏下表格横向滚动且列宽自适应。
- 设置页“功能”分区新增“启用习惯追踪”开关：关闭后隐藏候选区习惯区块、隐藏习惯总览入口、禁止打开习惯面板；重新开启后原有习惯数据完整保留。

## 2026-07-05 · 时间轴短任务渲染与选择器优化

### 修复
- 修复时间轴短任务与长任务块被拉伸到整天高度的问题：15m/30m 等日程现在严格使用时间轴计算出的像素高度，不再被 scheduled 根样式的 `height: 100%` 撑满整张时间画布。
- 修复选中态不生效的持久化 bug：表单初始化使用 `??` 运算符将 `null`（未设置）误回落到 `priority ?? "high"`，导致重新打开抽屉后"未设置"状态丢失。改为 `!== undefined` 检查以保留显式 `null`。
- 修复选中态 CSS 被全局 `.df-app button` 的 `!important` 规则覆盖的问题：全局按钮规则强制设置 `border-color` / `box-shadow`，覆盖了选中态。将 `.df-level-option` 加入所有全局按钮规则的 `:not()` 排除列表，选中态改为显式 `data-selected="true"` 属性选择器 + 内联 `--option-color` CSS 变量。
- 选中态视觉反馈改为伪元素覆盖整个分段：选中段使用 `::after` 伪元素覆盖整块按钮区域（inset: 0），2px 语义色实线描边 + 6% 语义色底色。首段选中时左上/左下圆角 11px，末段选中时右上/右下圆角 11px，中间段无圆角，与外层容器 12px 圆角自然贴合。伪元素不受全局 `.df-app button` 的 `box-shadow: none !important` 压制，彻底解决了之前选中态被覆盖的问题。
- 修复时间轴短任务布局问题：15m/30m 短时程任务不再继承普通任务块的 min-height、大 padding 和大字号，改为紧凑渲染。短任务（高度 < 56px）使用 14px 小复选框、12px 单行长标题（溢出时省略号）、最小内边距，隐藏 next step、event kind 等次要信息，内容垂直居中对齐。
- 修复时间轴拖拽/调整时长 bug：调整任务时长后，任务块变成巨大空白区域且标题变为"已调整时长"。根因是调整时长时只更新了 `scheduledStart` 或 `scheduledEnd` 其中一个字段，导致 `taskDuration` 计算出错，进而 `timeBlockHeight` 生成错误的像素高度。修复：调整时长时同时更新两个时间字段和 `estimatedHours`，确保数据一致性。
- 修复超长时间轴任务渲染：多小时任务的标题和复选框不再垂直居中漂浮在巨大空白块中间，改为顶部对齐布局，内容紧贴块顶部显示。

### 改进
- 任务抽屉的“重要程度/紧急程度”控件从纯文字按钮“高/中/低”重构为连接式分段图标选择器（segmented control），四段共享外框与圆角，段间以细分隔线划分。
- 重要程度使用标准 Lucide 风格旗帜图标，紧急程度使用横向文本感叹号，颜色统一为柔和 NavoPath 色板。
- 新增“未设置”选项，点击可立即清空对应字段。
- Matrix 四象限映射保持 high/non-high 逻辑，未引入 3x3 矩阵。
- 任务卡片复选框边框反映重要程度（高=珊瑚红 #C96F5B、中=琥珀 #C49A32、低=静蓝 #6E8DA6、未设置=中性墨色），完成后仍保留语义边框色。
- 复选框右上角显示小型紧急程度“!”标记（高=珊瑚红、中=琥珀、低=静蓝），未设置时不显示，完成后隐藏，且不阻挡复选框点击。

## 2026-07-04 · 统一拖拽体验

### 改进
- 拖动任务时，整张完整卡片跟随指针移动，不再仅以半透明残影呈现，手感对齐 TickTick。
- 拖动源原位置变为克制的虚线占位槽，保留布局空间，不再消失或仅做透明化处理。
- 在列表/候选/Tree 之间排序时显示清晰的插入线（带轻微脉动），落点一目了然。
- 拖入看板列、Matrix 象限或 Tree 节点时，整个目标容器显示统一的外描边高亮，而非局部灰底。
- 今日候选、全天日程栏、习惯子任务、Planning 的 Tree / Kanban / Matrix / List 与时间轴任务统一使用同一套指针事件拖拽系统与视觉语言，跨视图行为一致。
- Planning 页面全面切换到指针事件拖拽，移除旧的 HTML5 原生拖拽与蓝色/灰色自定义预览，所有视图拖拽预览均为完整 TaskBlock。
- 清理旧的透明幽灵预览与仅靠 opacity 表达拖拽状态的样式，统一为完整卡片跟随 + 占位槽 + 插入线 + 容器描边四件套。

### 修复
- 修复拖动预览因继承源元素拖拽态类而导致克隆卡片呈现为虚化占位的问题。
- 修复 Planning 页面拖拽预览呈现为蓝灰浮卡而非原始任务块的问题。
- 修复不同视图拖拽反馈样式各自为政、CSS 重复堆叠的问题，收敛为共享类驱动。
- 修复拖动任务时页面文字被意外选中；拖动期间统一禁用文本选择（输入框、文本域与可编辑区域不受影响）。
- 修复拖动源原位置占位呈现为紫色底，改为中性灰色虚线占位，深色模式下同样保持灰色。

## 2026-07-07 · Template mode rebuilt as timeline editor, timeline infinite scroll & now-line fixes, metrics donut label refinement & desktop widget

### Fixes
- Fixed the app white-screening when opening the Schedule Template modal: in `ScheduleTemplateModal` the `const zh = lang === "zh"` declaration was placed after the `useState` lines, but `useState<TemplatePeriod[]>(() => makeBuiltInPeriods("school"))` runs its initializer immediately on mount, and the call chain `makeBuiltInPeriods → slotToPeriod` referenced `zh`, triggering `ReferenceError: Cannot access 'zh' before initialization` (Temporal Dead Zone) and crashing the React tree. Moved the `zh` declaration above all `useState` calls.
- Fixed the app white-screening on launch when infinite cross-day scrolling was enabled: the timeline scroll listener called `updateVisibleTimelineDate()` immediately during effect initialization, where `scrollTop=0` satisfied the "near top" condition and triggered `setSelectedDate` right away. If the timeline container had not finished layout (`scrollHeight ≤ clientHeight`), the `useLayoutEffect` scrollTop compensation was clamped to 0, the rAF released the lock, and the effect re-ran to trigger another shift — an infinite "Maximum update depth exceeded" loop that crashed the React tree. The label update and the prepend/append logic are now separated: effect init only updates the visible date label without shifting, prepend/append runs only on real scroll events, and a `scrollHeight ≤ clientHeight` guard skips non-scrollable containers, eliminating the startup feedback loop entirely.
- Fixed the day / 3-day / week continuous timeline hitting a hard stop at the top of the canvas when infinite cross-day scrolling was enabled, so earlier days could not be loaded by scrolling up: the continuous timeline was a fixed centered window (7 days for daily, 21 for 3-day, 49 for weekly) and the scroll listener only updated the header date label without sliding the window. The timeline now prepends a block of earlier dates when scrolling near the top and appends a block of later dates when scrolling near the bottom, with a `useLayoutEffect` compensating `scrollTop` by the shifted band count after the window recomputes so the viewport does not jump. Task drag / resize / candidate drop still use the recomputed continuous coordinates, so drop targets are unaffected.
- Fixed the "now" line not displaying or being mispositioned in day / 3-day / week views when infinite cross-day scrolling was disabled: `NowLine` merged styles as `style={{ top, ...extraStyle }}`, and in non-continuous mode `extraStyle.top` was `undefined`, which overwrote the internally computed, `dayStartHour`-aware `top` and broke the absolute positioning. The merge is now explicit — the internal top is used only when `extraStyle` does not supply one — so continuous mode still defers to `continuousTimedTop` while non-continuous mode restores the correct within-day offset.
- Rebuilt the Metrics donut outside annotations as a compact two-segment leader + side-label system where every project shows a permanent external label: a short radial tick from the arc edge (outer+34 elbow) joins a 42px horizontal segment, with the project name beside the line end (start anchor on the right, end anchor on the left) at 12px/600, leader stroke 1.5px at 22% semi-transparent gray (36% when active) — a quiet data-chart annotation style. Project names are standing annotations, not hover tooltips: every project in the donut (including small slices like "Daily" and "Essays") gets a default external label, with no ">=6% or top 5 only" filtering and no hover-only surfacing. Same-side labels get a single Y sort-and-push collision pass (minGap 20px); if the lane overflows the safe band the whole lane shifts up and clamps back inside, so all labels stay visible — none are hidden and none spill to the edge. Removed the "Top focus" item from the right-side metrics summary (it duplicated the donut and project list), keeping only Planned, Unplanned, Tasks, and Done; removed the colored dot from the donut center hover state, keeping just the project name, duration, and percentage. On hover only the active segment's outer radius expands, the center text swaps, and the current label/leader brighten slightly — other labels never disappear or reshuffle.

### Improvements
- Rebuilt "Template mode" as a template version of the execution timeline: the "Schedule Template" button in the Today's Candidates top bar no longer opens a table editor — it opens a two-pane editor with a template list on the left and a template timeline on the right. The left list shows Default 1 / Default 2 / custom templates plus "+ New template"; each row shows the template name, period count, and time span (e.g. `8 blocks · 08:00–17:20`), and supports select, inline rename, duplicate, and delete. The right timeline renders the execution-page 15-minute slot grid: click blank to create a period, drag a block to move it, drag its top/bottom edges to resize, click a block to edit its title, delete via the top-right button. Periods only store `{title, startMinutes, durationMinutes}` and never touch the real task store; clicking "Apply to today" writes the non-conflicting periods into the selected date's timeline (conflicting periods are skipped by default with a conflict count surfaced). The old "Add today" checkbox column, "Daily goal" column, "Add period", "Reset current" toolbar buttons, and the spreadsheet-style slot editor have been removed, along with the residual styling for the legacy table and list/timeline UI. The `ScheduleTemplate` / `ScheduleTemplateSlot` data shape and the `applyTemplateToDate` flow are unchanged, so previously saved templates remain reusable. The template modal and the execution page now share the SAME real React components (not just CSS classes): six shared components are extracted — `ExecutionLayoutShell` (the `<main class="df-execute">` grid), `CandidatePanelShell` (`<section class="df-candidate-panel">`), `CandidatePanelHeader` (`<div class="df-panel-title">`), `CandidateBlock` (a list-row primitive built on `TaskBlock variant="candidate"`), `TimelineCanvas` (the `df-timeline-scroll` + `df-timeline-canvas` scroll container), and `TimelineEventBlock` (a scheduled-block primitive built on `TaskBlock variant="scheduled"` with resize dots / body / delete) — and both the execution page and the template modal render these components directly. The execution page's daily timeline no longer inlines `df-timeline-scroll`/`df-timeline-canvas` JSX; it calls `<TimelineCanvas>` exactly like the template modal. Template list items no longer use a custom `df-candidate-task-row`; they are `<CandidateBlock mode="template">`. Template period blocks no longer inline a `TaskBlock` wrapper; they are `<TimelineEventBlock mode="template">`. Column widths, gap, borders, scroll behavior, and paper background are all decided by the shared components — no template-specific left/right layout CSS remains (`df-template-split` / `df-template-candidate` / `df-template-timeline-panel` and the giant title region have been deleted). The template name now appears only as a compact name bar at the top of the timeline panel, with no standalone large title or description text. A `TimelineAdapter<T>` interface and a `templatePeriodAdapter` implementation isolate template-period draft data from the real task store, so template edits never pollute today's tasks and real scheduled tasks are only created on Apply; template drag/resize keeps its own `beginPeriodDrag` (operating on drafts, not real tasks), isolated from the execution page's `beginBlockDrag` via the adapter contract — an intentional data boundary, not a missed reuse.
- Added a desktop always-on-top widget: a real Electron `BrowserWindow` (`alwaysOnTop`, `frame`, draggable, resizable, remembers position) that renders a standalone `WidgetApp` via the `?widget=1` route instead of the full App, so it does not boot Supabase auth/data loading. The widget is a pure IPC client — it holds no task data; all state is owned by the main window's React store and synced via an IPC relay. The widget sends actions (quick add, timer start/pause/resume/save, complete, toggle always-on-top, reset position) through the main process to the main window for execution; the main window pushes a `WidgetSnapshot` (current task, timer, candidate count, language, always-on-top setting) back to the widget. The widget ticks its display locally every second and reconciles on each incoming snapshot. The entry point is an icon button in the candidate panel header (visible only on desktop and when the feature toggle is on); Settings > Features adds three toggles — "Enable desktop widget", "Widget always on top", and "Open on launch". Quick add defaults to no project and adds to today's candidates, sharing the same store as the main window with no independent fake data. The visual style is NavoPath paper-like (warm white background, thin border, restrained shadow, compact buttons), with no dashboard or glow feel. Mobile and web-only environments do not show the entry.
- Added an "All" time range option to the Metrics view, so project time allocation and task completion can be measured across all time instead of being limited to today/yesterday/this week/last week/this month/custom; the `MetricRangePreset` type and corresponding date-range calculation were updated accordingly.
- Extracted the six layout components shared between the template modal and the execution page into a standalone module `src/components/ExecutionSharedLayout.tsx`, enforcing reuse via real ES-module `import` statements rather than same-file scope: line 54 of `src/main.tsx` reads `import { ExecutionSplitLayout, CandidatePanelShell, CandidatePanelHeader, CandidateBlock, TimelineCanvas, TimelineEventBlock } from "./components/ExecutionSharedLayout"`, and both the execution page `App` and `ScheduleTemplateModal` reference the same imported bindings. The six local functions that previously lived at the bottom of `main.tsx` (formerly named `ExecutionLayoutShell`, etc.) have been removed; `ExecutionLayoutShell` was renamed to `ExecutionSplitLayout` at the same time. Each shared component renders a `data-reuse` attribute (`execution-split-layout` / `candidate-panel-shell` / `candidate-panel-header` / `timeline-canvas` / `timeline-event-block`) so opening the template modal and inspecting the DOM confirms the reused components are actually on the tree. Template drag/resize keeps its own `beginPeriodDrag` (operating on drafts, not real tasks), isolated from the execution page's `beginBlockDrag` via the `TimelineAdapter<T>` contract — an intentional data boundary, not a missed reuse.
- Completed the Visual Parity fix between the template modal and the execution page: deleted the template-specific timeline grid CSS overrides (`.df-template-shell .df-slot`, `.df-template-shell .df-timeline-canvas`) so the template timeline uses the execution page's global CSS directly — the hour grid comes from the `repeating-linear-gradient` background on `.df-timeline-canvas`, hour labels sit in the left gutter (`.df-slot span { left: -56px }`, the scroll container's `padding-left: 56px`), and the canvas border comes from the global `border-left`. The template timeline now renders all 96 slots (hour + quarter + major), matching the execution page's daily timeline slot structure exactly, instead of only 25 hour slots. Template period block positioning changed from `left: 56px` to `left: 8px` (matching the execution page's `baseLeft`), so blocks sit in the content area instead of avoiding in-canvas labels. The template modal frame (`.df-template-modal`) only provides overlay, close button, and footer action bar; the body layout is fully owned by `<ExecutionSplitLayout>` — column widths, gap, borders, scroll behavior, and paper background all come from the shared component, the modal frame no longer controls the left/right split.

## 2026-07-06 · Habit overview refactor & feature toggle

### Fixes
- Fixed the timeline jumping, inaccurate drop position, and vertical shift when dragging a task from Today's Candidates into the timeline: candidate→timeline drag was still using the single-day `getDropTargetFromPointer`, which under infinite cross-day scrolling inferred the date from the X column and clamped the time to the first day of the canvas, sending the preview and final schedule to the wrong date/time; it also kept rewriting `scrollTop` whenever the pointer crossed the timeline edges, causing vertical drift. The drag now uses the same `resolveDropTarget` as timeline event drag (date-from-Y-band in continuous mode) and the auto-scroll during candidate drag has been removed, so the timeline position and current date are never rewritten during the drag and the drop target and preview follow the pointer exactly. Timeline event drag/resize itself is unaffected.
- Fixed the "now" line disappearing from the 3-day/week timeline when infinite cross-day scrolling was disabled: the multi-day `NowLine` was not receiving `dayStartHour`, so in non-continuous mode it fell back to computing the vertical position from midnight instead of the configured day-start hour, shifting the line out of the visible scroll area when a non-zero day-start time was set. The correct `dayStartHour` is now passed, and an additional guard checks whether today is inside the rendered date range before rendering, so the now-line appears in both continuous and non-continuous modes whenever today is visible.
- Fixed continuous cross-day timeline scrolling across day, 3-day, and week views: the timeline can scroll upward into previous dates and downward into following dates without forced date switches or page-like snapping. Header dates now follow the visible timeline window, cross-day boundaries use `0:00` instead of `24:00`, and Back to now appears after cross-day scrolling away from today and recenters the current time.
- Fixed timeline task drag and resize breaking after infinite cross-day scrolling was enabled: drag/resize now use continuous absolute-minute coordinates (pointer Y + current canvas geometry → date + time) instead of inferring the date from the single-day X column. Dragging across midnight (e.g. 23:30 → next day 00:30) correctly switches to the next day while preserving the original duration; resizing the bottom edge across midnight (23:30/30m → next day 00:30) yields a 60m duration instead of breaking. Short tasks (15m/30m) still render at their original pixel height, and title/project/completion stay unchanged throughout drag and resize.
- Fixed the donut chart hover effect in the Metrics allocation view: hovering a segment previously used `translate` to shift the whole segment outward, which moved both the inner and outer edges and distorted the center hole. The hover now only expands the outer radius (88 → 94) while keeping the inner radius unchanged, so the center hole size stays fixed and the segment grows outward instead of scaling or translating.
- Fixed the Metrics donut hover hit area being too large, leader lines being too flat, project names being mispositioned, and center text being off-center: the hit area changed from `bounding-box` (the whole segment bounding box, including the center hole and outside whitespace) to `visiblePainted` (only the filled arc itself triggers hover); leader lines and labels are set to `pointer-events: none`; `onMouseEnter`/`onMouseLeave` are bound only to the arc path, never to the svg/g/container; the SVG viewBox is now symmetric around the donut center (`-70 0 380 240`) so the center text aligns exactly with the donut's geometric center; the leader line's radial segment was lengthened (elbow radius 108 → 128) and the project name is placed above the horizontal segment.
- Fixed the Metrics donut showing a native black tooltip on hover, the project name not hugging the leader line closely enough, and the radial segment still being too flat: removed the `<title>` element from the segment path so no browser-native tooltip appears — hover now only expands the outer radius and swaps the center text; increased the leader line elbow radius from 128 to 148 and shortened the horizontal distance from 165 to 158 so the diagonal segment is more pronounced and the bend is clearer; the project name now sits tightly above the horizontal segment (y offset reduced from -4 to -2, dominantBaseline set to alphabetic) like annotation text hugging the leader line.
- Fixed the Metrics donut outside project name being mispositioned at the end of the horizontal leader segment: the label was previously anchored at the p2 endpoint of the horizontal segment, so it looked like a tag stuck to the left/right end of the line rather than annotation sitting above the line. The label is now anchored at the midpoint of the horizontal segment (between p1/elbow and p2/end) with `text-anchor: middle`, so both left- and right-side project names are centered strictly above the horizontal segment like annotation text sitting on top of the line, no longer drifting to the line's outer endpoint.
- Refined the Metrics donut outside annotation: the project name vertical position is now fixed at 8px above the horizontal segment (`labelY = p1.y - 8`) for a stable breathing distance from the line, no longer hugging or drifting; the outside leader line stroke was thickened from 1px to 1.5px while keeping the same soft neutral gray (80% paper-rule color), so the line reads more clearly and steadily without becoming heavy, preserving NavoPath's quiet paper aesthetic.
- Rebuilt the Metrics donut hover detection as a layered structure: separated the visual ring from the hit layer — added a transparent pie-sector hit layer (`pieSectorPath`, innerRadius=0, outerRadius=96) where each project sector spans from the center to the outer edge, so the pointer hovering inside the center hole still activates the correct project by angle (right-center → right project, lower-left center → lower-left project, upper-left center → upper-left project); the visual arc layer, leader lines, labels, decorative ring, and center text are all set to `pointer-events: none` so events pass through to the hit layer; the hit layer outer edge does not exceed visual outer radius + 2px, so outside whitespace never triggers hover. Hovering still only expands the active segment's outer radius (88→94) while the inner radius stays unchanged.
- Fixed the Metrics donut cursor flickering between pointer and default on hover: the root cause was multiple SVG elements (visual arcs, hit sectors, leader lines, labels) each receiving pointer events, so the cursor switched rapidly as the pointer crossed element boundaries. Replaced with a single transparent hit disk (`<circle r=98>`) on top that handles all `onPointerMove` / `onPointerLeave` / `onClick`; every other SVG element is `pointer-events: none`. Hover is computed from the pointer's angle relative to center (`atan2 → polar angle → segment match`) rather than relying on multiple paths competing for events; the cursor is pointer only on the hit disk and default elsewhere, eliminating the jitter.
- Fixed the Metrics donut outside project name still being offset: the horizontal segment was only 10px long (elbow radius 148 vs labelDistance 158 — nearly equal), so the segment was too short and the label anchor still sat near the p2 endpoint. The horizontal length is now driven by the project name length (`horizontalLength = max(128, label.length * 16)`), with p1 fixed at `visualOuter + 52` and p2 at `p1.x ± horizontalLength`; the label is anchored at `(p1.x + p2.x) / 2`, `p1.y - 8`, `text-anchor: middle`, so both left- and right-side project names are centered strictly above the horizontal segment, with the line acting like an underline beneath the name.
- Refined the Metrics donut outside label typography and the right-side summary: reduced the outside project name font-size from 11px to 10px and font-weight from 600 to 500 so it no longer reads like a headline and returns to chart-annotation visual weight; tightened the horizontal length formula to `max(88, label.length * 13)` and adjusted labelY to `p1.y - 6` so the name sits closer above the horizontal segment; removed the "Top focus" item from the right-side metrics summary (it duplicated the donut and project list), keeping only Planned, Unplanned, Tasks, and Done with no empty placeholder left behind.

### Improvements
- Reworked the Metrics donut into a labeled ring chart: it remains a single donut where each colored segment represents one project; outside each segment a two-segment leader line (radial segment + horizontal segment) points to just the project name, placed above the horizontal segment — percentage and duration no longer appear beside the leader line; the center defaults to total scheduled duration + range label and switches to the hovered project's color dot, name, duration, and percentage on hover; the ranked list and tooltip still provide full duration / percentage / task count. Hovering a segment only expands its outer radius while the inner radius stays unchanged.
- Added a new Metrics view to Planning. It reports project time allocation from scheduled/planned timeline records, with today/yesterday/week/month/custom ranges, a project donut, ranked list, density heatmap, task drill-down, and Linear-style filters. Unplanned time is shown separately, habits are included by default, cross-day tasks are split by actual overlap, and day-start settings are respected.
- Rebuilt the Habits Overview panel: replaced the cluttered bordered-box grid with a structured week table — habit name column on the left, seven circular day-completion units on the right, with rows strictly aligned to the header for a clean paper-table feel.
- Split the top control bar into two groups: week range title (editorial display type) + today's completion stats on the left; previous / today / next / new-habit buttons on the right, no longer crammed together.
- Day column headers use a two-line layout (weekday + date); today's column is marked with a restrained accent tint.
- Upgraded the completion unit from a 9px dot to an 18px circle: empty ring when not done, light accent tint when planned, solid accent fill with a white check when done; subtle hover background, no exaggerated animation.
- The disabled-habits section is now a bottom collapsible bar (▸/▾ indicator); expanding it shows one row per habit with lightweight view/edit and restore icon actions, replacing the old oversized empty box.
- Habit duration is shown muted (small mono font) on the right of the habit name to keep visual hierarchy clear.
- Habit panel width increased from 520px to 560px so the eight-column table breathes; on narrow screens the table scrolls horizontally and column widths adapt.
- Added "Enable habit tracking" toggle in Settings > Features: when disabled, hides the habit section in the candidate list, hides the habit overview entry point, and prevents opening the habit panel; all habit data is preserved for when the feature is re-enabled.

## 2026-07-05 · Timeline short tasks & selector improvements

### Fixes
- Fixed short and tall timeline scheduled blocks stretching to the full-day canvas height: 15m/30m tasks and longer scheduled blocks now respect the timeline-calculated pixel height instead of inheriting `height: 100%` from the scheduled root style.
- Fixed selected-state persistence bug: form initialization used `??` operator which treated `null` (unset) as falsy and fell through to `priority ?? "high"`, causing "unset" state to be lost on drawer reopen. Changed to `!== undefined` check to preserve explicit `null`.
- Fixed selected-state CSS being overridden by global `.df-app button` `!important` rules: global button rules forced `border-color` / `box-shadow` on all buttons, overriding the selected state. Added `.df-level-option` to every global button rule's `:not()` exclusion list, and switched the selected state to an explicit `data-selected="true"` attribute selector with an inline `--option-color` CSS variable.
- Selected-state visual feedback now covers the entire segment: the selected segment uses a `::after` pseudo-element spanning the full button area (inset: 0) with a 2px semantic-color solid border and 6% semantic tint. First-child segments get 11px top-left/bottom-left corners, last-child segments get 11px top-right/bottom-right corners, and middle segments have no rounding — all matching the container's 12px outer radius. Pseudo-elements are NOT affected by global `.df-app button` `box-shadow: none !important` rules, completely solving the previous override issue.
- Fixed short-duration timeline task layout: 15m/30m short events no longer inherit full-size candidate task styles (min-height, large padding, large fonts). Short tasks (height < 56px) now render compactly with 14px checkbox, 12px single-line title (ellipsis when overflow), minimal padding, hidden metadata/actions, and vertically centered content.
- Fixed timeline drag/resize bug: After resizing a task, the task block becomes a huge blank area and the title shows "Duration Adjusted". Root cause: when resizing, only one of `scheduledStart` or `scheduledEnd` was updated, causing `taskDuration` to calculate incorrectly, which then produced wrong pixel heights via `timeBlockHeight`. Fix: update both time fields and `estimatedHours` together during resize to ensure data consistency.
- Fixed ultra-long timeline task rendering: Multi-hour tasks no longer have their title and checkbox floating in the vertical middle of a huge blank block; they now use top-aligned layout with content pinned near the top of the event block.

### Improvements
- Refactored the task drawer's "Importance / Urgency" controls from plain text buttons into a connected segmented icon strip sharing one outer border and rounded corners, with thin dividers between segments.
- Importance uses standard Lucide-style flag icons, urgency uses horizontal text exclamation marks, colors unified to muted NavoPath palette.
- Added an "unset" option; clicking it immediately clears the field.
- Matrix quadrant mapping keeps the high/non-high logic; no 3x3 matrix was introduced.
- Task card checkboxes now reflect importance via border color (high=coral #C96F5B, medium=amber #C49A32, low=muted blue #6E8DA6, unset=neutral ink); the semantic border color is retained after completion.
- A small urgency "!" marker appears at the checkbox top-right (high=coral, medium=amber, low=muted blue); it is hidden when unset or completed, and never blocks the checkbox click target.

## 2026-07-04 · Unified drag experience

### Improvements
- Dragging a task now moves a complete intact card that follows the pointer, replacing the old opacity-only ghost and matching TickTick's feel.
- The source slot becomes a restrained dashed placeholder that preserves layout space, instead of vanishing or only going transparent.
- Reordering inside lists, candidates, and the tree shows a clear insertion line (with a subtle pulse) so the drop target is unambiguous.
- Dropping into a Kanban column, Matrix quadrant, or tree node outlines the whole target container with a unified accent border, rather than a partial gray fill.
- Today candidates, the all-day shelf, habit child rows, and Planning's Tree / Kanban / Matrix / List views plus the timeline now share one pointer-event drag system and visual language, so behavior is consistent across surfaces.
- The Planning page has been fully migrated to the pointer-event drag system; the legacy HTML5 native drag and blue/gray custom preview are gone, and every drag overlay is a complete TaskBlock.
- Removed the legacy transparent ghost and opacity-only drag-state styling in favor of a single quartet: intact card follows pointer, placeholder slot, insertion line, and container outline.

### Fixes
- Fixed the drag preview inheriting the source's drag-state class, which made the cloned card render as a dimmed placeholder.
- Fixed the Planning page drag preview rendering as a blue-gray floating card instead of the original task block.
- Fixed per-view drag feedback styles diverging and duplicating CSS; consolidated onto shared class-driven feedback.
- Fixed page text being accidentally selected while dragging a task; text selection is now disabled during drags (inputs, textareas, and editable regions are unaffected).
- Fixed the drag source placeholder showing a purple tint; it is now a neutral gray dashed slot, staying gray in dark mode too.

## 2026-07-03 · 统一任务块与精简顶栏

### 改进
- 移除顶部沉重的当前任务栏，将正在进行的任务收敛为工作区内的紧凑状态片，不再与任务列表或时间轴争抢视觉重心。
- 统一候选任务、习惯子任务、时间轴日程块与全天日程块，全部使用共享的 TaskBlock 组件系统。
- 固定任务块解剖结构：[复选框][标题/内容][时长/元信息][操作]，同时让 candidate、scheduled、compact、habit-child 各变体分别控制密度、高度、内边距与对齐。
- 引入 Calm / Medium / Custom 三种外观模式，通过 CSS 变量与 `data-task-appearance` 控制项目强调位置、边框强度与密度。
- 优先级仅通过复选框颜色表达（低/中/高/紧急），项目色仅作底部或左侧细线注释，不主导卡片。
- 习惯分组改用 TaskGroup 容器，子任务使用 habit-child 变体，保持紧凑左对齐，不再变成 oversized 的嵌套卡片。
- 时间轴日程块使用 scheduled 变体，块高由时间轴决定，内容固定在左上角，不再继承候选任务卡片的间距。
- 候选任务、时间轴任务、习惯子项和 Planning 各视图任务统一使用项目色左侧细描边，保持同一任务块语言。
- Planning 的 Tree、Kanban、Matrix、List 任务块回到今日候选任务块的纸面视觉：干净背景、6px 圆角、项目色左侧细描边、同一套 padding、无灰底、无发光、无悬浮抬升。
- Tree 任务节点新增左侧状态框，与今日候选和 Planning 其它视图保持同一任务块解剖结构。
- Planning 页面新增左侧工具栏，筛选入口与 Tree / Kanban / Matrix / List 视图切换收纳到侧栏顶部；Tree 视图行距更紧凑，所有 Planning 视图任务块不再显示项目色左侧色条。
- 重构 Planning 工作区为结构化任务面板：左侧 44px 紧凑竖向轨道（视图切换 + 筛选），右侧为可滚动的视图容器，移除原本大留白浮动画布，任务不再悬空。
- 修复筛选系统：之前状态 / 重要度 / 紧急度筛选选项被代码过滤掉无法显示，现恢复全部筛选类型，可在面板中组合勾选。
- 新增 Linear 风格的活动筛选片栏：当前生效的筛选条件以小尺寸可移除片显示在视图上方，支持单独删除与一键清除全部。
- 拖拽体验增强：Kanban 与 Matrix 拖动时在目标列/象限内显示占位插槽与虚线高亮，拖动源以轻微淡化表示，无灰色蒙层、无发光。
- 清理已完成任务的旧版灰色蒙层与整体透明度，统一为干净的删除线 + 弱化文字 + 优先级色复选框。
- 筛选面板重构为 Linear 风格悬停级联弹出层：顶部"添加筛选"输入框，下方为双列布局——左侧类别列表（图标 / 标签 / 活动数 / 摘要 / 箭头）始终可见，鼠标悬停即展开右侧对应选项，无需点击切换；新增搜索文本、截止日期（逾期 / 本周 / 无日期）、是否已排程三类筛选。
- 视图切换器改为图标 + 短标签的紧凑竖向按钮，活动项以左侧细线标记，不再像悬挂标签。
- List 视图新增拖拽排序：行间显示插入线（带轻微脉动），拖动源淡化，松开后按新顺序写入 order 字段。
- Kanban 列头与 Matrix 象限头新增任务总数与预估总时长（仅当时长 > 0 时显示）。

### 修复
- 修复长标题挤出时长与操作按钮、复选框与下拉图标堆叠错位、习惯卡片布局不一致等问题。
- 关闭导致布局漂移的旧版任务卡覆盖样式，确保共享 TaskBlock 的网格版式在所有表面生效。
- 修复任务拖入时间轴后 scheduled 块失去绝对定位、忽略时间轴 top/height 几何而异常拉高的问题。
- 搜索入口改为 Cmd/Ctrl+K 命令面板触发，主 Chrome 不再显示显眼的搜索按钮。
- 修复今日候选任务标题纵向不居中的问题；短标题居中，多行标题作为整体居中，文字仍保持左对齐。
- 修复长任务名换行时挤出时长、操作按钮或 checkbox 的布局问题。
- 修复 Planning 侧边栏以绝对定位覆盖树状图等视图的问题，侧栏现归位到网格首列，视图区域不再被遮挡。
- 修复设置图标未贴齐顶栏右侧边缘的问题。

## 2026-07-03 · Unified task blocks and minimal header

### Improvements
- Removed the heavy top active-task bar; the running task is now shown as a compact status chip inside the workspace, no longer competing with the task list or timeline.
- Unified candidate tasks, habit child tasks, timeline scheduled blocks, and all-day blocks on the shared TaskBlock component system.
- Locked task-block anatomy to [checkbox][title/content][duration/meta][actions], while candidate, scheduled, compact, and habit-child variants now control their own density, height, padding, and alignment.
- Introduced Calm / Medium / Custom appearance modes driven by CSS variables and `data-task-appearance`, controlling accent position, border strength, and density.
- Priority is expressed only through checkbox color (low/normal/high/urgent); project color remains a thin bottom/left annotation, not a dominant card border.
- Habit groups now use the TaskGroup container, and child items use the habit-child variant, staying compact and left-aligned instead of becoming oversized nested cards.
- Timeline scheduled blocks use the scheduled variant, with height controlled by the timeline and content pinned to the top-left instead of inheriting candidate-card spacing.
- Candidate tasks, timeline tasks, habit child rows, and Planning task views now share a project-color left rule for a consistent task-block language.
- Planning Tree, Kanban, Matrix, and List task blocks now reuse the Today Candidate paper-card visual language: clean background, 6px radius, project-color left rule, matching padding, no gray fill, no glow, and no hover lift.
- Tree task nodes now include the same left status checkbox anatomy used by Today Candidate and the other Planning views.
- Planning now has a left-side tool rail that places Filter and the Tree / Kanban / Matrix / List view switcher at the top; Tree spacing is tighter, and all Planning view task blocks no longer show a project-color left strip.
- Rebuilt the Planning workspace into a structured task surface: a 44px compact vertical rail (view switcher + filter) on the left and a scrollable view container on the right, replacing the large empty floating canvas so tasks no longer drift in blank space.
- Fixed the filter system: Status / Importance / Urgency options were previously stripped out by code and never rendered; all filter types are now available and composable in the panel.
- Added a Linear-style active-filter chip bar: active filters appear as small removable chips above the views, with per-chip removal and a clear-all action.
- Drag/drop feel: Kanban and Matrix now show a placeholder slot and dashed highlight inside the target column/quadrant while dragging, with the drag source subtly dimmed; no gray film, no glow.
- Cleaned up legacy gray overlay and whole-card opacity on completed tasks, standardizing on strikethrough + muted text + priority-colored checkbox.
- Rebuilt the filter panel as a Linear-style hover cascading popover: an "Add filter" input on top, below it a two-column body — the left category list (icon / label / active count / summary / chevron) is always visible, hovering a category immediately reveals its options on the right without a click or back button. Added Search text, Due date (overdue / this week / no date), and Scheduled (scheduled / unscheduled) filter types.
- View switcher is now compact vertical buttons with icon + short label; the active view is marked by a left rule instead of a hanging tag.
- List view now supports drag-to-reorder: an insertion line (with a subtle pulse) appears between rows, the drag source dims, and the new order is written to the task's order field on drop.
- Kanban column headers and Matrix quadrant headers now show total task count and total estimated hours (only when hours > 0).

### Fixes
- Removed the remaining legacy timeline task-card, habit child mini-card, and Planning CSS-only task-card visual implementations, leaving TaskBlock variants to own candidate, Planning, scheduled, and habit-child rows.
- Moved the Execute / Planning switcher to the center of the top bar while keeping the NavoPath brand on the left and Settings on the right.
- Fixed long titles pushing duration/actions out of the row, checkbox/dropdown icon stacking, and inconsistent habit card layouts.
- Disabled legacy task-card override styles that caused layout drift, ensuring the shared TaskBlock grid anatomy applies across all surfaces.
- Fixed scheduled blocks losing absolute positioning after dragging to the timeline, which caused them to ignore timeline top/height geometry and stretch incorrectly.
- Search is now triggered through the Cmd/Ctrl+K command palette; the main chrome no longer shows a prominent search button.
- Fixed Today Candidate task title vertical alignment; short titles center normally, and wrapped multiline titles stay centered as a block while the text remains left-aligned.
- Fixed long task names pushing duration, action icons, or checkbox controls out of alignment.
- Fixed the Planning sidebar overlapping the tree and other views due to legacy absolute positioning; the sidebar now sits in the grid's first column and the view area is no longer covered.
- Fixed the settings icon not being flush with the right edge of the header.

## 2026-07-02 · Execute & Planning Redesign

### Improvements
- Header now persistently shows the active timer task with a bold outlined capsule; timer digits stay visible, and hovering reveals pause, save, discard, and focus SVG icon actions.
- Focus overlay rebuilt: Stopwatch / Pomodoro / Flowtime mode switch sits at the top, the timer is centered and oversized, and the close button moved to the top-right; the task name moved down with heavy weight, a tiny "Working" label on its left, all wrapped in a theme-colored outline with an opaque background.
- Planning filter panel switched to a Linear-style hover flyout: five chips (Project, Display, Status, Importance, Urgency) line up horizontally, each revealing a multi-select list on hover with the current selection shown on the right; the reset button sits in the filter top bar.
- Planning page shifted up, and the view-switch buttons are now vertical on the right side.
- Today candidate task cards now show status, importance, and urgency badges plus a subtask progress count; expanding reveals a color-blocked subtask list with inline toggle.
- Schedule template entry moved to the candidate panel title bar with a calendar SVG icon.
- Planning list view now displays importance, urgency, and due-date indicators.
- Habit system overhaul: habit rows restyled as compact subtask cards with smaller unified checkboxes; clicking a habit title opens the editor, and clicking the outer card opens the habit overview side panel.
- Habit editor supports title, notes, default duration, frequency rule (daily / weekly target / custom weekdays), target count, and reminder config; the overview panel shows today's completed, planned, 7/30-day completion rates, and planned minutes.
- Dragging a habit back to the candidate area unschedules it for the day, removing the timeline record while preserving completion state.

## 2026-07-02 · Execute & Planning Redesign

### Improvements
- Header now persistently shows the active timer task with a bold outlined capsule; timer digits stay visible, and hovering reveals pause, save, discard, and focus SVG icon actions.
- Focus overlay rebuilt: Stopwatch / Pomodoro / Flowtime mode switch sits at the top, the timer is centered and oversized, and the close button moved to the top-right; the task name moved down with heavy weight, a tiny "Working" label on its left, all wrapped in a theme-colored outline with an opaque background.
- Planning filter panel switched to a Linear-style hover flyout: five chips (Project, Display, Status, Importance, Urgency) line up horizontally, each revealing a multi-select list on hover with the current selection shown on the right; the reset button sits in the filter top bar.
- Planning page shifted up, and the view-switch buttons are now vertical on the right side.
- Today candidate task cards now show status, importance, and urgency badges plus a subtask progress count; expanding reveals a color-blocked subtask list with inline toggle.
- Schedule template entry moved to the candidate panel title bar with a calendar SVG icon.
- Planning list view now displays importance, urgency, and due-date indicators.
- Habit system overhaul: habit rows restyled as compact subtask cards with smaller unified checkboxes; clicking a habit title opens the editor, and clicking the outer card opens the habit overview side panel.
- Habit editor supports title, notes, default duration, frequency rule (daily / weekly target / custom weekdays), target count, and reminder config; the overview panel shows today's completed, planned, 7/30-day completion rates, and planned minutes.
- Dragging a habit back to the candidate area unschedules it for the day, removing the timeline record while preserving completion state.

## 2026-07-01 · Planning views and task timer restored

### Added
- Planning view now offers Kanban (To do / Doing / Done drag-and-drop), Eisenhower four-quadrant (important × urgent drag-and-drop), and List views, with a view switcher and filter panel (project, status, importance, urgency).
- Task-level timer: start timing from a candidate task; the header center shows the active timer task and elapsed time with pause, save, and discard controls; saving writes a time entry.
- Focus overlay: full-screen timer display with Stopwatch / Pomodoro / Flowtime mode switching for focused execution.
- Settings → Features section: toggle Kanban, Quadrant, and List views independently, and set the default focus mode plus idle threshold.

### Improved
- Planning filter bar adds a "Show completed" toggle and a "Filter" panel entry; the view switcher button group adopts the paper style.

## 2026-06-29 · Template mode and 1.2.32 release prep

### Added
- Execute template mode now supports reusable template management: create custom templates, add or remove periods, save them, and apply only the checked periods to the currently selected timeline date.

### Improved
- Built-in templates are now named Default 1 / Default 2; the Template button moved into the right-side view switcher, and the larger paper-style dialog avoids overlap with Day / 3-Day / Week / Month controls while zooming.
- Period checkboxes now render as clear empty boxes with check marks instead of solid color chips; when a daily goal is blank, the period name is used for the created time block.
- Custom templates are saved with local and cloud-synced planner data and can be deleted directly from the template dialog without affecting already-created tasks.

## 2026-06-27 · Cloud sync, AI, and responsive layout fixes

### Improved
- New users and local preview now default to light mode for the paper-like NavoPath reading experience.
- Narrow landscape windows keep Today Candidates on the left and the timeline on the right; single-view switching is reserved for portrait layouts.
- Settings cloud sync, accent color, Navo AI, and account areas now use flatter paper-style grouping with stronger dark-mode contrast.
- Account settings now show plan status in a dedicated subscription section, with Pro benefits open during the dev preview, and moves logout/about/delete actions into More.
- Account settings now split plan access into Free, Supporter, and Pro tiers and add an Afdian donation entry; the website homepage also includes a restrained donation link.
- Plugins / MCP documentation now uses a changelog-style paper page and makes clear that the current build only supports official built-in plugins shipped with the app.
- Official plugins now have Chinese names, descriptions, config labels, and enabled-state guidance; enabled tools expose Pomodoro, habit check-ins, a local weather badge, and task notes.
- AI model fallback choices now cover DeepSeek, Qwen, GLM, Kimi, MiniMax, Step, Nex, and Ling families.

### Fixed
- Fixed same-account sign-in on a fresh browser or reinstalled desktop app sometimes loading empty data; cloud profile load failures no longer silently replace the workspace with an empty profile.
- Fixed Push to cloud and Pull from cloud being skipped by pending local save queues; manual push flushes local changes first, and manual pull explicitly applies cloud data.
- Fixed Navo AI requests failing repeatedly when a model or reasoning level is incompatible, and made AI memory generation follow the current English/Chinese mode.
- Fixed the AI dialog bottom Reasoning control, project color pickers closing while selecting custom colors, Plan Suggestions covering 3-day/week dates, and collapsed/fullscreen range views not entering simplified display.
- Fixed AI requests failing when a model does not support JSON response_format by retrying without that option and keeping the stable model fallback.
- Fixed Plan Suggestions not collapsing into a compact calendar button in narrow landscape 3-day/week views.
- Removed the duplicate Cloud sync heading in Account settings and added an external-link hint to About NavoPath.
- Fixed resize previews drifting while dragging or resizing timeline blocks in 3-day/week views; short and long tasks now share hover-only resize handles, and short tasks reveal their project on hover.

---

## 2026-06-26 · Short-block resize, sync direction, and update detection

### Improvements
- Settings → Cloud sync now exposes dedicated "Push to cloud" and "Pull from cloud" direction buttons: upload this device's data alone, or overwrite this device with cloud data alone, without forcing a bidirectional merge every time — cross-device sync is now fully under your control.
- Refined task-block resize handles: the hit area is now a centered quarter of the block width so it never crowds the title, and the indicator is a thinner always-visible line that brightens on hover for less visual clutter.

### Fixes
- Fixed 15-minute and 30-minute short tasks being unable to adjust duration: short blocks can now be resized from both the top and bottom edges, with handles horizontally centered on the block, clearly visible on hover, and no longer conflicting with drag-to-move.
- Fixed the desktop app always reporting "up to date" when checking for updates; the update manifest (latest.yml) was stuck on an old version and is now regenerated correctly with each release, so new versions are detected reliably.
- Fixed duplicate background windows being created: createWindow() now reuses an existing window instead of creating a new one when called from the tray menu or app.activate events, ensuring the app only ever maintains a single visible window.

---

## 2026-06-25 · Short-block display and deletion stability

### Improved
- Settings → Plugins page rebuilt on a unified plugin registry: the Enable/Disable buttons now persist to settings and fire plugin lifecycle hooks, and Configure opens a form dialog to edit that plugin's fields (focus minutes, city, markdown toggle, etc.) with instant effect.
- The Sync button now shows a spinner during the operation and surfaces clear results: "Sync complete", "Already up to date", or a failure toast, instead of silently doing nothing.
- Added a "Launch at startup" toggle in Settings so NavoPath can open automatically when you sign in to Windows.
- Added a single-instance lock to the desktop app; launching a second copy now focuses the running window instead of opening a duplicate.
- Raised the minimum font size for 15-minute short task titles to 12px with antialiasing enabled, fixing blurry text; added a "Timeline font size" slider (85% – 130%) under Settings → Appearance so the size can be tuned for any screen.
- Redesigned the timeline quick-add popup as a single-line compact layout: removed the top time-display area, keeping only the task-name input and a confirm check button for faster entry.
- Widened the timeline left/right navigation buttons from 36px to 48px and extended the horizontal touch hit area via a pseudo-element, reducing missed taps and misfires.

### Fixed
- Fixed task blocks in "color fill" mode losing their project color when completed; the completed state now only lowers opacity while keeping the original color, and the strikethrough is layered on top so visual consistency is restored.
- Fixed signed-in users being forced into local preview mode (and unable to sign out) when the cloud profile query failed; profile failures now degrade to in-memory empty data so the signed-in session stays usable.
- Fixed the runtime fallback flag being persisted to localStorage, which permanently trapped the app in a temporary preview mode; the fallback now lasts only for the current session, the next launch retries the cloud backend, and stale persisted flags from earlier builds are cleaned up.
- Fixed deleted candidate task cards on the Execute page reappearing after deletion; all deletion paths now read from `dataRef.current` to eliminate stale-closure races.
- Fixed tasks reappearing after being deleted from the task detail drawer.
- Fixed the original task reappearing after being converted to an event.
- Fixed the app getting stuck on the loading screen when the cloud database query fails; it now automatically falls back to local preview mode so the workspace remains usable.
- Fixed the for-ever preview mode issue; runtime fallback now lasts only for the current session, so the next launch retries the cloud backend.
- Fixed 15-minute single-line task titles being clipped by resize handles and the checkbox in the timeline; the title now owns the full block height and is vertically centered without clipping.
- Fixed garbled encoding in the `package.json` description field.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-23 · More reliable desktop sign-in and sync

### Improved
- The Windows desktop app now keeps sign-in sessions in encrypted system storage, so users return directly to the workspace after closing the app or restarting the computer; signing out explicitly clears the session.
- Signed-out Windows desktop users now see a focused sign-in and registration screen instead of the marketing introduction; the website landing page remains unchanged.
- Multi-device sync now merges the latest version instead of overwriting cloud data with local data, so tasks and plans added on other devices are no longer accidentally deleted.
- Dark mode now uses a minimal neutral-gray palette inspired by Claude Code, removing blue-purple tints for higher contrast on text, cards, and settings panels.
- Accent color swatches and navigation items in Settings now use neutral backgrounds in dark mode instead of blue-purple highlights.
- The NavoPath logo in the top-left corner stays crisp in both light and dark modes, with the inverted-color filter removed.
- Setting the day start time now smoothly scrolls the timeline to that hour and shows a confirmation toast.
- The default font size is slightly larger for more comfortable reading.

### Fixed
- Fixed 3 Day, Week, and Month view switch buttons being blocked by the timeline left/right navigation hot zones.
- Fixed the desktop "Restart and install" action crashing with `quitAndInstall is not a function` after an update download, preventing the installer from launching.
- Fixed some text in dark mode remaining black and hard to read.
- Fixed 15-minute task titles being truncated in the timeline.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-24 · Timeline quick-add and short-block fixes

### Improved
- Redesigned the timeline quick-add popup as a unified card with a time label, input field, and project picker menu for a more cohesive look — no more fragmented floating layers.
- The "Day start time" setting now supports minute precision (e.g. 09:30); the timeline grid, task blocks, now-line, and drop targeting all align to the exact start.
- Overlapping tasks in the same time slot are no longer capped at 4 columns — every task gets its own column and none are hidden behind another.

### Fixed
- Fixed the quick-add panel appearing when clicking on an existing task block; it now only triggers on blank timeline slots.
- Fixed 15-minute short task blocks having clipped titles and non-functional resize handles.
- Fixed the quick-add panel staying open and persisting after saving a task; it now closes automatically while remembering the last project selected.
- Fixed timeline misalignment when rapidly clicking the add button after changing the day start time.
- Fixed deleted sub-pages on the Planning page temporarily disappearing then reappearing, preventing successful deletion.
- Fixed button and icon layout misalignment on the Planning page after adding a large number of subtasks.
- Fixed the clicked day jumping to the leftmost column in 3-day and week views after quick-add a task; the view now stays put when the target date is already visible.
- Fixed left/right date switching in the timeline not responding.
- Fixed the quick-add confirm button turning white and nearly invisible in dark mode; it is now a solid accent-colored button again.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-22 · Clearer week view and desktop icon

### Added
- The web and desktop apps now auto-sync cloud tasks, schedules, and settings every hour by default; open Settings → Account → Cloud sync to change it to every 15 minutes, every 6 hours, every 24 hours, or to disable auto-sync and rely on manual sync only.
- Settings → Account now includes a "Sync now" button that pushes local changes to the cloud and pulls the latest version on demand; the button shows "Syncing…" and is disabled while a sync is in flight.
- The last sync time is recorded and synced with the account across devices, and the Account page shows a relative timestamp ("Just now / N minutes ago / N hours ago") plus the absolute date and time.

### Improved
- The desktop icon now uses a white N face, black dimensional shadow, and transparent outer canvas so it stays clear in light and dark system surfaces.
- Collapsing Today's Candidates now consistently switches 3 Day, Week, and Month views into the compact reading mode.
- 15‑minute task blocks in the week view now show readable titles by removing the redundant check and inner padding so the title fits the narrow column.

### Fixed
- Fixed timeline fullscreen inheriting the normal workbench height and leaving a large blank area; fullscreen now fills the entire available viewport.
- View release notes now reliably opens the in-app changelog instead of depending on a temporary or untagged GitHub release URL.
- Fixed the daily timeline leaving a large blank band above 0:00 and below the all‑day bar when the day had no tasks; 0:00 now sits directly under the all‑day bar.

## 1.2.1 · 图标重绘与启动加速

### 改进
- 桌面应用图标重绘为涂鸦风格 N（白色字母 + 黑色 3D 阴影 + 透明背景），与参考图一致。
- Electron 启动速度优化：延迟加载 electron-updater、crypto 和智能备注模板，窗口创建优先级提升。

## 1.2.0 · 图标升级与安装包瘦身

### 改进
- 应用图标 N 字母改为白色填充，与深色背景和阴影形成清晰区分。
- Windows 安装包体积从 132 MB 缩小至 92 MB（-30%），app.asar 从 143 MB 降至 6.5 MB（-95%）。

### 修复
- AI 助手移除串行 Router 请求以避免 Edge Function 超时；默认改用稳定的 DeepSeek-V3.2 模型，V4 或其他模型失败时自动回退，旧 V4 设置自动迁移。

## 2026-06-21 · Continuous year calendar

### Added
- Clicking the workspace month and year now opens a continuous year calendar with direct navigation to the previous year, next year, today, or any date.
- Added latest Windows installer downloads to the website and Web workspace settings; the desktop app checks for updates every 24 hours and also supports manual download and restart-to-install.

### Improved
- The year calendar keeps Today's Candidates visible in landscape and uses a full-width month canvas while retaining the main Execute, Planning, and Add dock in portrait; the current month, selected date, today, and scheduled dates are clearly marked.
- The year calendar automatically focuses the current month, preserves the viewed month across year and orientation changes, and inherits the active page theme and interaction accent.
- The Windows desktop app now uses the same account and cloud workspace as the web app, so tasks, schedules, and settings sync when users sign in with the same account.
- The Windows desktop app now opens the `/app` workspace directly and no longer shows the marketing homepage inside the app window; the window, executable, installer, and shortcut consistently use the NavoPath name and brand icon.
- Portrait timeline tasks now require a short hold before dragging, with narrower horizontal hit areas for date arrows.
- Windows installer size is much smaller, downloads and installs faster; auto-update, PDF, DOCX, image OCR, and Supabase sync all remain available.

### Fixed
- Fixed the project list being obscured during portrait quick add, matched the task title field to dark mode, and restored an explicit close button in task and event details.

## 2026-06-20 · More reliable scheduling and connections

### Added
- The MCP settings section now shows the server endpoint, client configuration, and copyable personal access tokens directly in the app.
- Added a portrait workspace dock with mode switching, top quick add, and an expandable Navo AI prompt.

### Improved
- The marketing site now stays at the root URL, while sign-in, sign-up, email confirmation, and password recovery consistently enter the workspace at `/app`.
- Reorganized Settings into clear Page, Navo AI, MCP, and Account navigation for desktop and mobile.
- The entire right calendar panel can now drive timeline scrolling, including its heading, all-day row, and view controls.
- Multi-device sync now treats cloud data as the baseline, replays only explicitly pending local changes, and refreshes queued realtime updates after saving.
- Candidate tasks, all-day tasks, and timed blocks now share consistent drag feedback; like Trevor AI, all-day tasks can return directly to Today's Candidates with a paper preview that names the current target.
- About NavoPath now opens the changelog directly; the changelog follows the account language by default and can be switched independently in the top-right corner.
- Execute now switches between single-canvas Tasks and Schedule views on narrow screens, with touch-friendly Day and Month views.
- Planning no longer uses a temporary candidate basket; tasks and subtasks can move directly from the tree into Today's Candidates with undo support.
- Portrait layout now activates only below 900px; Navo AI opens from the top-left icon, Plan Suggestions live in the conversation panel, and the bottom dock is limited to mode switching and add.
- Portrait schedule controls now sit beside the date with one Day/Month toggle; dragging a candidate from Tasks automatically enters the timeline for placement.
- Portrait dates are now geometrically centered, with date arrows grouped before the Day/Month control; timed tasks can return to Today's Candidates from the left ruler area.
- Removed visible control borders from the portrait header and dock, shifted and enlarged the Navo icon, and gave the add button a fuller circular shape.
- The portrait Day control now opens a menu for Day, 3 Day, Week, and Month views; extra bottom scroll space keeps post-23:00 placement clear of the dock.

### Fixed
- Fixed missing MCP configuration guidance, silent token-generation failures, and the misaligned Chinese Generate button.
- Fixed unreliable dragging from the all-day row back to the timeline or Today's Candidates, and stopped the timeline from scrolling while a task is held over the all-day row; the row remains clean without gray fill or an overlapping color strip.

## 2026-06-19 · A clearer task workspace

### Added
- Added staged AI thinking feedback, capability-aware reasoning modes, and restorable task confirmation cards.
- Upgraded MCP to standard Streamable HTTP with a complete client configuration guide.

### Improved
- Reorganized Settings into Page, Navo AI, MCP, and Account sections, widened the panel, and aligned checks with task completion.
- Restored natural trackpad and momentum scrolling in the timeline and AI chat, and now show the Execute skeleton immediately at startup.
- Use charcoal text in light mode and warm ivory text with a default interaction accent in dark mode.
- Automatically convert legacy events into scheduled tasks so the workspace uses one task-based planning model.
- Added revision conflict merging, deletion records, offline retry, and real-time updates for multi-device sync.

### Fixed
- Fixed adding subtasks from task editing and made the task title field grow with multiline titles.
- Fixed AI task confirmations disappearing after restoring a conversation.

## 2026-06-18 · Workspace flow

### Added
- Added drag ordering and cross-project movement for projects, tasks, and subtasks in Planning.
- Added continuous date browsing in Month view.
- Added moving tasks from Today's Candidates back to Planning.
- Added remote HTTP MCP and personal access-token management.

### Improved
- Open Add Task by typing in the workspace.
- Follow and restart the complete onboarding workflow.
- Resolve relative AI dates using the user's local timezone.
- Prevent accidental text selection while dragging timeline tasks.

## 2026-07-01 · Planning views and task timer restored

### Added
- Planning view now offers Kanban (To do / Doing / Done drag-and-drop), Eisenhower four-quadrant (important × urgent drag-and-drop), and List views, with a view switcher and filter panel (project, status, importance, urgency).
- Task-level timer: start timing from a candidate task; the header center shows the active timer task and elapsed time with pause, save, and discard controls; saving writes a time entry.
- Focus overlay: full-screen timer display with Stopwatch / Pomodoro / Flowtime mode switching for focused execution.
- Settings → Features section: toggle Kanban, Quadrant, and List views independently, and set the default focus mode plus idle threshold.

### Improved
- Planning filter bar adds a "Show completed" toggle and a "Filter" panel entry; the view switcher button group adopts the paper style.

## 2026-06-29 · Template mode and 1.2.32 release prep

### Added
- Execute template mode now supports reusable template management: create custom templates, add or remove periods, save them, and apply only the checked periods to the currently selected timeline date.

### Improved
- Built-in templates are now named Default 1 / Default 2; the Template button moved into the right-side view switcher, and the larger paper-style dialog avoids overlap with Day / 3-Day / Week / Month controls while zooming.
- Period checkboxes now render as clear empty boxes with check marks instead of solid color chips; when a daily goal is blank, the period name is used for the created time block.
- Custom templates are saved with local and cloud-synced planner data and can be deleted directly from the template dialog without affecting already-created tasks.

## 2026-06-27 · Cloud sync, AI, and responsive layout fixes

### Improved
- New users and local preview now default to light mode for the paper-like NavoPath reading experience.
- Narrow landscape windows keep Today Candidates on the left and the timeline on the right; single-view switching is reserved for portrait layouts.
- Settings cloud sync, accent color, Navo AI, and account areas now use flatter paper-style grouping with stronger dark-mode contrast.
- Account settings now show plan status in a dedicated subscription section, with Pro benefits open during the dev preview, and moves logout/about/delete actions into More.
- Account settings now split plan access into Free, Supporter, and Pro tiers and add an Afdian donation entry; the website homepage also includes a restrained donation link.
- Plugins / MCP documentation now uses a changelog-style paper page and makes clear that the current build only supports official built-in plugins shipped with the app.
- Official plugins now have Chinese names, descriptions, config labels, and enabled-state guidance; enabled tools expose Pomodoro, habit check-ins, a local weather badge, and task notes.
- AI model fallback choices now cover DeepSeek, Qwen, GLM, Kimi, MiniMax, Step, Nex, and Ling families.

### Fixed
- Fixed same-account sign-in on a fresh browser or reinstalled desktop app sometimes loading empty data; cloud profile load failures no longer silently replace the workspace with an empty profile.
- Fixed Push to cloud and Pull from cloud being skipped by pending local save queues; manual push flushes local changes first, and manual pull explicitly applies cloud data.
- Fixed Navo AI requests failing repeatedly when a model or reasoning level is incompatible, and made AI memory generation follow the current English/Chinese mode.
- Fixed the AI dialog bottom Reasoning control, project color pickers closing while selecting custom colors, Plan Suggestions covering 3-day/week dates, and collapsed/fullscreen range views not entering simplified display.
- Fixed AI requests failing when a model does not support JSON response_format by retrying without that option and keeping the stable model fallback.
- Fixed Plan Suggestions not collapsing into a compact calendar button in narrow landscape 3-day/week views.
- Removed the duplicate Cloud sync heading in Account settings and added an external-link hint to About NavoPath.
- Fixed resize previews drifting while dragging or resizing timeline blocks in 3-day/week views; short and long tasks now share hover-only resize handles, and short tasks reveal their project on hover.

---

## 2026-06-26 · Short-block resize, sync direction, and update detection

### Improvements
- Settings → Cloud sync now exposes dedicated "Push to cloud" and "Pull from cloud" direction buttons: upload this device's data alone, or overwrite this device with cloud data alone, without forcing a bidirectional merge every time — cross-device sync is now fully under your control.
- Refined task-block resize handles: the hit area is now a centered quarter of the block width so it never crowds the title, and the indicator is a thinner always-visible line that brightens on hover for less visual clutter.

### Fixes
- Fixed 15-minute and 30-minute short tasks being unable to adjust duration: short blocks can now be resized from both the top and bottom edges, with handles horizontally centered on the block, clearly visible on hover, and no longer conflicting with drag-to-move.
- Fixed the desktop app always reporting "up to date" when checking for updates; the update manifest (latest.yml) was stuck on an old version and is now regenerated correctly with each release, so new versions are detected reliably.
- Fixed duplicate background windows being created: createWindow() now reuses an existing window instead of creating a new one when called from the tray menu or app.activate events, ensuring the app only ever maintains a single visible window.

---

## 2026-06-25 · Short-block display and deletion stability

### Improved
- Settings → Plugins page rebuilt on a unified plugin registry: the Enable/Disable buttons now persist to settings and fire plugin lifecycle hooks, and Configure opens a form dialog to edit that plugin's fields (focus minutes, city, markdown toggle, etc.) with instant effect.
- The Sync button now shows a spinner during the operation and surfaces clear results: "Sync complete", "Already up to date", or a failure toast, instead of silently doing nothing.
- Added a "Launch at startup" toggle in Settings so NavoPath can open automatically when you sign in to Windows.
- Added a single-instance lock to the desktop app; launching a second copy now focuses the running window instead of opening a duplicate.
- Raised the minimum font size for 15-minute short task titles to 12px with antialiasing enabled, fixing blurry text; added a "Timeline font size" slider (85% – 130%) under Settings → Appearance so the size can be tuned for any screen.
- Redesigned the timeline quick-add popup as a single-line compact layout: removed the top time-display area, keeping only the task-name input and a confirm check button for faster entry.
- Widened the timeline left/right navigation buttons from 36px to 48px and extended the horizontal touch hit area via a pseudo-element, reducing missed taps and misfires.

### Fixed
- Fixed task blocks in "color fill" mode losing their project color when completed; the completed state now only lowers opacity while keeping the original color, and the strikethrough is layered on top so visual consistency is restored.
- Fixed signed-in users being forced into local preview mode (and unable to sign out) when the cloud profile query failed; profile failures now degrade to in-memory empty data so the signed-in session stays usable.
- Fixed the runtime fallback flag being persisted to localStorage, which permanently trapped the app in a temporary preview mode; the fallback now lasts only for the current session, the next launch retries the cloud backend, and stale persisted flags from earlier builds are cleaned up.
- Fixed deleted candidate task cards on the Execute page reappearing after deletion; all deletion paths now read from `dataRef.current` to eliminate stale-closure races.
- Fixed tasks reappearing after being deleted from the task detail drawer.
- Fixed the original task reappearing after being converted to an event.
- Fixed the app getting stuck on the loading screen when the cloud database query fails; it now automatically falls back to local preview mode so the workspace remains usable.
- Fixed the for-ever preview mode issue; runtime fallback now lasts only for the current session, so the next launch retries the cloud backend.
- Fixed 15-minute single-line task titles being clipped by resize handles and the checkbox in the timeline; the title now owns the full block height and is vertically centered without clipping.
- Fixed garbled encoding in the `package.json` description field.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-23 · More reliable desktop sign-in and sync

### Improved
- The Windows desktop app now keeps sign-in sessions in encrypted system storage, so users return directly to the workspace after closing the app or restarting the computer; signing out explicitly clears the session.
- Signed-out Windows desktop users now see a focused sign-in and registration screen instead of the marketing introduction; the website landing page remains unchanged.
- Multi-device sync now merges the latest version instead of overwriting cloud data with local data, so tasks and plans added on other devices are no longer accidentally deleted.
- Dark mode now uses a minimal neutral-gray palette inspired by Claude Code, removing blue-purple tints for higher contrast on text, cards, and settings panels.
- Accent color swatches and navigation items in Settings now use neutral backgrounds in dark mode instead of blue-purple highlights.
- The NavoPath logo in the top-left corner stays crisp in both light and dark modes, with the inverted-color filter removed.
- Setting the day start time now smoothly scrolls the timeline to that hour and shows a confirmation toast.
- The default font size is slightly larger for more comfortable reading.

### Fixed
- Fixed 3 Day, Week, and Month view switch buttons being blocked by the timeline left/right navigation hot zones.
- Fixed the desktop "Restart and install" action crashing with `quitAndInstall is not a function` after an update download, preventing the installer from launching.
- Fixed some text in dark mode remaining black and hard to read.
- Fixed 15-minute task titles being truncated in the timeline.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-24 · Timeline quick-add and short-block fixes

### Improved
- Redesigned the timeline quick-add popup as a unified card with a time label, input field, and project picker menu for a more cohesive look — no more fragmented floating layers.
- The "Day start time" setting now supports minute precision (e.g. 09:30); the timeline grid, task blocks, now-line, and drop targeting all align to the exact start.
- Overlapping tasks in the same time slot are no longer capped at 4 columns — every task gets its own column and none are hidden behind another.

### Fixed
- Fixed the quick-add panel appearing when clicking on an existing task block; it now only triggers on blank timeline slots.
- Fixed 15-minute short task blocks having clipped titles and non-functional resize handles.
- Fixed the quick-add panel staying open and persisting after saving a task; it now closes automatically while remembering the last project selected.
- Fixed timeline misalignment when rapidly clicking the add button after changing the day start time.
- Fixed deleted sub-pages on the Planning page temporarily disappearing then reappearing, preventing successful deletion.
- Fixed button and icon layout misalignment on the Planning page after adding a large number of subtasks.
- Fixed the clicked day jumping to the leftmost column in 3-day and week views after quick-add a task; the view now stays put when the target date is already visible.
- Fixed left/right date switching in the timeline not responding.
- Fixed the quick-add confirm button turning white and nearly invisible in dark mode; it is now a solid accent-colored button again.

---

Visit [www.navopath.com](https://www.navopath.com) to start your NavoPath journey!

## 2026-06-22 · Clearer week view and desktop icon

### Added
- The web and desktop apps now auto-sync cloud tasks, schedules, and settings every hour by default; open Settings → Account → Cloud sync to change it to every 15 minutes, every 6 hours, every 24 hours, or to disable auto-sync and rely on manual sync only.
- Settings → Account now includes a "Sync now" button that pushes local changes to the cloud and pulls the latest version on demand; the button shows "Syncing…" and is disabled while a sync is in flight.
- The last sync time is recorded and synced with the account across devices, and the Account page shows a relative timestamp ("Just now / N minutes ago / N hours ago") plus the absolute date and time.

### Improved
- The desktop icon now uses a white N face, black dimensional shadow, and transparent outer canvas so it stays clear in light and dark system surfaces.
- Collapsing Today's Candidates now consistently switches 3 Day, Week, and Month views into the compact reading mode.
- 15‑minute task blocks in the week view now show readable titles by removing the redundant check and inner padding so the title fits the narrow column.

### Fixed
- Fixed timeline fullscreen inheriting the normal workbench height and leaving a large blank area; fullscreen now fills the entire available viewport.
- View release notes now reliably opens the in-app changelog instead of depending on a temporary or untagged GitHub release URL.
- Fixed the daily timeline leaving a large blank band above 0:00 and below the all‑day bar when the day had no tasks; 0:00 now sits directly under the all‑day bar.

## 2026-06-21 · Continuous year calendar

### Added
- Clicking the workspace month and year now opens a continuous year calendar with direct navigation to the previous year, next year, today, or any date.
- Added latest Windows installer downloads to the website and Web workspace settings; the desktop app checks for updates every 24 hours and also supports manual download and restart-to-install.

### Improved
- The year calendar keeps Today's Candidates visible in landscape and uses a full-width month canvas while retaining the main Execute, Planning, and Add dock in portrait; the current month, selected date, today, and scheduled dates are clearly marked.
- The year calendar automatically focuses the current month, preserves the viewed month across year and orientation changes, and inherits the active page theme and interaction accent.
- The Windows desktop app now uses the same account and cloud workspace as the web app, so tasks, schedules, and settings sync when users sign in with the same account.
- The Windows desktop app now opens the `/app` workspace directly and no longer shows the marketing homepage inside the app window; the window, executable, installer, and shortcut consistently use the NavoPath name and brand icon.
- Portrait timeline tasks now require a short hold before dragging, with narrower horizontal hit areas for date arrows.
- Windows installer size is much smaller, downloads and installs faster; auto-update, PDF, DOCX, image OCR, and Supabase sync all remain available.

### Fixed
- Fixed the project list being obscured during portrait quick add, matched the task title field to dark mode, and restored an explicit close button in task and event details.

## 2026-06-20 · More reliable scheduling and connections

### Added
- The MCP settings section now shows the server endpoint, client configuration, and copyable personal access tokens directly in the app.
- Added a portrait workspace dock with mode switching, top quick add, and an expandable Navo AI prompt.

### Improved
- The marketing site now stays at the root URL, while sign-in, sign-up, email confirmation, and password recovery consistently enter the workspace at `/app`.
- Reorganized Settings into clear Page, Navo AI, MCP, and Account navigation for desktop and mobile.
- The entire right calendar panel can now drive timeline scrolling, including its heading, all-day row, and view controls.
- Multi-device sync now treats cloud data as the baseline, replays only explicitly pending local changes, and refreshes queued realtime updates after saving.
- Candidate tasks, all-day tasks, and timed blocks now share consistent drag feedback; like Trevor AI, all-day tasks can return directly to Today's Candidates with a paper preview that names the current target.
- About NavoPath now opens the changelog directly; the changelog follows the account language by default and can be switched independently in the top-right corner.
- Execute now switches between single-canvas Tasks and Schedule views on narrow screens, with touch-friendly Day and Month views.
- Planning no longer uses a temporary candidate basket; tasks and subtasks can move directly from the tree into Today's Candidates with undo support.
- Portrait layout now activates only below 900px; Navo AI opens from the top-left icon, Plan Suggestions live in the conversation panel, and the bottom dock is limited to mode switching and add.
- Portrait schedule controls now sit beside the date with one Day/Month toggle; dragging a candidate from Tasks automatically enters the timeline for placement.
- Portrait dates are now geometrically centered, with date arrows grouped before the Day/Month control; timed tasks can return to Today's Candidates from the left ruler area.
- Removed visible control borders from the portrait header and dock, shifted and enlarged the Navo icon, and gave the add button a fuller circular shape.
- The portrait Day control now opens a menu for Day, 3 Day, Week, and Month views; extra bottom scroll space keeps post-23:00 placement clear of the dock.

### Fixed
- Fixed missing MCP configuration guidance, silent token-generation failures, and the misaligned Chinese Generate button.
- Fixed unreliable dragging from the all-day row back to the timeline or Today's Candidates, and stopped the timeline from scrolling while a task is held over the all-day row; the row remains clean without gray fill or an overlapping color strip.

## 2026-06-19 · A clearer task workspace

### Added
- Added staged AI thinking feedback, capability-aware reasoning modes, and restorable task confirmation cards.
- Upgraded MCP to standard Streamable HTTP with a complete client configuration guide.

### Improved
- Reorganized Settings into Page, Navo AI, MCP, and Account sections, widened the panel, and aligned checks with task completion.
- Restored natural trackpad and momentum scrolling in the timeline and AI chat, and now show the Execute skeleton immediately at startup.
- Use charcoal text in light mode and warm ivory text with a default interaction accent in dark mode.
- Automatically convert legacy events into scheduled tasks so the workspace uses one task-based planning model.
- Added revision conflict merging, deletion records, offline retry, and real-time updates for multi-device sync.

### Fixed
- Fixed adding subtasks from task editing and made the task title field grow with multiline titles.
- Fixed AI task confirmations disappearing after restoring a conversation.

## 2026-06-18 · Workspace flow

### Added
- Added drag ordering and cross-project movement for projects, tasks, and subtasks in Planning.
- Added continuous date browsing in Month view.
- Added moving tasks from Today's Candidates back to Planning.
- Added remote HTTP MCP and personal access-token management.

### Improved
- Open Add Task by typing in the workspace.
- Follow and restart the complete onboarding workflow.
- Resolve relative AI dates using the user's local timezone.
- Prevent accidental text selection while dragging timeline tasks.
