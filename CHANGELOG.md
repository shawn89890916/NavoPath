# NavoPath 更新日志

## 2026-06-20 · 更可靠的排程与连接

### 新功能
- 设置中的 MCP 分区现在直接显示服务地址、客户端配置和可复制的个人访问令牌。
- 竖屏工作区新增底部模式工具坞、顶部快速添加和可展开的 Navo AI 输入。

### 改进
- 官网现在固定使用根路径，登录、注册、邮箱确认和密码重置后统一进入 `/app` 工作区。
- 设置改为清晰的页面、Navo AI、MCP 和账户分区导航，并适配桌面与移动端。
- 整个右侧日历面板都可驱动时间轴滚动，全天栏、标题和视图控件不再阻断滚轮操作。
- 跨设备同步以云端为基线，只重放明确尚未上传的本地修改，并在保存后接收排队的实时更新。
- 候选任务、全天任务和时间块使用一致的拖动反馈；全天任务可像 Trevor AI 一样直接拖回今日候选，拖动纸片会明确显示当前落点。
- “关于 NavoPath”现在直接打开更新日志；日志默认跟随账户语言，并可在页面右上角单独切换。
- Execute 在窄屏下改为任务与日程单画布切换，并提供适合手机的日视图和月视图。
- Planning 移除临时候选篮，任务和子任务可从树中直接加入今日候选并撤销。
- 竖屏布局改为仅在 900px 以下启用；Navo AI 移到左上角图标，计划建议并入对话面板，底部工具坞收敛为模式切换与新增。
- 竖屏日程控件紧贴日期并以单按钮切换日/月视图；从任务画布拖动候选任务时会自动进入时间轴继续选择落点。

### 修复
- 修复 MCP 配置说明不显示、令牌生成失败后无反馈，以及中文生成按钮错位的问题。
- 修复全天任务无法稳定拖回时间轴或今日候选，以及悬停在全天栏时底部时间轴仍继续滚动的问题；全天栏保持干净的无灰底、无重叠色条样式。

## 2026-06-19 · 更清晰的任务工作区

### 新功能
- AI 对话新增分段思考提示、可用模型的思考模式选择，以及可恢复的任务安排确认。
- MCP 升级为标准 Streamable HTTP 服务，并提供完整的客户端配置指南。

### 改进
- 设置按页面、Navo AI、MCP 和账户重新分类，面板更宽，勾选样式与任务完成保持一致。
- 时间轴和 AI 对话恢复自然的触控板与惯性滚动；启动时直接显示执行页骨架。
- 浅色模式使用炭黑文字，深色模式使用暖米色文字和默认交互强调。
- 旧事件会自动转为时间任务，新工作区统一使用任务完成计划与排程。
- 多设备同步增加版本冲突合并、删除记录、离线重试和实时更新。

### 修复
- 修复任务编辑页无法添加子任务，以及多行任务名输入框高度固定的问题。
- 修复 AI 任务安排确认在会话恢复后丢失的问题。

## 2026-06-18 · 工作区流程

### 新功能
- Planning 支持项目、任务和子任务拖动排序及跨项目移动。
- 月视图支持连续滚动浏览日期。
- 今日候选可以将任务移回 Planning。
- 新增远程 HTTP MCP 和个人访问令牌管理。

### 改进
- 输入文字时可直接打开添加任务栏。
- 新手指南覆盖完整工作流并可随时重新开始。
- AI 使用用户本地时区判断相对日期。
- 修复拖动时间轴任务时意外选中文字的问题。

# NavoPath Changelog

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
