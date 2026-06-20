# NavoPath 更新日志

## 2026-06-20 · 更可靠的排程与连接

### 新功能
- 设置中的 MCP 分区现在直接显示服务地址、客户端配置和可复制的个人访问令牌。

### 改进
- 设置改为清晰的页面、Navo AI、MCP 和账户分区导航，并适配桌面与移动端。
- 整个右侧日历面板都可驱动时间轴滚动，全天栏、标题和视图控件不再阻断滚轮操作。
- 跨设备同步以云端为基线，只重放明确尚未上传的本地修改，并在保存后接收排队的实时更新。
- 候选任务、全天任务和时间块使用一致的拖动反馈；全天栏会显示明确的放置占位，今日候选和全天任务拖入时间轴时也会以时间块样式显示即将放置的位置。
- “关于 NavoPath”现在直接打开更新日志；日志默认跟随账户语言，并可在页面右上角单独切换。

### 修复
- 修复 MCP 配置说明不显示、令牌生成失败后无反馈，以及中文生成按钮错位的问题。
- 修复全天快速添加层意外覆盖任务、今日候选无法拖入时间轴或全天栏、全天任务无法拖出重新排程，以及拖动时选中文字的问题。

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

### Improved
- Reorganized Settings into clear Page, Navo AI, MCP, and Account navigation for desktop and mobile.
- The entire right calendar panel can now drive timeline scrolling, including its heading, all-day row, and view controls.
- Multi-device sync now treats cloud data as the baseline, replays only explicitly pending local changes, and refreshes queued realtime updates after saving.
- Candidate tasks, all-day tasks, and timed blocks now share consistent drag feedback; the all-day row shows a clear drop placeholder, while candidates and all-day tasks show their pending timeline position as a timed block.
- About NavoPath now opens the changelog directly; the changelog follows the account language by default and can be switched independently in the top-right corner.

### Fixed
- Fixed missing MCP configuration guidance, silent token-generation failures, and the misaligned Chinese Generate button.
- Fixed the all-day quick-add layer covering tasks, dragging Today's Candidates into the timeline or all-day row, dragging all-day tasks out to reschedule them, and accidental text selection while dragging.

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
