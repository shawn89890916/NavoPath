# NavoPath 更新日志

## 2026-07-05 · 重要程度/紧急程度图标选择器

### 修复
- 修复选中态不生效的持久化 bug：表单初始化使用 `??` 运算符将 `null`（未设置）误回落到 `priority ?? "high"`，导致重新打开抽屉后"未设置"状态丢失。改为 `!== undefined` 检查以保留显式 `null`。
- 修复选中态 CSS 被全局 `.df-app button` 的 `!important` 规则覆盖的问题：全局按钮规则 `.df-app button:not(.df-resize-dot)` 强制设置 `border-color: var(--pencil-rule)`，覆盖了选中描边。将 `.df-level-option` 加入所有全局按钮规则的 `:not()` 排除列表，并将选中态改为显式 `data-selected="true"` 属性选择器 + 内联 `--option-color` CSS 变量。
- 选中态视觉反馈改为真正的按钮自身描边：每个 option 始终保留 `border: 2px solid transparent` 预留空间，选中时 `border-color` 切换为该选项语义色，配 8% 语义色底色；未选中项 `border-color: transparent`。描边不再使用 box-shadow 伪边框，分割线不再使用按钮自身的 `border-right`，改由容器 `gap: 1px` + `background: var(--paper-rule)` 形成，避免覆盖选中描边。

### 改进
- 任务抽屉的“重要程度/紧急程度”控件从纯文字按钮“高/中/低”重构为连接式分段图标选择器（segmented control），四段共享外框与圆角，段间以细分隔线划分。
- 重要程度使用标准 Lucide 风格旗帜图标，紧急程度使用横向文本感叹号，颜色统一为柔和 NavoPath 色板。
- 新增“未设置”选项，点击可立即清空对应字段。
- Matrix 四象限映射保持 high/non-high 逻辑，未引入 3x3 矩阵。
- 任务抽屉每行新增“当前：X”文本徽章，实时显示当前重要程度/紧急程度值，点击后立即更新，关闭重开抽屉仍保持一致。
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

## 2026-07-05 · Importance / Urgency icon selectors

### Fixes
- Fixed selected-state persistence bug: form initialization used `??` operator which treated `null` (unset) as falsy and fell through to `priority ?? "high"`, causing "unset" state to be lost on drawer reopen. Changed to `!== undefined` check to preserve explicit `null`.
- Fixed selected-state CSS being overridden by global `.df-app button` `!important` rules: the global button rule `.df-app button:not(.df-resize-dot)` forced `border-color: var(--pencil-rule)`, overriding the selected border. Added `.df-level-option` to every global button rule's `:not()` exclusion list, and switched the selected state to an explicit `data-selected="true"` attribute selector with an inline `--option-color` CSS variable.
- Selected-state visual feedback is now a real border on the button itself: every option keeps `border: 2px solid transparent` reserved, and the selected option switches `border-color` to its semantic color with an 8% semantic tint; unselected options use `border-color: transparent`. The border is no longer a box-shadow ring, and segment dividers no longer use the button's own `border-right` — they come from the container's `gap: 1px` + `background: var(--paper-rule)` so they never overwrite the selected border.

### Improvements
- Refactored the task drawer's "Importance / Urgency" controls from plain text buttons into a connected segmented icon strip sharing one outer border and rounded corners, with thin dividers between segments.
- Importance uses standard Lucide-style flag icons, urgency uses horizontal text exclamation marks, colors unified to muted NavoPath palette.
- Added an "unset" option; clicking it immediately clears the field.
- Matrix quadrant mapping keeps the high/non-high logic; no 3x3 matrix was introduced.
- Each drawer row now shows a "Current: X" text badge reflecting the live importance/urgency value; it updates immediately on click and stays consistent after closing and reopening the drawer.
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
