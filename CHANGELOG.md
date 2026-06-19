# NavoPath 更新日志

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
