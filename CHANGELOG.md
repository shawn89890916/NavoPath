# NavoPath 更新日志

## 2026-09-02 · Navo AI 提醒

### 改进
- Navo AI 的主动提醒现在会实时出现在工作区顶栏：未读数量清晰可见，点击即可打开提醒；允许系统通知后，新提醒也会在应用外显示。每日开工与收工简报对新账户默认开启。

## 2026-09-01 · Navo AI 主动助理

### 改进
- Navo AI 主动助理现可在工作时间主动发现未补记的空档，并让你将这段实际时间关联到未完成任务，或直接新建为已完成任务；对应的历史完成块会清晰但低调地保留在时间轴中。
- 任务、项目和习惯现在可在详情末尾互相转换；空项目获得稳定的树形拖放命中区，任务可直接归属到其中。拖拽只负责项目归属与同级排序，不再改变任务、项目或子任务的类型。任务详情改为更清晰的项目、时长、标记、状态、截止日、排程与子任务层级，移除紧急度与 Importance 文案；截止日使用更长的日期栏和重置入口，改期与重复同时提供详细设置和带下拉箭头的快捷选项。任务和项目都支持截止日；新建时间轴任务默认把截止日设为明天，过期未完成任务会自动回到今日候选，主动助理也会在开工简报中引导处理临近截止的任务。
- 规划工作区现在以与 Execute 一致的暖纸层级呈现：左侧栏专用于树、看板、矩阵、列表和指标切换，所有视图的项目与任务块使用纯白纸面、加粗且不透明的项目色条与清晰项目标记，并可关闭规划说明。右下角添加直接打开同一行、选中态明确的任务、项目、习惯切换抽屉。候选、看板、矩阵、列表与规划树共用四边空槽的拖放反馈：源卡一经拖起便离开原位，带轻斜和中性阴影的原样卡片跟随指针，目标及后续项目稳定让位。拖动规划树会临时展开全部项目，候选与规划树都只在当前命中的项目或任务位置显示一个完整空槽；排序会持久化到原任务（包括重复任务），跨项目时同步更新归属。编辑抽屉内的项目与任务现在可相互转换并正常保存，拖动到可滚动区域边缘会自动滚动。未归属和循环任务现在同样可拖动、排序与排程。

## 2026-08-31 · 今日候选分组与时间轴留白

### 改进
- Navo AI 现以主动日程助理方式默认启用：首次说明后可直接调整普通任务，并保留 24 小时撤销；锁定日程、硬截止和删除仍要求确认。助理会从实际计时持续学习可靠的项目时段与任务时长，并在工作时间发现未安排的过去空档时提醒补记。空档提醒可直接选择现有任务或新建已完成任务，将实际时长和低调的历史完成块写入时间轴。定位授权后，晨间简报会使用账户设备位置提供本地天气；这些行为均可在 Navo AI 设置中单独关闭或调整。
- 今日候选默认按项目分组，并提供仅图标的“按项目分类”按钮和固定勾选图标的“显示已完成”开关；是否显示仅用选中状态表示。未排程的未完成任务保留时长、排程与展开更多；已完成或已排程任务右侧统一显示日期、星期和开始时间，点击时间可定位到时间轴，点击任务其他区域仍打开详情。重复标记改为清晰的右上角悬挂图标，不再单独缩短重复任务行的右边宽度。暗色候选行同步修正纸面与文字对比度。
- 习惯编辑页改为与任务设置一致的纸面字段节奏：可在点击计数与累积时长间切换，分别设置目标次数或 15 分钟粒度的时长；工作日拥有清晰选中反馈，启用状态改为开关，并通过保存按钮统一提交。顶部新增按周查看的单习惯完成图，可翻阅每一天的完成情况。
- 重写主页与账号弹窗的中文文案，不再沿用英文句式，改用更自然、口语化的表达。
- 主页首屏重新以导航底线与产品纸面之间的留白为视觉中心：NavoPath 与 slogan 上移、更靠近 N 标志，产品纸面以更克制的高度露出；恢复置于首屏底层、会被升起纸面遮住的上箭头和“继续探索”提示，并扩大顶栏左右两侧的品牌和账号操作留白。

- 收紧候选快速添加栏的左右与底部内边距，并将全天分隔线收至略宽于时间轴内容；日程时段画布随时间轴扩展，项目分组使用统一的小型系统圆点标识。
- 快速添加栏移除左侧竖线，输入底线延至项目选择区；今日候选右缘提供无可见把手的宽幅拖拽命中区域。主页产品预览更新为当前 Execute 工作区，并随语言切换展示中英文的日常职场任务与日程。
- 日视图的时间轴改为更聚焦的窄阅读列；3 天和周视图共用更宽、左右等距的时间轴画布。
- 三天和周视图中，收起今日候选会真正缩为可展开的窄栏；“显示已完成”和“按项目分类”沿用统一的无框下划线选中态。周视图任务会自然换行，并移除任务左侧的完成控件，避免狭窄列中的无效占位。

### 修复
- 恢复 Execute 时间轴底卡的四角圆角，收窄左右下外边距；保持今日候选宽度与横向位置不变，略微上移，使其相对底卡的上、左、下留白统一为 6px；右移日期箭头与 Day / 3-Day / Week / Month 的纵向控件列对齐。
- 修复三天和周视图的全屏模式仍继承候选栏窄列的问题；全屏现在只保留完整时间轴与退出入口，不会再出现被压缩或空白的画布。

## 2026-09-02 · Navo AI notifications

### Improved
- Navo AI proactive messages now arrive live in the workspace header with a clear unread count and one-click access. Once system notifications are allowed, new messages also appear outside the app. Daily start and end briefs are enabled by default for new accounts.

## 2026-09-01 · Navo AI Proactive Assistant

### Improved
- Navo AI Proactive Assistant can now identify unlogged gaps during working hours and let you attach that actual time to an unfinished task or create it as a completed task; its completed historical block remains clear but understated on the timeline.
- Tasks, projects, and habits can now convert to each other from the bottom of their detail view. Empty projects have a stable tree drop target so tasks can be assigned directly into them. Dragging now handles project assignment and peer ordering only; it no longer changes a task, project, or subtask into another type. Task detail now follows a clearer project, duration, flag, status, due-date, scheduling, and subtask rhythm, with urgency and the visible Importance label removed. Due dates use a wider date field with Reset, while rescheduling and recurrence each offer both detailed settings and arrow-triggered shortcuts. Both tasks and projects support due dates; newly created timeline tasks default their due date to tomorrow, overdue unfinished tasks return to Today’s Candidates, and the proactive assistant guides work on approaching deadlines in the start brief.
- The Planning workspace now uses the same warm-paper hierarchy as Execute: its left rail is dedicated to Tree, Board, Matrix, List, and Metrics, and all views use clean white project and task blocks with thicker opaque project-color bars, clear project marks, and a dismissible planning note. The lower-right Add action opens a side drawer with Task, Project, and Habit on one row and a clear selected state. Candidates, Board, Matrix, List, and the Planning tree now share one four-sided empty-slot drag treatment: the source leaves its old position immediately, while an unchanged task card with a slight tilt and neutral shadow follows the pointer and destination items make stable room. Dragging in the Planning tree temporarily expands every project, while Candidates and the tree show one full empty slot only at the currently hit project or task. Ordering now persists to the underlying task, including recurring tasks, and crossing projects also updates ownership. Projects and tasks can now be converted between each other and saved from the edit drawer, and dragging near a scrollable edge scrolls it automatically. Unassigned and recurring tasks can now also be dragged, reordered, and scheduled.

## 2026-08-31 · Candidate grouping and timeline spacing

### Improved
- Navo AI is now enabled by default as a proactive schedule assistant: after a first-run explanation it can directly adjust ordinary tasks with a 24-hour undo window, while locked schedules, hard deadlines, and deletion still require confirmation. It continuously learns reliable project timing and task durations from actual time records, and asks to log unplanned past gaps during working hours. Gap reminders let you choose an existing task or create a completed one, then write actual time and a quiet historical completion block to the timeline. With location permission, morning briefs use the account device location for local weather; each behavior can be adjusted or turned off in Navo AI settings.
- Today's Candidates groups tasks by project by default, with icon-only Group by project and a Show completed control that always uses a checked-square icon; selection alone indicates whether completed tasks are visible. Open, unscheduled tasks retain duration, scheduling, and expand actions; completed or scheduled tasks show an aligned date, weekday, and start time on the right. Clicking the time locates it on the timeline, while clicking elsewhere opens task details. Recurrence markers are now crisp upper-right hanging icons that no longer shorten recurring rows on their own. Dark candidate rows also regain readable paper-and-ink contrast.
- Habit editing now follows the task editor’s paper-field rhythm: switch between Click Counter and Duration, then set a target count or a 15-minute duration. Weekdays have clear selected feedback, Enabled is a switch, and Save commits the settings together. A weekly, per-habit completion view at the top lets users review each day.
- Rewrote the Chinese copy across the homepage and account dialog with natural, conversational phrasing rather than English sentence structures.
- Rebalanced the homepage around the open space between the navigation and product paper: the NavoPath name and slogan sit higher and nearer the N mark while the product paper has a more restrained reveal. The upward “Continue exploring” cue remains beneath the rising paper so it is naturally covered on scroll, and the header’s outer brand and account margins are wider.

- Tightened the quick-add bar's left, right, and bottom insets, shortened the all-day divider to just exceed the timeline content, expanded the daily schedule canvas with the timeline, and unified project-group markers as compact system-style dots.
- Removed the quick-add bar’s left rule and extended the input underline to the project picker. Today’s Candidates now has a broad, handle-free resize target on its right edge. The homepage product preview now reflects the current Execute workspace and switches between everyday professional schedules in English and Chinese with the page language.
- The daily view now uses a more focused reading column, while 3-Day and Week share a wider timeline canvas with matching left and right insets.
- In 3-Day and Week views, collapsing Today's Candidates now creates a truly compact, expandable strip; Show completed and Group by project use the shared borderless underline selection state. Week-view task titles wrap naturally, and their left completion controls are removed to avoid wasted space in narrow columns.

### Fixed
- Restored all four rounded corners on the Execute timeline background and reduced its side and bottom margins. Today's Candidates keeps its width and horizontal position, moving slightly upward for matching 6px top, left, and bottom insets within the timeline card. The next-date arrow now aligns with the vertical Day / 3-Day / Week / Month controls.
- Fixed fullscreen in 3-Day and Week views inheriting the narrow candidate column. Fullscreen now keeps only the complete timeline and its exit action, without a compressed or blank canvas.

## 2026-08-30 · AI 对话窗口调整

### 改进
- Execute 的三层纸面进一步收齐：顶栏与时间轴底卡无分隔线相接，时间轴底卡从顶栏下缘开始，并在左右和下方保留统一 12px 留白。今日候选也遵循一致的上左下节奏；日程切换、日期箭头与右下 Add / AI 工具全部收进圆角边界内，不再越界。
- 循环标记现固定在完整任务块的右上内角，悬停使用普通指针且不会被候选框遮挡；新建任务（包括 AI 创建）默认不预设紧急度或重要性。
- 主页首屏进一步放大并减轻 N 标志阴影，整体品牌组下移到更平衡的视觉中心；产品上推时会以更长、更强的缩小、灰化和淡出退居幕后，同时产品纸面以更清晰的上缘阴影压过首屏。顶栏改为更矮的全宽条，竖屏明确恢复原生纵向滚动；引导箭头加入轻微上下跳动。
- AI 对话窗口的标题栏压缩为单行并移除“当前工作区”提示；横屏窗口现在可从四条边和四个角调整尺寸。
- 主页改为居中的品牌封面：使用冷灰白背景，让产品名成为唯一主标题，并将“今天做什么，什么时候做，一眼看清。”降为更安静的说明层级，移除多余首屏文字。N 与 slogan 现在会在视觉中心固定，底部露出一小段时间轴引导下滑，产品工作区再从下方完整上推并覆盖封面；所有屏幕比例都可稳定滚动，顶栏始终可见，并将使用说明、支持和 GitHub 集中在中间导航。长期规划示例同步改为普通职场工作场景。
- Execute 工作区改为暖白底纸面与纯白候选/时间轴画布；候选任务间距更紧凑，底部快速添加栏的顶线与候选纸面边缘对齐。桌面右下角的添加菜单现在也可新建习惯，并为添加与 AI 工具提供适配明暗主题的清楚纸面背景。
- Add 抽屉现在提供“任务 / 项目 / 习惯”三栏，表单字段默认完整展开，不再使用 Advanced 或创建前的 Clarify Next Step；子任务继续作为已创建任务详情中的独立模块。重复设置改为带描边的确认式编辑区，透明循环图标不再带白色底图。候选滚动条默认隐藏并回收右侧任务宽度，右下工具图标同步放大。
- 首屏移除居中的“Explore the day”与下箭头，改在底部露出的产品页上方显示上箭头与“Scroll to explore”提示。
- 桌面 Execute 现在以一张连续的时间轴纸面包裹今日候选：候选栏作为更宽、带圆角与阴影的内嵌纸张置于左侧，外围留白和时间刻度侧栏同步收窄；顶栏向下收口并与工作区外层统一为 `rgb(245, 242, 232)` 的暖纸底色。右下添加与 AI 入口改为同款描边纸面按钮、扩大点击留白并保持悬停底色稳定；任务项目色和重复标记也变得更轻，并确保循环符号位于任务块上方。
- 调整 Execute 外壳层级：圆角移到完整工作区的外框，顶栏作为平直的 `rgb(245, 242, 232)` 暖纸页眉无缝接入；时间轴和候选栏下方统一为纯白纸面，候选任务块也统一使用纯白背景。今日候选默认加宽，并可通过右侧细线拖拽调整宽度；全天栏重新与时间刻度对齐，快速添加按钮改用 `rgb(245, 241, 232)`。

### 修复
- 修复横屏 AI 对话窗口在多条边和角落调整尺寸时产生的重复命中区域；所有边缘与角落仍可直接拖动调整。
- 横屏时移到 AI 对话窗口的任一边缘或角落会显示相应的缩放光标，让可拖动区域明确可见。
- 重复任务在时间轴与今日候选中统一为悬出右上角的纸面方签与循环图标，候选列表会保留对应留白，标记不会被裁掉。

## 2026-08-30 · AI conversation window adjustments

### Improved
- Execute’s three paper layers are now aligned precisely: the header joins the timeline ground without a separating rule, the timeline ground begins at the header edge and retains a consistent 12px inset on the left, right, and bottom. Today’s Candidates follows the same top-left-bottom rhythm, while view controls, date arrows, and the lower-right Add / AI tools stay within the rounded boundary without overflow.
- The recurrence mark now sits inside the upper-right corner of the complete task block, keeps a normal pointer on hover, and is never obscured by the candidate panel. New tasks, including AI-created tasks, start with no preset urgency or importance.
- The homepage now doubles the N mark while softening its shadow and lowers the complete brand group to a more balanced visual center. As the page rises, that group retreats through a longer, stronger scaling, grayscale, and fading transition, while the rising product paper adds a clearer upper shadow over the cover. The header is a shorter full-width bar, portrait restores native vertical scrolling explicitly, and the cue arrow has a restrained vertical bounce.
- Compressed the AI chat header into a single title row and removed the “Current workspace” hint; landscape windows can now be resized from all four edges and corners.
- Reframed the homepage as a centered brand cover with a cool gray-white background. The product name is now the only headline, while “See what to do today — and when to do it.” becomes a quieter supporting line and surplus first-screen copy is removed. The N mark and slogan now hold in the visual center, with a small timeline edge exposed at the bottom to invite scrolling before the workspace rises intact to cover the intro; every viewport can scroll reliably, the top navigation stays visible, and How it works, Support, and GitHub are grouped in the center. The Planning example now reflects ordinary office work.
- Updated Execute with a warm-white paper ground and true-white candidate and timeline canvases. Candidate spacing is tighter, the quick-add rule is flush with the candidate sheet, the desktop Add menu now includes a habit entry, and both Add and AI have clear theme-aware paper backings.
- The Add drawer now offers Task, Project, and Habit tabs with the form fields open by default, removing both the Advanced concept and pre-creation Clarify Next Step. Subtasks remain a dedicated module in an existing task’s detail view. Repeat settings now use an outlined confirm-or-cancel edit state, the recurrence mark is transparent rather than backed by a white square, candidate scrollbars are hidden while reclaiming task width, and the lower-right tool icons are larger.
- Removed the centered “Explore the day” and down-arrow cue from the cover, placing an up-arrow and “Scroll to explore” cue above the exposed product page instead.
- On desktop, Execute now nests Today’s Candidates inside one continuous timeline sheet as a wider, rounded, shadowed inner paper panel. Outer padding and the time-scale gutter are tighter, while the header curves downward and shares the warm `rgb(245, 242, 232)` paper ground with the workspace surround. The lower-right Add and AI entries now use matching outlined paper buttons with larger hit areas and stable hover fills; task project accents and repeat marks are lighter, and the recurrence glyph stays above its task block.
- Refined the Execute shell hierarchy: rounding now belongs to the complete workspace frame, while the header is a straight `rgb(245, 242, 232)` warm-paper strip joined seamlessly to it. The timeline and candidate surround are true white, as are candidate task rows. Today’s Candidates is wider by default and can be resized from its right-hand rule; the all-day row aligns with the time scale, and Quick Add uses `rgb(245, 241, 232)`.

### Fixed
- Fixed overlapping resize hit zones on the landscape AI panel; every edge and corner remains directly draggable.
- In landscape, hovering any AI panel edge or corner now shows its matching resize cursor so draggable areas are discoverable.
- Unified recurring tasks in the timeline and Today's Candidates with an upper-right paper tab and repeat icon; the candidate list now preserves enough gutter so those markers are not clipped.

## 2026-08-29 · AI 输入区与执行工作区视觉细化

### 改进
- 重构 NavoPath 主页的信息层级：首屏先清楚说明产品价值，再以可读的静态计划预览呈现候选任务与时间安排；将原有内容归纳为三步说明和长期规划示例。主页现在会在桌面、竖屏与低高度横屏之间自然重排，不再出现自动演示造成的文字重叠、裁切或大块无意义留白。
- 细化 Navo AI 输入区：提示语改为“随心输入，或上传文件读取日程”，移除底部冗余提示，发送键改为轻量圆形纸面动作；桌面与横屏在“+”旁以无边框、无底色文字控件独立显示模型选择，竖屏仍将模型、安全等级与附件完整收纳在菜单中。暗色浮层改用低透明黑色阴影，竖屏菜单与表单也会贴合输入框并跟随当前纸面主题。
- 历史对话改为独立的连续选择页，清楚展示会话标题、首条提问、日期、消息数和当前状态；每条会话右侧统一为三点菜单，可就地重命名、置顶/取消置顶或确认删除，置顶会话优先排列并用独立图标标记。竖屏打开历史时会自动展开到完整会话页，普通折叠则稳定贴住屏幕底部且不再裁掉上方内容。
- 今日候选与时间轴桌面外框改用同一条跟随活动主题的细强调线；候选任务恢复与时间轴完全一致的纸面任务块、项目色左边条和拖动外观，让次级任务纸张与主要执行画布保持统一而清晰的层级。
- 时间轴在拖入、移动任务或改变排程状态时会保留当前滚动锚点，不再突然跳到其他时间段；首次加载 Execute 后自动将当前时间对准视口中央，非今日日期则对准上午 9 点。
- 重复任务不再在标题下方常驻显示“每天”等周期文字，候选、时间轴、全天与拖动任务块统一在右上角显示安静的循环符号，悬停或键盘聚焦时再显示完整循环周期。
- 今日候选、时间轴与底部快速添加栏现在共用连续的主题纸面背景，输入栏保持不透明，滚动任务不会透到输入区域；右下角的添加与 AI 入口改为细规则的编辑式工具。AI 对话顶部融入同一纸面层，完成回复不再显示步骤计数或高级调试详情，横屏时可从标题栏拖动窗口并从右下角缩放。

## 2026-08-29 · AI composer and Execute workspace visual refinements

### Improved
- Reworked the NavoPath homepage hierarchy so its first screen clearly explains the product before showing a readable static preview of candidate tasks and time placement. Existing content is now organized as three concise steps and a long-term planning example; desktop, portrait, and low-height landscape layouts reflow naturally without animation-driven overlap, clipping, or empty space.
- Refined the Navo AI composer with a “Type freely, or upload a file to read its schedule” prompt, removed the redundant footer notice, and replaced the send control with a lighter circular paper action. Desktop and landscape now expose model selection beside “+” as a borderless, background-free text control, while portrait keeps model, safety, and attachments together in the menu. Dark floating surfaces use low-opacity black shadows, and the portrait menu and form controls now fit the composer and follow the active paper theme.
- Rebuilt conversation history as a dedicated continuous selection page that clearly shows the title, first prompt, date, message count, and current state. Each conversation now has a three-dot menu for inline rename, pin/unpin, and confirmed deletion; pinned conversations sort first and carry a distinct icon. Opening history in portrait expands to the full conversation page, while an ordinarily collapsed chat remains anchored to the bottom and no longer clips content above.
- Unified the desktop boundaries of Today's Candidates and the timeline with the same fine active-theme accent rule. Candidate tasks now use the same paper task surface, project-color rail, and drag appearance as timeline blocks, keeping the secondary task sheet and primary execution canvas visually related and clearly separated.
- Preserved the timeline scroll anchor when tasks are dropped, moved, or rescheduled so state changes no longer jump to another time range. The Execute timeline now aligns the current time to the center after its initial load, falling back to 09:00 when viewing a different date.
- Replaced persistent recurrence text beneath task titles with a quiet upper-right loop mark across candidate, timeline, all-day, and dragged task blocks; the full cadence appears only on hover or keyboard focus.
- Today's Candidates, the timeline, and the bottom quick-add row now share one continuous theme-aware paper surface. The opaque input row prevents scrolling tasks from showing through, while the lower-right Add and AI entry points now use fine editorial rules. The AI header now blends into the same paper surface, completed replies omit step counts and advanced debug details, and landscape chat windows can be dragged from the header and resized from the lower-right corner.

## 2026-08-28 · MCP 跨设备配置说明

### 新增
- 新增全天在线的云端主动日程助理：即使电脑关机，也会按上海时区每天 08:30 检查温州天气、当天安排与待办，并在 20:30 轻量复盘、处理可延期工作和准备次日计划。增量资料事件通过签名 API 与队列触发，短时间重复保存会合并且相同事件不会重复调用模型。
- NavoPath MCP 新增增量变更、真实任务重排、日程块 upsert、可预演/提交的任务批处理、活动历史、撤销、资料事件摄取和通知工具。所有自动日程写入都有 revision 冲突保护、幂等键、原因、前后值与 24 小时撤销记录；删除不开放给云端模型，锁定安排和硬截止移动会等待确认。
- 云端以数据库保存用户偏好、任务变更历史、事件游标、最后增量资料快照和扫描摘要，只向 DeepSeek V4 Flash 提供完成判断所需的任务元数据、天气与有限资料片段。应用内通知和可选邮件遵守 19:00 后低打扰规则，只有紧急截止风险可以立即打扰。
- 新增跨桌面与移动端的 NavoPath Obsidian Bridge：可监听 Vault 内 `升学/资料` 的增量新建、修改、重命名与删除，首次只建立哈希基线，后续仅上传变化清单和有限的日程相关片段；失败会保留并补传，设备令牌通过 Obsidian SecretStorage 保存且不会进入 iCloud 插件数据。Windows 端支持由仅当前用户可读的一次性本机文件自动导入令牌，成功或失败后都会立即删除该文件。

### 改进
- 重写 MCP 配置说明：应用内教程现在按新电脑的完整连接路径组织，提供 Codex 与 Claude Desktop 的 Windows、macOS 和 Linux 配置、真实服务地址、独立设备令牌建议、验证步骤与集中排错，并以 NavoPath 纸面编辑风格适配明暗主题和手机阅读。
- 完成 Navo AI 对话与 Execute 工作区的第一阶段视觉改造：桌面 AI 抽屉调整为 600–640px 上下文面板，移动端使用近全屏会话；空状态精简为三个自然入口，请求期间只显示单一真实状态框，完成步骤默认折叠，最终答案支持安全的 GFM Markdown。输入区改用自然提问提示和轻量发送控件，桌面与横屏独立显示模型选择，竖屏仍收纳在“+”菜单，暗色浮层仅使用低透明黑色阴影。Execute 将时间轴提升为主要画布，候选区改为连续任务纸张，并用跟随主题的细强调线统一两块工作区边界。

### 修复
- 修复今日候选较多时，候选面板会被内容撑出工作区、列表本身因没有形成受限高度而无法滚动的问题；桌面、横屏与触摸布局现在都由候选列表独立滚动，底部快速添加栏保持固定可用。
- 修复 Navo AI 仍根据旧版界面模式和应用内简报开关判断自身能力、错误声称没有定时后台自动化的问题；询问自动化能力时现在会准确说明全天在线的早晚检查、资料事件触发、离线快照、通知、审计、确认与撤销边界，并且不会把能力可用性与当前账户启用状态混为一谈。

## 2026-08-28 · Cross-device MCP setup guide

### Added
- Added an always-online cloud scheduling assistant that continues while the computer is off: at 08:30 Asia/Shanghai it checks Wenzhou weather, the day's schedule, and open tasks, while at 20:30 it performs a light review, handles eligible deferrals, and prepares tomorrow. Incremental workspace events use a signed API and queue, coalescing rapid saves and preventing duplicate events from invoking the model again.
- Expanded NavoPath MCP with incremental changes, true task rescheduling, schedule-block upserts, dry-run/commit task batches, activity history, undo, workspace-event ingestion, and notifications. Every automatic schedule write has revision conflict protection, an idempotency key, reason, before/after values, and a 24-hour undo record; deletion is unavailable to the cloud model, while locked schedules and hard-deadline moves wait for confirmation.
- The cloud now stores user preferences, task change history, event cursors, the latest incremental workspace snapshot, and scan summaries in the database, and sends DeepSeek V4 Flash only the task metadata, weather, and bounded source excerpts required for a decision. In-app notifications and optional email respect quiet hours after 19:00, with immediate interruption reserved for urgent deadline risk.
- Added the cross-desktop-and-mobile NavoPath Obsidian Bridge, which watches incremental creates, modifications, renames, and deletions under the vault-relative `升学/资料` folder. Its first run creates a hash baseline, later runs upload only change metadata and bounded scheduling-relevant excerpts, failed uploads remain retryable, and device tokens stay in Obsidian SecretStorage instead of iCloud-synced plugin data. Windows can provision the token from a one-time local file readable only by the current user; the plugin deletes that file immediately whether import succeeds or fails.

### Improved
- Reworked the MCP setup guide around a complete new-computer connection path, with Codex and Claude Desktop instructions for Windows, macOS, and Linux, the production endpoint, per-device token guidance, verification steps, and focused troubleshooting in a responsive NavoPath paper-editorial layout for light and dark themes.
- Completed the first visual phase for Navo AI chat and the Execute workspace: the desktop AI drawer is now a 600–640px contextual panel, mobile uses a near-full-screen conversation, the empty state offers three natural starting points, requests show one truthful status box, completed steps collapse by default, and final answers render safe GFM Markdown. The composer now uses a natural prompt and a lighter send control, desktop and landscape expose model selection beside the attachment menu while portrait keeps it inside the “+” menu, and dark floating surfaces use low-opacity black shadows only. Execute now treats the timeline as the primary canvas, presents candidates as a continuous secondary task sheet, and unifies both workspace boundaries with a fine theme-aware accent rule.

### Fixed
- Fixed long candidate lists expanding the candidate panel beyond the workspace and leaving the list without a bounded scroll area. Desktop, landscape, and touch layouts now scroll the candidate list independently while keeping the bottom quick-add row available.
- Fixed Navo AI inferring its capabilities from legacy interface-mode and in-app brief settings and incorrectly claiming that scheduled background automation did not exist. When asked about automation, it now accurately describes the always-online morning/evening checks, workspace-event triggers, offline snapshot, notification, audit, confirmation, and undo boundaries without confusing capability availability with the current account's activation status.

## 2026-08-27 · 横屏候选滚动与品牌贴图修复

### 修复
- 修复横屏工作区中今日候选列表在触摸设备上无法纵向滚动的问题；列表、候选行和候选卡现在明确保留原生纵向触摸滚动与惯性滚动。
- 修复相对部署路径下左上角箭头 N 品牌贴图可能消失或按原图尺寸异常放大的问题；工作区现在会按应用 base 路径加载真实 Logo 贴图，并将其稳定约束在紧凑品牌位内。

## 2026-08-27 · Landscape candidate scrolling and brand asset fixes

### Fixed
- Fixed Today's Candidates refusing to scroll vertically on touch devices in landscape workspaces; the list, candidate rows, and cards now explicitly preserve native vertical and momentum scrolling.
- Fixed the top-left arrow-N brand asset disappearing or expanding to its source-image size under relative deployment paths; the workspace now loads the real logo through the app base path and keeps it constrained to the compact brand slot.

## 本轮补充 / Current update

### 新增
- 登录后的 Navo AI 升级为全局工作区 Agent：可按需检索完整任务、项目、习惯、笔记、模板、记忆、统计、计时状态、设置与已连接集成，不再依赖 24 个项目 / 30 个任务 / 14 天日程快照。低风险应用内操作会自动执行并留下 24 小时撤销入口；删除、归档、批量、重复规则、设置与集成修改必须通过逐字段确认卡，所有写入均使用用户 JWT、RLS、工作区 revision 和原子 RPC。AI 抽屉会展示实际查询轨迹、执行结果、失败原因和最近 30 天审计历史，并允许确认后启停已有外部日历但不会接触原始 URL 或令牌。
- AI 输入框左下角“+”统一收纳模型、安全等级和附件入口，移除顶部模型选择器。安全等级提供标准、严格与只读三档：严格模式要求确认每次工作区写入，只读模式阻止写入与计时控制；两者只会收紧服务端确定性权限，不能绕过原有高风险确认或禁用项。
- 新增通用 HTTPS ICS 外部日历：最多连接 10 个只读来源，支持全天、跨日、时区、重复、例外与取消实例；连接、启动、主动简报前及应用活跃期间每 15 分钟同步。URL 经服务端 AES-GCM 加密，抓取器限制 443 端口、重定向、DNS 私网地址、10 秒与 5 MB；事项以安静的活动主题时间块参与冲突检测、自动排程和 AI 简报，不导入任务也不写回来源。
- 新增可选的每日开工简报与收工复盘，默认时间为 08:00 / 21:30，现有账号默认关闭。启用后每种简报每天最多自动生成一次，错过时间会在当日下次打开时补生成；简报本身只读，失败时保留重试入口。
- 新增可持续开发的 iOS 原生工程：现有 React/Vite 竖屏应用现在可通过 Capacitor 同步到 iOS 15+，在真机上使用原生状态栏、刘海与底部安全区，并在原生环境中移除网页预览用的模拟手机外框。首版锁定竖屏，同时提供 Windows 局域网手机预览、iOS 工程同步与交付到 Xcode 的开发流程。

### 修复
- 修复全天任务在保存后从日历消失的问题：时间轴拖入和全天栏中新建的任务现在都可正确保存、重新载入并显示；勾选完成后会保留在原日期，也能按原预计时长再次拖回具体时间。
- 修复部分手机网络阻断或延迟 Supabase Realtime WebSocket 时，手机与电脑长期不同步的问题：前台现在每 5 秒通过同源安全中转只检查轻量 revision，发现云端版本变化才拉取完整工作区；页面重新可见、窗口重新聚焦或从手机后台恢复时会立即检查，因此不再依赖 15 分钟至 24 小时的用户定时同步设置。
- 修复离线使用后恢复联网时云端旧快照可能覆盖本地近期记录的问题：启动加载、实时更新、手动拉取与自动重连现在统一优先保护持久化的未同步修改，先按记录 ID 和更新时间合并本地与云端内容，再上传合并结果；只有对应的最新保存请求得到云端确认后才清除待同步状态，过期请求与旧 revision 均不能误判为最新版本或清除后续编辑。
- 打磨手机版时间轴、AI、设置与规划交互：时间轴任务现在单击即选中并显示缩放点、双击才打开短栏，缩放手势通过指针捕获与短栏下滑关闭隔离；已有任务短栏恢复独立的“完成 / 未完成 / 添加子任务”并高亮当前状态。AI 对话保留新对话、历史侧栏和设置图标，模型、安全等级与相机、照片、文件、硬件同步统一移入输入框左下角“+”菜单；首次下滑收为半屏、再次下滑关闭。设置与 AI 的背景遮罩不再让顶栏额外灰化，手机版高级设置隐藏桌面窗口、插件与快捷键入口，并把新手指南和重置放在末尾。规划树缩进更紧凑，手机版长按可整块拖动重排，今日任务拖到左缘可移回规划；指标筛选统一到右上角并放大圆环，AI 排程建议在 Tasks 中可直接预览日期与时间。
- 统一移动端时间轴的缩放点与快速新建反馈：时间轴草稿和已选任务现在使用完全一致的纸面圆点，精确压在开始/结束边界且不会出现浏览器焦点边框；草稿短栏填写标题后可通过下滑直接保存，也可点按右下角“添加”。右下角悬浮“+”打开输入时会按真实可视键盘边界整体抬升短栏，让输入框始终可见；顶栏仅随背景遮罩统一变暗，不再叠加异常灰度。
- 统一移动端浮层与时间轴的最终交互：AI、设置打开时顶栏与底栏保留为灰化背景，抓手可下滑关闭；任务短栏同样支持下滑关闭、上滑展开“更多”，并解决“更多”与关闭按钮重叠。右下角“+”使用原生任务/项目/习惯列表且打开后自动抬升输入区。时间轴每次打开自动聚焦当前时刻；任务必须先选中才渲染并启用缩放点，勾选框保持独立可点，点按其他区域先退出选中；新建草稿不再灰化页面，可继续改时段，并与重叠任务自动分栏。拖动任务时可用另一指点按日期快选调整目标日期；已有任务短栏恢复完成/未完成操作，所有新建入口的重要与紧急程度保持为空。
- 修复移动端短栏新建交互：时间轴选定时段后不再立即唤起键盘，点按任务名区域才开始输入；点按短栏外可自动保存已有标题的任务；右下角新建入口的任务、项目与习惯类型菜单可正常展开。
- 统一竖屏移动端的任务短栏：点按时间轴空白、右下角悬浮“+”和点按已有任务块现在共用同一套抓手、标题、关闭、“更多”、归属与底部动作结构。时间轴新建可直接修改 15 分钟刻度的起止时间并添加子任务；已有任务短栏移除重复的完成/未完成按钮，改为添加子任务，“More”已适配中文。右下角“+”打开相同短栏，点按“新任务”可切换新建任务、项目或习惯，并显示各自需要的归属、颜色或默认时长设置；“更多”进入对应完整详情。
- 时间轴草稿块和已有任务块现在共用可拖动的左上开始点与右下结束点，44px 触控区横向内收且允许越过任务边框显示，拖动会实时改变并保存起止时间；点按任务块后会明确显示两处手柄。所有新建入口的重要程度与紧急程度默认均为空。
- 优化竖屏时间轴的快速交互：点按空白时段会先显示清晰的 30 分钟时间段预览，并直接拉起底部短栏填写名称、查看起止时间和日期；日期标题可展开紧凑月历快速跳转。时间轴同时支持更流畅的双指纵向缩放，缩放以手势中心对应的时刻为锚点，条纹背景、标尺、任务块、点击与拖动坐标保持同步；“回到现在”会可靠切回当天日程并把当前时间定位到视口中央。
- 重构竖屏手机端的主要入口：底栏左侧“+”改为简约的 Navo AI 对话入口，右下角新增始终易于触达的悬浮“+”用于快速添加任务，并移除 Tasks 顶部重复的添加按钮。Tasks / Schedule 顶栏下移并支持中英文，日期在 Tasks 中以只读形式显示，在 Schedule 中保持无描边的日期快选；快速添加、AI 对话或设置打开时顶栏会自动隐藏，不再覆盖浮层。AI 对话和设置现在都使用与任务详情一致的非全屏底部窗口，顶部拖拽条支持跟手下滑关闭、未达到阈值时回弹，同时保留明确关闭按钮；设置页改用搜索加分类的紧凑布局、分组列表、iOS 尺寸开关和更接近系统原生的触控按钮，并继续跟随当前活动主题色。
- 修复生产站 AI 请求仍直连 Supabase、在部分移动网络或 Safari 上无法使用的问题；AI 现在与登录和工作区请求一样通过 NavoPath 同域安全中转，并按供应商协议正确切换即时与深度思考模式。模型目录同步到当前可用的新一代模型，默认升级为 DeepSeek V4 Flash，旧模型偏好会自动迁移，设置中可直接选择新模型。
- 竖屏手机版网页固定按设备宽度显示，输入任务时不再触发页面缩放；点按或拖拽时间轴后，新增输入栏与正式任务块共用一致的纸面背景、圆角和边线，并进一步放大任务勾选框，不再因样式割裂或键盘、页面滚动、视口变化影响操作。手机键盘的完成键和收起键盘产生的失焦现在都会把临时输入块完整转换为正式任务块，恢复拖动、缩放和点按编辑能力；输入井号后的项目列表支持独立触摸滚动，快速连续操作也会稳定生成任务。短按时间轴任务会先从底部展开紧凑栏；名称和归属现在可直接编辑，开始与结束时间使用原生滚轮式选择并严格限制为 15 分钟刻度，未完成状态可以再次点按取消。子任务直接显示在短栏底部并可勾选，最多完整露出三项，更多内容可独立滚动；短栏高度随内容灵活增长，点按 More 才展开铺满宽度的完整详情，关闭按钮固定在右上角。时间块移除挤在中间的横向缩放条，改为贴在边界交界处并略向内收的左上角开始点和右下角结束点；两处保留 44px 触控区域，新任务保存后会短暂显示角点及拖动提示。竖屏时间标尺进一步左移并紧贴时间文字，任务块横向铺满时间轴，顶栏日期放大，切换箭头变窄；候选页移除重复标题，将已完成、AI 排程和醒目的快速添加按钮集中到右上角，为列表与时间轴释放更多空间。
- 竖屏手机版网页不再套用带外边距、边框和大圆角的模拟设备外壳，工作区与纸面背景现在贴合整个可用视口；底栏下移并压缩为更轻薄的安全区工具栏，同时减少时间轴底部预留，在窄屏上为主页面释放更多空间。
- 共享工作区控件的旧紫色与荧光绿默认值已改为跟随当前活动主题，覆盖规划、快速添加、AI、撤销、任务树、排程反馈、计时器和专注模式；项目颜色缺失时也不再回退为荧光绿，暗色规划页侧栏会使用暗色纸面并恢复工具文字的清晰对比度。
- 自动排程不再要求工作窗口末尾额外预留缓冲时间；完整任务可以恰好在规划结束时间完成，跨日期拆分的长任务也会使用每个窗口的全部可用容量。根据历史学习到的项目偏好开始时间现在会决定任务在空闲窗口内的实际落点，落点前后的剩余时间仍可继续排程；应用缓冲后产生的新窗口会重新对齐排程网格，避免后续任务落在 09:05 等非吸附时间，同时保证实际间隔不小于设置值。当天判断现在使用本地日历日期，最早可排时间会先加入 5 分钟准备时间再吸附一次，跨 UTC 日期边界不会排到错误日期，也不再无故跳过一个 15 分钟网格。
- 时间占比统计的默认当天和最近 7、30、90 天边界现在按本地日历日期计算，不再因 UTC 转换把区间下界提前一天；跨午夜计划使用日历日跨度计算分钟数，经过夏令时切换时也不会少算或多算一小时。带时区的计时记录会按时间戳对应的本地日期归入时间占比、热力图和连续活跃天数，午夜附近的记录不再落到错误的一天。
- 任务、重复实例、习惯和小组件倒计时排程跨过午夜时现在都会同步推进结束日期，包括新建、拖动、缩放、修改时长、任务与日历事件互转、旧事件恢复、旧时间轴记录加载以及月末和年末边界；移动已有跨日记录、转换或恢复跨日事件都会保留完整时长，缺少结束日期的旧记录也会根据时刻推断次日。任务表单、AI 导入、日程模板、执行容量统计和详情摘要也会把结束钟点早于开始钟点识别为跨午夜，不再把 23:30–次日 00:30 压成 15 分钟、零时长或负时长。普通任务的跨日记录会像日历事件一样按每天实际占用区间显示，次日单独查看仍可见延续部分；完成、编辑、删除、拖动和缩放任一分段仍作用于完整原记录，且恰好在午夜结束的记录保留末端缩放手柄。23:50 开始的 20 分钟计划会正确结束在次日 00:10，不再因结束日期陈旧或同日结束时间早于开始时间而从时间轴消失、跳回旧日期、缩短为 15 分钟或被统计为零时长。
- 跨午夜日历事件现在会按每天实际占用的区间切入时间轴；23:30–次日 00:30 会显示为前后各 30 分钟，单独查看次日仍能看到延续部分，每日重复事件也会带入前一晚的延续，不再在每个日期复制整条事件或缩短为 15 分钟。拖动跨日事件会保留总时长；缩放会从首段起点或末段终点调整完整事件，并同步更新结束日期。拖拽预览会按目标日期判断冲突，不再把不同日期的相同时刻误判为重叠；日程模板也会识别前一晚延续到所选日期的占用区间，避免把模板块排到已有跨午夜计划上。
- 月度和季度重复任务现在始终以初始日期的日号为锚点；从 31 日经过较短月份时会暂时落在月末，后续较长月份会恢复到 31 日，不再永久漂移到 28、29 或 30 日。重复实例 ID 也会从末尾解析并校验日期与时间，导入或同步任务的原始 ID 即使包含 `__occ__` 仍可正常完成、取消和回写时间轴，格式损坏的相似 ID 则不会被误判为实例。
- 规划任务树现在会原子地移动嵌套子任务，并拒绝把子任务放入自己的后代；拖到另一嵌套子任务前后时会保留目标的真实父层级与相邻位置，跨父任务移动也不会错误提升到根层。无效拖拽会保留原树，不再因目标节点随源子树一同移除而丢失整棵子树。
- 同步合并现在只把结构正确、可解析且未异常超前的删除时间视为有效墓碑，并为设备时钟保留最多 7 天偏差；缺少时间戳的旧版记录不再在首次同步时被静默删除，损坏或极端未来的墓碑会被清除，已被同 ID 更新记录取代的旧墓碑也会自动移除，不再永久压制正常数据、导致备份恢复崩溃或继续占用同步载荷。
- 从云端、本地缓存或备份恢复规划数据时，现在会按 ID 去重任务、项目及其他持久化集合，限制任务、项目、子任务、目标、长期任务、草稿、笔记、习惯、时间记录、时间轴记录、重复规则和 AI 历史的身份、文本、数组、嵌套与数值边界，并规范化自定义日程模板；项目分类、颜色、完成状态和时间戳会恢复到合法值，目标及长期任务的日期、状态和完成值也会修复。同一习惯同一天只保留最新状态，习惯完成值与时间戳会修复，排程标记只在指向该习惯当日任务的真实时间轴记录时保留。旧版习惯插件名称也会限制数量与长度、去重并生成有界 ID，无关的旧插件载荷不再继续同步。任务日期、分类、完成状态、预计时长及旧版排程字段会恢复到合法值，不存在的项目、目标、父任务和子任务计划引用会被移除；孤立的时间记录也会丢弃，悬空项目、时间轴引用和损坏的记录时间戳会修复。时间轴记录会修复任务归属、状态和结束日期，无效重复规则、未知 AI 操作和损坏时间会被清理。子任务树、时间轴记录、模板时段、旧事件迁移、AI 会话/消息/建议及记忆均有恢复上限；AI 个性化画像只保留现有项目的有界统计与词权重，任务推断也会修复来源、置信度、时长和项目引用，避免重复数据污染统计、异常记录错误渲染，或恶意深层及巨型数据拖垮启动。
- 任务 CSV 导入现在会校验 NavoPath 表头，拒绝未闭合的引号字段，限制任务 ID、标题、项目名和元数据字段的长度，并在保存前清理无效截止日期、将正数预计时长限制在 15 分钟至 24 小时；同一文件中重复出现的任务 ID 只导入第一条，避免格式错误、异常日期或时长进入渲染与同步链路，或重复 ID 导致后续编辑作用于多个任务。
- 从云端、缓存或备份恢复设置时，现在会限制昵称、标题、模型标识、URL、背景路径和折叠状态列表的长度与数量，只接受大小受限的 JPEG/PNG/WebP Base64 头像，并统一清除旧版个人 API Key 状态；异常设置不再放大缓存、同步或渲染开销。
- 插件设置与使用教程现在准确区分可运行的官方内置插件和仅提供经校验 manifest/配置的桌面本地插件；本地项不再被描述为会加载 `index.js` 或显示“运行中”，其权限明确标记为声明信息。外部 manifest 会拒绝对象保留键与重复配置字段，并按类型、数值范围、选项和文本长度规范化配置；来自云端、缓存或备份的插件设置也会去重启用列表，并限制配置数量、嵌套深度、节点、数组及文本规模。
- 修复长期运行的同步回调可能继续使用应用首次渲染时的空账号状态，导致登录用户的离线缓存误写入本地预览空间、桌面恢复快照缺少当前账号的问题；延迟保存、拉取与快照现在始终读取当前会话。
- 修复手动与定时同步重叠时可能同时读写云端、连续触发不同方向的手动同步时后一次请求可能被吞掉，以及关闭自动同步或离开工作区后已排队的定时任务仍会运行的问题；所有同步入口现在会安全复用或排队，停止时也会取消尚未开始的纯定时任务。设备或服务器时钟略超前时，同步状态也会正确显示“之后”，不再误报为数分钟前或数小时前。
- 升级桌面运行时与构建工具链，修复 Electron、桌面打包器、开发服务器和并发启动工具中的已知依赖漏洞，并保持现有 Windows 打包、网页部署与本地开发流程兼容。
- 收紧桌面端安全边界：主窗口、竖屏窗口与小组件只加载本地应用或回环地址的开发服务，阻止远程页面访问认证存储、备份、插件、更新等桌面能力，并拦截不受信任的页面导航与新窗口。
- 竖屏候选页将“今日候选”和两个快捷操作下移到 Tasks 切换按钮下方的独立栏；三日/周视图改为更宽的纸面时间轴，时间标尺贴左并增大，跨天日期独占 0:00 上一行，日期栏与背景融合，全天标签左对齐。顶部日期切换控件移除偏灰底色，“回到现在”仅在当前时间离开可视区域后出现；全天任务现在也会按预计时长计入指标。
- 竖屏 Tasks / Schedule 单按钮新增白底圆角 Logo 滑块：Logo 块几乎铺满按钮高度，Tasks 文案左移；切换时 Logo 横向滑过并遮住旧文案，再显现另一侧状态文案，同时兼容减少动态效果设置。
- 竖屏模式切换按钮固定使用英文 Tasks / Schedule，并确认复用箭头 N 品牌 Logo；移除外层重复边框，使其严格呈现为单个左右翻转的状态按钮。
- 竖屏 Tasks / Schedule 由双分段按钮改为单一大状态按钮：Tasks 为「NavoPath 标志｜Tasks」，点击后切换为「Schedule｜NavoPath 标志」。
- 浅色模式 Dock 改为纯白背景；竖屏 Tasks / Schedule 去除通用图标，改为 Tasks 的「NavoPath 标志 → 文字」与 Schedule 的「文字 → NavoPath 标志」结构。
- 竖屏 Tasks / Schedule 改为统一纸面底上的图标文字分段控件，Planning 视图切换同步改为紧凑的内嵌分段形式；三日/周标尺收窄并改为左对齐小字，日期进一步放大，回到现在缩小并右上对齐，Dock 使用纯黑底。
- 竖屏拖拽引导改为嵌入式任务到时间轴示意，并以「探索 NavoPath · 15 分钟」作为首个默认引导任务；Dock 恢复深色墨水底。
- 竖屏执行页新增可关闭的「任务 → 日程」线稿引导，提示将任务拖进时间轴；三天/周视图改为完整顶部控制栏与下移的日期信息，时间轴文字进一步收紧，「回到现在」改为回环箭头图标。底部 Dock 在浅色/深色主题下分别使用纸白/墨黑底色。
- 竖屏规划页在任务为空或极少时不再使用插图，而是显示强指示型「长期任务，从这里开始规划」说明，清晰给出项目 → 任务 → 排程的路径。

### 改进
- 加快网站登录进入工作区的速度：密码认证成功后不再重复等待云端资料查询，工作区初始化统一负责加载资料，并可更早复用本机缓存呈现界面。
- 优化首次加载性能：首页与桌面小组件资源改为按需加载，主工作区不再提前下载这些界面资源，并通过更紧凑的生产构建降低首屏脚本与样式体积。

### Added
- Upgraded signed-in Navo AI into a global workspace Agent that queries complete tasks, projects, habits, notes, templates, memories, metrics, timer state, settings, and connected integrations on demand instead of relying on 24-project / 30-task / 14-day snapshots. Low-risk in-app actions execute automatically with a 24-hour undo path; deletion, archival, bulk, recurrence, settings, and integration changes require a field-level confirmation card. Every write uses the user JWT, RLS, workspace revision, and an atomic RPC. The AI drawer exposes the actual query trace, execution result, failure reason, and 30-day audit history, and can enable or disable an existing external calendar after confirmation without exposing its raw URL or token.
- Moved model selection, safety level, and attachments into the composer’s lower-left “+” menu and removed the top model picker. Standard, Strict, and Read only safety levels can only tighten deterministic server policy: Strict confirms every workspace write, while Read only blocks writes and timer controls without bypassing any existing high-risk confirmation or forbidden boundary.
- Added generic HTTPS ICS external calendars with up to 10 read-only sources and support for all-day, cross-day, timezone, recurrence, exception, and cancelled instances. Sources sync on connect, app start, before proactive briefs, and every 15 active minutes. URLs are AES-GCM encrypted server-side; fetching enforces port 443, redirect and DNS private-network checks, a 10-second timeout, and a 5 MB cap. Quiet active-theme blocks participate in conflicts, automatic scheduling, and AI briefs without importing tasks or writing back.
- Added opt-in daily start and end briefs, defaulting to 08:00 and 21:30 and disabled for existing accounts. Each brief runs automatically at most once per day, catches up on the next open that day, remains read-only, and leaves a visible retry path after failure.
- Added a maintainable native iOS project. The existing React/Vite portrait app can now sync through Capacitor for iOS 15+, uses the native status bar and device safe areas, and removes the simulated phone frame inside the native container. The first release is portrait-only and includes Windows LAN phone preview, iOS project sync, and Xcode handoff workflows.

### Fixed
- Fixed all-day tasks disappearing after a save. Tasks dragged into or created directly in the all-day row now persist, reload, and render correctly, stay on their date after completion, and can be dragged back to a specific time using their original estimated duration.
- Fixed mobile and desktop workspaces remaining out of sync when a mobile network blocks or delays the Supabase Realtime WebSocket. Visible clients now check only the lightweight cloud revision every five seconds through the same-origin secure relay and download the full workspace only when it changes. Returning to a visible page, refocusing the window, or resuming from the mobile background triggers an immediate check, independent of the user’s 15-minute-to-24-hour scheduled-sync preference.
- Fixed an offline-to-online sync path where an older cloud snapshot could overwrite recent local records. Startup loading, realtime updates, manual pulls, and automatic reconnects now protect persistently dirty local changes first, merge local and cloud records by identity and update time, and upload the merged result. Dirty state is cleared only when the matching latest save is acknowledged by the cloud, so stale requests and old revisions cannot masquerade as the newest version or clear later edits.
- Refined the mobile timeline, AI, Settings, and Planning interactions. Timeline tasks now select and reveal resize handles on one tap and open their short sheet on double tap; pointer capture keeps resizing isolated from sheet-dismiss gestures. Existing-task sheets restore separate Complete, Incomplete, and Add subtask actions with visible selected-state feedback. AI chat keeps compose, history-sidebar, and settings icons, while model, safety level, Camera, Photos, Files, and hardware sync now share the lower-left “+” menu; the first downward swipe collapses it to a half sheet and the next dismisses it. Settings and AI use one consistent backdrop without extra top-bar grayscale, mobile Advanced hides desktop-window, plugin, and shortcut entries, and onboarding/reset actions sit at the end. Planning tree indentation is tighter, mobile long-press lifts whole blocks for reordering, dragging a Today task to the left returns it to Planning, Metrics uses the same top-right filter placement with a larger donut, and AI schedule suggestions expose date/time previews directly in Tasks.
- Unified mobile timeline resize handles and quick-create feedback. Timeline drafts and selected tasks now use the same paper-style circles, centered exactly on their start/end boundaries without browser focus rings. A titled timeline draft saves when its short sheet is swiped down, and it also provides a bottom-right Add action. The lower-right floating plus now lifts the whole sheet against the real visual keyboard boundary so its input remains visible, while the top controls receive only the same backdrop dimming as the rest of the page instead of an extra grayscale filter.
- Unified the final portrait overlay and timeline interactions. AI and Settings now keep the top controls and Dock visible as a dimmed background and dismiss from their grabbers; task short sheets also swipe down to close or up to expand More, without overlapping the close control. The lower-right plus uses a native task/project/habit list and immediately lifts its input into view. The timeline focuses the current time on load; resize handles are rendered and enabled only after selecting a task, while checkboxes remain independently tappable and an outside tap clears selection first. New drafts leave the timeline interactive, can be re-ranged, and join the overlap column layout. While dragging, a second finger can select a quick-picker date to retarget the task. Existing-task sheets restore Complete/Incomplete, and all creation paths keep importance and urgency empty by default.
- Fixed mobile short-sheet creation: selecting a timeline range no longer summons the keyboard until the title area is tapped, tapping outside auto-saves an item with a title, and the bottom-right create entry reliably opens the task, project, and habit type menu.
- Unified the portrait mobile short sheet across empty-timeline creation, the lower-right floating plus, and existing task editing. All three paths now share the same grabber, title, close, More, project, and bottom-action structure. Timeline drafts directly edit 15-minute start/end values and add subtasks; existing task summaries replace the duplicate Done/Unfinished controls with Add subtask, and More is localized. The floating plus opens the same sheet, where tapping New task switches among task, project, and habit creation with the relevant project, color, or default-duration settings; More opens the corresponding full editor.
- Timeline drafts and existing task blocks now share draggable top-left start and bottom-right end handles. Their 44px touch targets tuck farther inward, remain visible outside the task border, and update persisted start/end times while dragging; tapping a task explicitly reveals both handles. Importance and urgency now default to empty across every creation path.
- Refined portrait timeline interactions: tapping an empty slot now shows a clear 30-minute range preview and immediately opens a compact bottom sheet for the title, time range, and date; the date heading expands into a compact monthly quick picker. Two-finger vertical zoom is smoother and stays anchored to the time beneath the gesture centre, keeping the striped background, rulers, blocks, taps, and drag coordinates aligned. Back to now reliably returns to today's Schedule and centres the current time in the viewport.
- Reworked the main portrait mobile entry points: the dock's left “+” is now a minimal Navo AI chat entry, a floating “+” at the lower right keeps quick task creation in reach, and the duplicate Tasks add button is removed. The Tasks / Schedule bar sits lower and supports Chinese and English; Tasks shows a read-only date, while Schedule keeps a borderless quick date picker. The bar automatically hides while quick add, AI chat, or Settings is open so it cannot cover a sheet. AI chat and Settings use the same non-fullscreen bottom-sheet geometry as task details, and their visible grabber now follows a downward swipe, dismisses past a distance or velocity threshold, and springs back otherwise. Settings retains its compact search-and-category layout, grouped rows, iOS-sized switches, system-like touch controls, and active-theme colors.
- Fixed production AI requests still connecting directly to Supabase and failing on some mobile networks or Safari sessions. AI now uses the same secure NavoPath same-origin relay as authentication and workspace traffic, and switches instant versus deeper reasoning with the provider's supported protocol. The model catalog now contains the current generation, defaults to DeepSeek V4 Flash, automatically migrates retired preferences, and lets users select the new models in Settings.
- Portrait mobile web views now stay fixed to the device width without zooming when task inputs focus. Tapping or dragging on the timeline opens an editor that shares the final block's paper background, radius, and borders, while task checkboxes are enlarged for touch; the editor no longer feels visually detached or shifts because of the keyboard, scrolling, or viewport changes. Both the mobile keyboard's Done key and the blur caused by dismissing the keyboard now fully convert the temporary editor into a real task block, restoring drag, resize, and tap-to-edit behavior; project suggestions after `#` support independent touch scrolling, and rapid consecutive actions reliably create the task. A short press on a timeline task first opens a compact bottom sheet. Its title and project are directly editable; start and end use native wheel-style controls restricted to exact 15-minute increments; and Unfinished can be tapped again to cancel. Subtasks appear directly at the bottom with working checkboxes, show up to three complete rows, and scroll independently when more exist; the sheet grows with its content, while More expands the full-width detail sheet and its close button stays fixed at the upper right. Timeline blocks replace the crowded centered resize bars with top-left start and bottom-right end points that sit on the block boundaries and tuck slightly inward; both retain 44px touch targets and briefly show drag hints after save. The portrait ruler now hugs the time labels, blocks fill the timeline width, the top-bar date is larger, and navigation arrows use less width. The candidate view removes its repeated heading and groups Done, AI scheduling, and a prominent quick-add button at the top right to free more room for content.
- Portrait mobile web views no longer use a simulated device shell with outer margins, borders, or oversized corners. The workspace and paper background now fill the available viewport; the dock sits lower as a slimmer safe-area toolbar, with less timeline space reserved beneath it so the main page gains more room on narrow screens.
- Retired purple and fluorescent-lime defaults across shared workspace controls now follow the active theme, including Planning, quick add, AI, undo, task-tree, scheduling feedback, timer, and focus states. Missing project colors no longer revert to lime, and the Planning sidebar uses the dark paper surface in dark mode with clear tool contrast.
- Automatic scheduling no longer requires an extra buffer at the end of the work window. A complete task can finish exactly at the planning boundary, and long tasks split across dates now use each window's full available capacity. Project start-time preferences learned from scheduling history now determine the task's actual position inside a free window, while the remaining time before and after stays available. New windows created after applying a buffer are snapped back to the scheduling grid, preventing starts such as 09:05 while keeping the actual gap at least as large as configured. Today is now determined from the local calendar date, and the earliest available time adds the five-minute preparation window before snapping once, preventing both wrong-day scheduling across a UTC date boundary and an unnecessary skipped 15-minute slot.
- Time-share metrics now calculate the default current day and rolling 7-, 30-, and 90-day boundaries from local calendar dates instead of moving the lower bound back a day during UTC conversion. Planned time spanning midnight uses calendar-day distance, preventing daylight-saving transitions from adding or removing an hour. Timestamped time entries are assigned to their corresponding local dates across time-share metrics, heatmaps, and active streaks, so work near midnight no longer lands on the wrong day.
- Task, recurring-instance, habit, and widget-countdown schedules that cross midnight now advance their end date across creation, moving, resizing, duration edits, task/calendar-event conversion, legacy-event recovery, legacy timeline loading, and month- or year-end boundaries. Moving an existing cross-day record or converting or restoring a cross-day event preserves its full duration, while older records without an end date infer the next day from their times. Task forms, AI imports, schedule templates, execution-capacity statistics, and detail summaries also recognize an end clock earlier than the start as crossing midnight instead of collapsing 23:30–00:30 to 15 minutes, zero, or a negative duration. Ordinary cross-day task records now appear in the time they actually occupy on each day, including their continuation when only the ending day is viewed; completing, editing, deleting, moving, or resizing any slice still operates on the complete source record, and records ending exactly at midnight retain their end resize handle. A 20-minute plan starting at 23:50 correctly ends at 00:10 the next day instead of disappearing, jumping to a stale date, collapsing to 15 minutes, or contributing zero planned time.
- Cross-midnight calendar events are now sliced into the time they actually occupy on each day. A 23:30–00:30 event appears as 30 minutes on either side of midnight, remains visible when viewing only the ending day, and recurring events include the previous evening's spill instead of duplicating the whole event on every date or collapsing it to 15 minutes. Moving a cross-day event preserves its total duration; resizing adjusts the complete event from the first slice's start or the last slice's end and updates its end date. Drag previews now evaluate conflicts on the target date instead of treating matching clock times on different dates as overlaps, and schedule templates recognize intervals spilling into the selected date from the previous night so they are not placed over an existing cross-midnight plan.
- Monthly and quarterly recurring tasks now stay anchored to the original day of the month. A recurrence starting on the 31st temporarily uses the end of a shorter month, then returns to the 31st in a longer month instead of permanently drifting to the 28th, 29th, or 30th. Recurrence occurrence IDs are also parsed from the end with validated dates and times, so imported or synced source task IDs containing `__occ__` can still be completed, cancelled, and written back to the timeline, while malformed lookalike IDs are not mistaken for occurrences.
- Planning-tree moves now relocate nested subtasks atomically and reject placing a subtask inside one of its own descendants. Dropping before or after another nested subtask preserves the target's actual parent level and adjacent position, including moves between parent tasks, instead of incorrectly promoting the source to the root. Invalid drops preserve the original tree rather than losing the entire subtree when the target disappears with the source.
- Sync merging now accepts only structurally valid, parseable deletion times that are not implausibly far ahead, while allowing up to seven days of device clock skew. Legacy records without timestamps no longer disappear on their first sync; damaged or extreme-future tombstones are removed; and old tombstones superseded by a newer record with the same ID are pruned instead of permanently suppressing normal data, crashing backup restore, or continuing to occupy sync payloads.
- Planner data restored from cloud, local cache, or backup now deduplicates persisted collections by ID; bounds identities, text, arrays, nesting, and numeric values across tasks, projects, subtasks, goals, long-term tasks, drafts, notes, habits, time entries, timeline records, recurrence rules, and AI history; and normalizes custom schedule templates. Project categories, colors, completion state, and timestamps recover to valid values, while goal and long-term-task dates, states, and completion values are repaired. Only the latest state remains for each habit and date. Habit completion values and timestamps are repaired, and a schedule marker survives only when it points to a real timeline record on that habit's task for the same date. Legacy habit-plugin names are also count- and length-bounded, deduplicated, and assigned bounded IDs, while unrelated retired plugin payloads no longer remain in sync data. Task dates, categories, completion state, estimates, and legacy schedule fields recover to valid values; references to missing projects, goals, parent tasks, and planned subtask tasks are removed. Orphaned time entries are dropped, while dangling project and timeline references and damaged entry timestamps are repaired. Timeline records also repair task ownership, status, and end dates, while invalid recurrence rules, unknown AI actions, and damaged times are removed. Subtask trees, timeline records, template periods, legacy-event migration, AI conversations, messages, suggestions, and memories all have recovery limits. AI personalization profiles retain only bounded statistics and token weights for current projects, while task inference repairs sources, confidence, duration, and project references, preventing duplicate data from polluting metrics, malformed records from rendering incorrectly, and maliciously oversized data from stalling startup.
- Task CSV imports now validate the NavoPath header, reject unterminated quoted fields, bound task IDs, titles, project names, and metadata fields, clear invalid due dates before saving, and clamp positive estimates to 15 minutes through 24 hours. When a file repeats a task ID, only its first row is imported, preventing malformed dates or durations from entering rendering and sync paths or duplicate IDs from making later edits affect multiple tasks.
- Settings restored from cloud, cache, or backup now bound the length and count of names, titles, model identifiers, URLs, background paths, and collapsed-state lists; accept only size-bounded JPEG/PNG/WebP Base64 avatars; and consistently clear retired personal API-key state. Malformed settings can no longer amplify cache, sync, or rendering costs.
- Plugin settings and the usage guide now accurately distinguish executable official built-ins from desktop local plugins that contribute validated manifest metadata and configuration only. Local entries no longer claim to load `index.js` or appear as “Running,” and their permissions are clearly labeled as declarations. External manifests reject reserved object keys and duplicate config fields and normalize values by type, range, options, and text length; plugin settings restored from cloud, cache, or backup also deduplicate enabled IDs and bound config count, nesting, nodes, arrays, and text.
- Fixed long-lived sync callbacks retaining the empty account state from the app’s first render, which could place a signed-in user’s offline cache in the local-preview workspace and omit the current account from desktop recovery snapshots. Delayed saves, pulls, and snapshots now always read the active session.
- Fixed manual and scheduled syncs reading or writing the cloud concurrently, consecutive manual syncs in different directions dropping the later request, and queued scheduled work still running after automatic sync was disabled or the workspace was left. All sync entry points now safely share or queue work, while stopping cancels interval-only work that has not started. When a device or server clock is slightly ahead, sync status now labels the time as upcoming instead of incorrectly saying it happened minutes or hours ago.
- Upgraded the desktop runtime and build toolchain to address known dependency vulnerabilities in Electron, desktop packaging, the development server, and concurrent process startup while preserving the existing Windows packaging, web deployment, and local development workflows.
- Hardened desktop security boundaries: the main window, portrait window, and widget now load only the local app or a loopback development server, block remote pages from desktop capabilities such as authentication storage, backups, plugins, and updates, and reject untrusted navigation and new windows.
- Moved Today’s Candidates and its two quick actions into a dedicated row below the Tasks switch in portrait mode. Three-day/week timelines now use more of the paper width, with a larger flush-left ruler, day-boundary dates above an aligned 0:00 label, a blended date strip, and a left-aligned All Day label. The date controls no longer use a heavy gray fill, Back to now appears only when the current-time line leaves the viewport, and all-day tasks now contribute their estimated duration to Metrics.
- Added a white rounded Logo slider to the portrait Tasks / Schedule button. The Logo nearly fills the button height, Tasks sits closer to it, and switching slides the Logo across the old label before revealing the other state, with reduced-motion support.
- Fixed the portrait mode toggle to use the English Tasks / Schedule labels and the arrow-N brand asset; removed the duplicate outer frame so it renders as one left/right-flipping state button.
- Replaced the portrait Tasks / Schedule double segment with one large state button: “NavoPath mark | Tasks” switches on click to “Schedule | NavoPath mark”.
- Set the light-mode Dock to pure white. Portrait Tasks / Schedule no longer use generic icons: Tasks uses “NavoPath mark → label” while Schedule uses “label → NavoPath mark”.
- Rebuilt portrait Tasks / Schedule as icon-and-label paper segments and made Planning views use the same compact inset segmented control. The three-day/week ruler is narrower with smaller left-aligned time labels, dates are larger, Back to now is smaller and upper-right aligned, and the Dock uses a pure-black background.
- Reworked the portrait drag guide as an embedded task-to-timeline demonstration, using “Explore NavoPath · 15 min” as the first default guide task; restored the Dock to a deep ink surface.
- Added a dismissible portrait "task → schedule" line guide that explains dragging tasks into the timeline. Three-day and weekly views now use a full top control rail with lower, more compact date information; Back to now is a clean return-arrow icon. The Dock uses paper white in light mode and ink black in dark mode.
- Replaced the sparse-state Planning illustration with a strong text-led long-range planning guide: project → tasks → schedule.

### Improved
- Sped up website sign-in by removing the duplicate blocking cloud-profile query after password authentication. Workspace bootstrap now owns profile loading and can present the local cache sooner.
- Improved initial-load performance by loading landing-page and desktop-widget resources only when needed, so the main workspace no longer downloads those interfaces up front, with a tighter production build reducing initial script and style weight.

## 2026-08-24 · 竖屏任务与 AI 菜单交互

### 修复
- 优化竖屏快速添加、时间轴和 AI 菜单：快速添加任务的“更多”现在打开与正常任务一致的详情式编辑页，并以起止时间选择替代完成等操作行；时间轴任务第一次单点选中并显示缩放点，第二次单点打开短栏，点按任务块外退出选中，标记未完成的时间块也可调整起止边界；AI 输入框“+”菜单移除硬件同步，并可点按菜单外任意位置关闭。
- 横屏设置开关现在与竖屏使用同一套系统式尺寸、白色滑块和活动主题轨道。执行页从候选区、全天栏或时间轴拖动任务时，日、三日和周视图都会让真实任务块直接吸附到时间网格，不再用会被浮动任务遮住的白色目标框；移动已排程任务时原位置占位也会隐藏。

## 2026-08-24 · Portrait task and AI menu interactions

### Fixed
- Refined portrait quick add, timeline, and AI menus. Quick Add More now opens a task-detail-style editor whose middle action rows are replaced by start/end time controls; a first timeline-task tap selects it and exposes resize handles, a second tap opens its short sheet, an outside tap clears selection, and returned-unfinished blocks can also be resized. The AI composer “+” menu no longer includes hardware sync and closes on any outside tap.
- Landscape settings switches now use the same system sizing, white thumb, and active-theme track as portrait. When dragging a task from Candidates, All Day, or the timeline, Day, 3-Day, and Week views now snap the real task block directly into the time grid instead of showing a white target frame hidden beneath a floating task; moving a scheduled task also hides its old-position placeholder.

## 2026-08-23 · 全天任务拖放修复

### 修复
- 全天任务在保存后不再从日历消失；时间轴拖入和全天栏中新建的任务都可正确保存、重新载入并显示，勾选完成后会保留在原日期，也能按原预计时长再次拖回具体时间。

## 2026-08-23 · All-day task drag-and-drop fix

### Fixed
- All-day tasks no longer disappear after a save. Tasks dragged into or created directly in the all-day row persist, reload, and render correctly, stay on their date after completion, and can be dragged back to a specific time using their original estimated duration.

## 2026-08-20 · 横屏工作区交互修复

### 新增
- 全局 Agent 补齐实时计时状态与脱敏集成查询、最近 30 天审计历史、失败运行审计，以及需确认且可撤销的已有外部日历启停。模型与安全等级移入 AI 输入框左下角“+”菜单；标准、严格、只读三档只会收紧服务端权限。新增双账号生产冒烟测试，覆盖 RLS 隔离、未登录拒绝、SSRF 拒绝、集成撤销和 revision 冲突无部分写入；Supabase 数据库迁移、密钥与 Edge Functions 现在也纳入发布流水线。

### 修复
- 手机网络无法稳定连接 Realtime 时，前台会每 5 秒只检查一次云端 revision，并在页面恢复可见或重新聚焦时立即补查；只有版本变化才下载完整工作区，手机与电脑不再等到较长的定时同步周期。
- 离线工作区恢复联网时不再用云端较旧快照覆盖本地近期记录；本地未同步修改会跨重启保留，先与云端逐项合并并上传，成功确认前不会被实时更新、手动拉取、旧 revision 或过期保存回调清除。
- 修复窄横屏工作区被固定最小画布挤出视口的问题：执行双栏现在会自适应可用宽高，今日候选可独立滚动，日期标题可展开完整月历快速跳转且不再显示外框，“回到现在”拥有清晰图标与文字，时间轴任务可在悬停后拖动起止手柄。时间轴快速新建与 AI 对话顶栏改用统一的纸面细线图标，执行/规划切换保持居中，箭头 N 品牌标志恢复清晰对比；既有竖屏布局与交互保持不变。
- 修复触屏设备横屏时从候选任务卡片上滑无法滚动的问题，包括宽度超过紧凑布局断点的平板与高分辨率设备；所有横屏宽度现在都由纵向滑动优先滚动今日候选，长按任务后仍可拖到时间轴排程。

## 2026-08-20 · Landscape workspace interaction fixes

### Added
- Completed the Global Agent with live timer state and redacted integration queries, a 30-day audit-history view, failed-run audits, and confirmed reversible enable/disable changes for existing external calendars. Model and safety selection now live in the AI composer’s lower-left “+” menu, with Standard, Strict, and Read only modes that only tighten server permissions. Added a two-account production smoke test for RLS isolation, signed-out rejection, SSRF rejection, integration undo, and revision conflicts without partial writes; Supabase migrations, secrets, and Edge Functions are now part of the deployment workflow.

### Fixed
- When a mobile network cannot keep Realtime connected, visible clients now check the lightweight cloud revision every five seconds and immediately recheck after becoming visible or focused. The full workspace downloads only after a version change, so phone and desktop no longer wait for a long scheduled-sync interval.
- Reconnecting an offline workspace no longer lets an older cloud snapshot overwrite recent local records. Unsynced local changes survive restarts, merge item by item with the cloud, and upload before realtime updates, manual pulls, stale revisions, or outdated save callbacks may clear them.
- Fixed narrow landscape workspaces being pushed outside the viewport by a fixed minimum canvas. The Execute split view now adapts to available width and height, Today’s Candidates scrolls independently, the borderless date heading opens a complete monthly quick picker, Back to now has a clear icon and label, and timeline tasks expose draggable start/end handles on hover. Timeline quick creation and the AI chat header now use consistent paper-style line icons, the Execute/Planning switch stays centred, and the arrow-N brand mark has clear contrast, while existing portrait layout and interactions remain unchanged.
- Fixed touch devices failing to scroll Today’s Candidates when a landscape swipe started on a task card, including tablets and high-resolution devices wider than the compact-layout breakpoint. Vertical swipes now scroll the candidate list first at every landscape width, while a long press still lets the task be dragged onto the timeline.

## 2026-08-13 · AI 服务与模型更新

### 修复
- AI 请求改为通过 NavoPath 同域安全中转，并按供应商协议正确切换即时与深度思考模式，修复部分移动网络或 Safari 上 AI 无法使用的问题。模型目录同步到当前新一代模型，默认升级为 DeepSeek V4 Flash，旧模型偏好自动迁移，设置中可直接选择新模型。

## 2026-08-13 · AI service and model update

### Fixed
- Reworked portrait mobile entry points: the Dock's left-side plus is now a focused Navo AI chat entry, a reachable lower-right floating plus handles quick task capture, and the duplicate Tasks-header add button is gone. AI chat and Settings now use the same non-fullscreen bottom-sheet geometry as task details, with visible exit space, a grab cue, and an explicit close control. Settings use a compact search-and-category layout, grouped lists, iOS-sized switches, and more system-like touch buttons while continuing to follow the active theme accent.
- AI requests now use the secure NavoPath same-origin relay and the provider's supported instant/deep-reasoning protocol, fixing failures on some mobile networks and Safari sessions. The catalog now contains the current model generation, defaults to DeepSeek V4 Flash, migrates retired preferences automatically, and allows direct model selection in Settings.

## 2026-08-12 · 竖屏时间轴触摸交互

### 修复
- 网页端的登录与工作区资料请求现在通过 `navopath.com` 同域安全中转到 Supabase，规避部分移动网络或 Safari 无法稳定直连 `supabase.co` 而持续超时的问题；认证令牌与数据库行级权限仍由 Supabase 原样校验。
- 云端资料请求的超时窗口由 5 秒提高到 15 秒，避免 Safari 在较慢的移动网络路由上反复停留在“工作区暂时不可用”。
- 退出登录现在先清除本机会话，再完成云端认证收尾；Safari 断网或云端认证请求失败时，退出按钮不再卡住。
- 云端工作区读取超时或网络中断时，不再把临时空数据伪装成新账户并启动新手教程，也不会允许空工作区覆盖原账户数据；无可用本机缓存时会显示可重试、可退出登录的明确错误页，有可用缓存时继续保留该账户的本机内容。
- 桌面端在已登录账户的用户名或头像意外回落为默认值时，会从同一账户的最近离线快照恢复缺失的个人资料字段并重新同步到云端；任务、项目及其他设置不会被旧快照覆盖。
- iOS 将网页添加到主屏幕时，现在使用 NavoPath Logo 作为应用图标。
- 竖屏手机版网页固定按设备宽度显示，输入任务时不再触发页面缩放；时间轴锁定横向位置，只响应上下滚动。Tasks 列表中的任务改为长按后才进入拖拽，普通上下滑动会取消长按判定；拖拽开始后仍会自动切到 Schedule 以放入时间轴。Tasks 时长和 Schedule 视图选择改用 iOS 原生选择列表。点按或拖拽时间轴后，新增输入栏与正式任务块共用一致的纸面背景、圆角和边线，并进一步放大时间轴任务的勾选框，不再因样式割裂或键盘、页面滚动、视口变化影响操作。手机键盘的完成键可直接保存任务，输入井号后的项目列表支持独立触摸滚动。时间块移除挤在中间的横向缩放条，改为贴在边界交界处并略向内收的左上角开始点和右下角结束点；两处保留 44px 触控区域，新任务保存后会短暂显示角点及拖动提示。竖屏时间标尺向左压缩，日期进入顶栏，切换箭头变窄；候选页移除重复标题，将已完成、AI 排程和醒目的快速添加按钮集中到右上角，为列表与时间轴释放更多空间。

## 2026-08-12 · Portrait timeline touch interactions

### Fixed
- Web authentication and workspace-profile requests now reach Supabase through a same-origin `navopath.com` relay, avoiding persistent timeouts when some mobile routes or Safari sessions cannot connect reliably to `supabase.co`; Supabase still validates the original authentication token and row-level permissions.
- The cloud-profile request window now allows 15 seconds instead of 5, preventing Safari from repeatedly stopping at “Workspace temporarily unavailable” on slower mobile routes.
- Sign-out now clears the device session before completing cloud authentication cleanup, so the button no longer gets stuck when Safari is offline or the authentication request fails.
- When cloud workspace loading times out or the network drops, NavoPath no longer disguises temporary empty data as a new account or starts onboarding, and cannot overwrite the real account with an empty workspace. With no usable device cache it now shows a clear retry/sign-out page; with a usable cache it keeps that account's local content available.
- When a signed-in desktop account unexpectedly falls back to the default name or loses its avatar, NavoPath now restores only the missing profile fields from that same account's latest offline snapshot and syncs them back to the cloud without replacing tasks, projects, or other settings.
- Adding the website to an iOS Home Screen now uses the NavoPath logo as the app icon.
- Portrait mobile web views now stay fixed to the device width without zooming when task inputs focus; the timeline is horizontally locked and responds only to vertical scrolling. Tasks in the Tasks list now require a long press before dragging, while normal vertical scrolling cancels the hold; once dragging starts, the app still switches to Schedule for timeline placement. Task duration and Schedule view controls now use native iOS selection lists. Tapping or dragging on the timeline opens an editor that shares the final block's paper background, radius, and borders, while timeline task checkboxes are enlarged again for touch; the editor no longer feels visually detached or shifts because of the keyboard, scrolling, or viewport changes. The mobile keyboard's Done key saves immediately, and project suggestions after `#` support independent touch scrolling. Timeline blocks replace the crowded centered resize bars with top-left start and bottom-right end points that sit on the block boundaries and tuck slightly inward; both retain 44px touch targets and briefly show drag hints after save. The portrait time ruler is narrower and farther left, the date now sits in the top bar, and navigation arrows use less width. The candidate view removes its repeated heading and groups Done, AI scheduling, and a prominent quick-add button at the top right to free more room for content.

## 2026-08-11 · 竖屏移动端全幅布局

### 修复
- 竖屏手机版网页不再套用带外边距、边框和大圆角的模拟设备外壳，工作区与纸面背景现在贴合整个可用视口；底栏下移并压缩为更轻薄的安全区工具栏，同时减少时间轴底部预留，在窄屏上为主页面释放更多空间。

## 2026-08-11 · Full-width portrait mobile layout

### Fixed
- Portrait mobile web views no longer use a simulated device shell with outer margins, borders, or oversized corners. The workspace and paper background now fill the available viewport; the dock sits lower as a slimmer safe-area toolbar, with less timeline space reserved beneath it so the main page gains more room on narrow screens.

## 2026-07-28 · 规划数据恢复加固

### 修复
- 从云端、本地缓存或备份恢复规划数据时，现在会限制目标、长期任务、草稿、笔记、习惯、时间记录、时间轴记录、重复规则和 AI 历史的身份、文本、数组、嵌套与数值边界，清理无效引用、时间、重复标签及未知 AI 操作，并规范化项目分类、品牌默认色、完成状态与时间戳，目标和长期任务的日期及状态，以及任务日期、分类、完成状态、预计时长、旧版排程字段和自定义日程模板；不存在的项目、目标、父任务及子任务计划引用会被移除，孤立时间记录会被丢弃，记录中的悬空项目、时间轴引用与损坏时间戳会被修复。习惯状态只接受真实布尔完成值，修复完成时间和状态时间戳，并只保留指向该习惯当日任务真实时间轴记录的排程标记。旧版习惯插件最多迁移 1,000 个去重且长度受限的名称，并清除无关旧插件载荷。重复规则最多执行 10,000 次、单次最长 24 小时，AI 历史最多恢复 500 个会话、每会话 500 条消息及最近 5,000 条记忆，并限制消息内的步骤、操作和计划数量。AI 个性化画像现在只接受现有项目的有界统计和词权重，任务推断会规范化来源、置信度、时长及项目引用。

## 2026-07-28 · Planner data recovery hardening

### Fixed
- Planner data restored from cloud, local cache, or backup now bounds identities, text, arrays, nesting, and numeric values across goals, long-term tasks, drafts, notes, habits, time entries, timeline records, recurrence rules, and AI history; cleans invalid references, times, duplicate tags, and unknown AI actions; and normalizes project categories, brand-default colors, completion state, and timestamps; goal and long-term-task dates and states; task dates, categories, completion state, estimates, legacy schedule fields; and custom schedule templates. References to missing projects, goals, parent tasks, and planned subtask tasks are removed; orphaned time entries are dropped; and dangling project and timeline references and damaged entry timestamps are repaired. Habit states accept only real boolean completion values, repair completion and state timestamps, and retain schedule markers only when they point to a real timeline record on the same habit's task and date. Legacy habit plugins migrate at most 1,000 deduplicated, length-bounded names and discard unrelated retired plugin payloads. Recurrence rules allow at most 10,000 occurrences and 24 hours per occurrence, while AI history restores at most 500 conversations, 500 messages per conversation, and the latest 5,000 memories with bounded steps, actions, and plan blocks. AI personalization profiles now accept only bounded statistics and token weights for current projects, and task inference normalizes sources, confidence, duration, and project references.

## 2026-07-27 · 输入与插件安全

### 修复
- 图片附件与头像现在会在解码前校验格式、文件大小及像素尺寸，PDF OCR 和图片增强画布也遵守统一像素与最长边预算，避免超大图片或异常页面耗尽内存。
- CSV 任务导入现在限制最多 20,000 行，JSON 备份会在迁移前限制嵌套深度与结构节点数，避免小文件在解析后膨胀成异常规模的数据结构。
- 桌面端外部插件恢复为仅加载经过大小与对象结构校验的 manifest 及配置，超限或异常文件会在完整读取前跳过；插件目录中的脚本不再向渲染器暴露或执行，防止插件绕过声明权限访问认证存储和其他桌面能力。
- 桌面认证 token 不再在系统加密不可用或失败时以可逆 Base64 明文落盘；旧的明文回退凭据会被清除，用户当前会话仍可继续，但下次启动可能需要重新登录。
- 继续升级桌面更新、打包与边缘函数开发工具链：YAML 解析器、Electron Builder、Wrangler、Axios、Sharp、PostCSS、Tar 等依赖已更新至兼容修复版，消除可在现有版本范围内修复的拒绝服务、路径遍历与请求构造漏洞。
- 更新日志页面现在会逐条忽略损坏的本地账号缓存，仍能从其他有效缓存或预览设置恢复语言，不再因单个异常条目回退到错误语言。
- 工作区恢复活动计时器前会校验任务 ID 与已用时间；损坏或错误类型的缓存不再产生无效任务状态、负数或 `NaN` 计时显示。
- 桌面本地资料恢复会在读取前限制文件大小、在规范化时限制子任务嵌套深度，先备份超限、语法损坏或结构无效的原文件再安全回退，并逐项过滤可读取资料中的损坏项目、任务、事件、习惯、时间轴记录和嵌套子任务；异常数据不再无备份覆盖原件、耗尽内存或阻止整个工作区启动。
- 桌面本地资料保存与恢复现在共用 20 MiB 和顶层结构契约，并通过临时文件原子替换主资料；自动离线快照也会限制结构和文件大小、在读取前拒绝超限文件，并原子替换最新副本。异常保存或进程中断不再直接截断现有数据文件。
- 桌面登录会话缓存现在限制为 4 MiB、校验顶层结构并原子更新；系统加密暂不可用、加解密或写入失败时会保留原会话，损坏或超限缓存也会在恢复写入前备份，不再被空缓存覆盖或导致登录存储报错。
- 桌面组件跨窗口消息现在按窗口职责隔离并校验操作结构：只有主窗口能推送状态，只有组件及其弹层能发起操作；竖屏小窗不再每秒交替覆盖组件快照，异常或超大操作也不会传入工作区。
- 桌面托盘唤醒、二次启动和系统激活现在始终定位明确的主窗口，不再因窗口列表顺序误显示组件或竖屏小窗；离线恢复快照也只由主窗口读写，竖屏小窗不再生成重复快照或覆盖最新恢复点。更新状态与组件操作转发还会跳过正在销毁的渲染器，避免关闭竞态中断主进程。
- 开机自启动设置现在以 Windows 返回的实际状态为准；系统拒绝设置或桌面通信失败时不再错误显示已开启，读取失败也不会永久停留在加载状态。

## 2026-07-27 · Input and plugin security

### Fixed
- Image attachments and avatars now validate format, file size, and pixel dimensions before decoding. PDF OCR and image-enhancement canvases also share pixel and maximum-side budgets to prevent oversized images or malformed pages from exhausting memory.
- Task CSV imports now allow at most 20,000 rows, while JSON backups limit nesting depth and structural node count before migration, preventing small files from expanding into abnormally large in-memory structures.
- Desktop external plugins are again limited to manifest metadata and configuration validated for file size and object shape, with oversized or malformed files skipped before a full read. Scripts from plugin directories are no longer exposed to or executed in the renderer, preventing plugins from bypassing declared permissions to access authentication storage or other desktop capabilities.
- Desktop authentication tokens no longer fall back to reversible Base64 plaintext when system encryption is unavailable or fails. Existing plaintext fallback credentials are removed; the current session can continue, but the next launch may require signing in again.
- Continued upgrading the desktop update, packaging, and edge-function development toolchain. The YAML parser, Electron Builder, Wrangler, Axios, Sharp, PostCSS, Tar, and related dependencies now use compatible patched releases, eliminating the denial-of-service, path-traversal, and request-construction vulnerabilities fixable within current version ranges.
- The changelog page now ignores damaged local account caches one entry at a time, so it can still restore the language from another valid account cache or preview setting instead of falling back to the wrong language.
- The workspace now validates the task ID and elapsed time before restoring an active timer. Damaged or incorrectly typed caches no longer create invalid task state or negative/`NaN` timer displays.
- Desktop local-data recovery now limits file size before reading and subtask nesting depth during normalization, backs up oversized, syntactically damaged, or structurally invalid source files before falling back safely, and filters damaged projects, tasks, events, habits, timeline records, and nested subtasks from readable data individually. Invalid data no longer overwrites the original without a backup, exhausts memory, or prevents the whole workspace from starting.
- Desktop local-data saving and recovery now share the same 20 MiB and top-level structure contract, and saves replace the main data file atomically through a temporary file. Automatic offline snapshots now also enforce structure and file-size limits, reject oversized files before reading them, and atomically replace the latest copy. Rejected saves or an interrupted process no longer directly truncate existing data files.
- Desktop login-session storage is now limited to 4 MiB, validates its top-level structure, and updates atomically. The existing session is preserved when system encryption is temporarily unavailable or encryption, decryption, or writing fails, while damaged or oversized caches are backed up before recovery writes instead of being replaced by an empty cache or causing storage errors.
- Desktop widget messages are now isolated by window role and action structure is validated: only the main window can push state, while only the widget and its popover can request actions. The portrait window no longer overwrites widget snapshots every second, and malformed or oversized actions no longer reach the workspace.
- Desktop tray wakeups, second launches, and system activation now always target the explicitly tracked main window instead of showing a widget or portrait window according to list order. Offline recovery snapshots are also restricted to the main window, so the portrait window no longer creates duplicates or overwrites the latest recovery point. Update-state and widget-action relays also skip renderers that are being destroyed, preventing close-time races from interrupting the main process.
- Launch-at-startup settings now follow the actual state returned by Windows. The control no longer incorrectly shows enabled when the system rejects the change or desktop communication fails, and a failed read no longer leaves it loading indefinitely.

## 2026-07-26 · 时间轴与数据导出修复

### 修复
- 修复跨午夜的重叠任务未正确并排显示的问题；时间轴现在会把结束时间早于开始时间的任务识别为跨天区间，并稳定计算冲突列。
- 修复 CSV 导出与重新导入：公式式标题会安全保存为文本，带逗号、引号或换行的任务可完整往返，重新导入时也会按项目名恢复任务归属。
- 加固 JSON 完整备份导入：旧备份会先迁移缺失集合和设置，非法枚举、尺寸及小组件偏好会回退到安全默认值，损坏或缺少核心集合的文件会在覆盖任何当前数据前被拒绝；明确恢复的备份内容会作为最新版本覆盖旧同步墓碑。
- 统一云端、本地预览与备份导入的设置迁移规则；本地预览仍保留专属名称和面板宽度，且损坏的本地设置或规划数据快照不再阻止应用启动。
- 加固共享资料迁移：云端资料、旧备份或本地快照中的单个空值、错误类型及损坏的子任务、时间记录、AI 消息或模板时段会被安全忽略，不再拖垮整份资料加载。
- 启动缓存现在会在显示或回放未同步改动前校验并迁移资料、设置及同步标记；损坏缓存会被忽略，异常或错误类型的“待同步”标记不会覆盖云端资料。
- 修复跨设备删除后旧任务、项目、习惯等资料再次出现的问题；完整资料保存现在会记录删除时间，同步冲突会保留更新较新的删除或重建结果。
- 修复强制仅拉取与后台保存并发时，本地旧请求可能在拉取后重新入队或覆盖结果的问题；仅拉取现在会作废并等待在途保存，迟到的旧 revision 响应也会被忽略。
- 加固账号会话隔离：快速登录或切换账号时，上一工作区迟到的加载、实时更新、云端资料缓存及延迟快照不会再落入当前会话；待邮箱确认的注册不会误判为已登录，失败的登出也会保留现有会话。
- 本地预览在浏览器存储被禁用或空间不足时会自动使用会话内存继续保存，不再中断加载与编辑；旧版本遗留的个人 AI API Key 会从本地设置中清除，公开网页不再保留或直连第三方模型密钥。
- 文件导入现在会在读取前限制备份与 CSV 大小，并在解压 DOCX 前校验条目数和声明的未压缩体积，避免异常或恶意文件占满渲染进程内存。

## 2026-07-26 · Timeline and data export fixes

### Fixed
- Fixed overlapping tasks that cross midnight not rendering side by side. The timeline now treats an end time at or before the start as a next-day boundary and assigns conflict columns consistently.
- Fixed CSV export and re-import. Formula-like titles are stored safely as text, tasks containing commas, quotes, or line breaks round-trip intact, and imported tasks recover their project assignment by project name.
- Hardened full JSON backup imports. Legacy backups now migrate missing collections and settings first, invalid enums, panel sizes, and widget preferences fall back safely, and corrupt files or files missing core collections are rejected before any current data is overwritten; explicitly restored backup content is treated as the latest version so old sync tombstones cannot hide it.
- Unified settings migrations across cloud profiles, local preview, and backup imports. Local preview keeps its own display name and panel widths, while corrupt local settings or planner snapshots can no longer prevent the app from starting.
- Hardened shared profile migration. Isolated nulls, invalid value types, and damaged subtasks, timeline records, AI messages, or template slots in cloud profiles, legacy backups, and local snapshots are now ignored instead of preventing the entire profile from loading.
- Startup caches are now validated and migrated before their data, settings, or unsynced changes are displayed or replayed. Corrupt caches are ignored, and malformed dirty flags can no longer overwrite cloud data.
- Fixed tasks, projects, habits, and other records reappearing after deletion on another device. Full-profile saves now record deletion times, and sync conflicts preserve whichever deletion or recreation happened later.
- Fixed forced pull-only sync racing with background saves, which could requeue an old local request or overwrite the pulled result. Pull-only sync now invalidates and waits for in-flight saves, and late responses with older revisions are ignored.
- Strengthened account-session isolation. During rapid sign-ins or account switches, late workspace loads, realtime updates, cloud-profile caches, and delayed snapshots from the previous account can no longer reach the current session. Signups awaiting email confirmation are no longer treated as signed in, and a failed sign-out preserves the existing session.
- Local preview now falls back to in-session memory when browser storage is blocked or full, so loading and editing can continue. Personal AI API keys left by older versions are removed from local settings, and the public web app no longer stores them or connects directly to third-party model endpoints.
- File imports now limit backup and CSV sizes before reading, and validate DOCX entry counts and declared uncompressed size before extraction, preventing malformed or malicious files from exhausting renderer memory.

## 2026-07-19 · 实时云同步与私有日历订阅

### 本次补充
- 顶栏搜索按钮左侧新增“立即同步”入口，可直接推送本地改动并拉取同账号的最新云端数据。
- 同步按钮点击后会立即显示进度反馈；云端请求若无响应会主动超时并有限重试，不再让同步或订阅按钮无限等待。
- 修复生成日历订阅时偶发连接池超时的问题，瞬时数据库连接故障现在会自动重试。
- 修复习惯及每日完成状态未参与跨设备合并、导致一端的旧数据覆盖另一端更新的问题。
- 修复今日候选任务名居中及展开详情错位的问题；所有候选任务名现统一左对齐，展开时标题与操作按钮保持同行，备注区域不再显示阴影。

### 新增
- 新增可撤销的私有 Webcal 日历订阅：登录用户可在“设置 → 高级 → 日历与集成”生成只读链接，将时间轴排程、日历事件和未排程任务截止日订阅到 iPhone、Notion Calendar 等日历；完整令牌仅显示一次，更换或撤销后旧链接立即失效。

### 修复
- 修复同一账号在网页端与桌面端之间不能实时同步的问题；云端资料更新现在会立即广播到其他在线设备，并在设备重连后自动补取断线期间错过的最新版。
- 修复日历订阅数据库迁移后 PostgREST schema cache 未及时重建、导致云端资料查询暂时返回 503 的问题。

## 2026-07-19 · Realtime cloud sync and private calendar subscriptions

### Current additions and fixes
- Added a Sync now action immediately left of Search in the top bar, providing direct push-and-pull sync for the signed-in account.
- Sync now provides immediate progress feedback, while unresponsive cloud requests are actively timed out and retried only once so sync and subscription actions cannot wait indefinitely.
- Fixed intermittent connection-pool timeouts while generating calendar subscriptions by retrying transient database connection failures.
- Fixed habits and daily completion states being omitted from cross-device merges, which allowed stale data on one device to overwrite newer updates from another.
- Fixed centered candidate task names and the misaligned expanded detail layout. Candidate task names are now consistently left-aligned, expanded titles stay beside their actions, and the notes surface no longer has a shadow.

### Added
- Added revocable private Webcal subscriptions. Signed-in users can create a read-only link in Settings → Advanced → Calendar & Integrations for timeline blocks, calendar events, and unscheduled task deadlines in iPhone, Notion Calendar, and other calendar clients. The complete token is shown once, and replacing or revoking it immediately invalidates the old link.

### Fixed
- Fixed realtime syncing between the web and desktop apps for the same account. Cloud profile updates now reach other online devices immediately, with an automatic revision check after reconnecting to recover changes missed while offline.
- Fixed a PostgREST schema-cache refresh failure after the calendar-subscription migration that temporarily returned 503 responses for cloud profile queries.

## 2026-07-18 · iOS 原生工程与 Windows 开发流程

### 新增
- 新增可持续开发的 iOS 原生工程：现有 React/Vite 竖屏应用现在可通过 Capacitor 同步到 iOS 15+，在真机上使用原生状态栏、刘海与底部安全区，并在原生环境中移除网页预览用的模拟手机外框。首版锁定竖屏，同时提供 Windows 局域网手机预览、iOS 工程同步与交付到 Xcode 的开发流程。

### 修复
- 升级桌面运行时与构建工具链，修复 Electron、桌面打包器、开发服务器和并发启动工具中的已知依赖漏洞，并保持现有 Windows 打包、网页部署与本地开发流程兼容。
- 收紧桌面端安全边界：主窗口、竖屏窗口与小组件只加载本地应用或回环地址的开发服务，阻止远程页面访问认证存储、备份、插件、更新等桌面能力，并拦截不受信任的页面导航与新窗口。

### 改进
- 加快网站登录进入工作区的速度：密码认证成功后不再重复等待云端资料查询，工作区初始化统一负责加载资料，并可更早复用本机缓存呈现界面。
- 优化首次加载性能：首页与桌面小组件资源改为按需加载，主工作区不再提前下载这些界面资源，并通过更紧凑的生产构建降低首屏脚本与样式体积。

## 2026-07-18 · Native iOS project and Windows development workflow

### Added
- Added a maintainable native iOS project. The existing React/Vite portrait app can now sync through Capacitor for iOS 15+, uses the native status bar and device safe areas, and removes the simulated phone frame inside the native container. The first release is portrait-only and includes Windows LAN phone preview, iOS project sync, and Xcode handoff workflows.

### Fixed
- Upgraded the desktop runtime and build toolchain to address known dependency vulnerabilities in Electron, desktop packaging, the development server, and concurrent process startup while preserving the existing Windows packaging, web deployment, and local development workflows.
- Hardened desktop security boundaries: the main window, portrait window, and widget now load only the local app or a loopback development server, block remote pages from desktop capabilities such as authentication storage, backups, plugins, and updates, and reject untrusted navigation and new windows.

### Improved
- Sped up website sign-in by removing the duplicate blocking cloud-profile query after password authentication. Workspace bootstrap now owns profile loading and can present the local cache sooner.
- Improved initial-load performance by loading landing-page and desktop-widget resources only when needed, so the main workspace no longer downloads those interfaces up front, with a tighter production build reducing initial script and style weight.

## 2026-07-15 · 时间轴拖拽修复与独立竖屏窗口

### 新增
- 桌面端新增独立于「正在做」小组件的完整竖屏窗口：默认以 420 × 760 打开，可自由调整大小，并可单独开启或关闭始终置顶。

### 修复
- 重做竖屏工作区：移除顶栏和搜索入口，底部改为纸面风格 Dock，提供添加、执行／规划切换和设置；候选区仅保留筛选与优化建议；规划视图切换移至顶部横栏，并在拖回任务时明确提示「移回今日候选」。默认主题色改为深棕墨色，减少泛红、泛绿的背景感；时间轴去除外框，回到现在入口下移以避开顶部控件，Dock 图标保持同一底色。
- 竖屏规划页的视图选项改为无阴影、无卡片感的等分顶栏，视图数量变化时自动铺满可用宽度；筛选入口贴齐右上角并移除默认边框。
- 重构竖屏执行页：今日候选成为带圆角的手机式主页面，顶栏将 Tasks／Schedule、居中标题和右侧操作整合在同一行；移除收起与候选筛选按钮，改为带明显选中态的「显示已完成」快捷键。底部 Dock 改为深色全宽底栏；空状态新增纸面插画，以箭头指向左下角高亮的添加键。
- 优化竖屏空状态插画与手机框架：将插画替换为透明线稿，避免与纸面背景形成突兀色块；整个执行／规划工作区现收进深色外壳的完整圆角画布，底栏随外壳一起圆角裁切。
- 竖屏底栏改为更轻的暖石色，并保留纸面分隔与主题色选中标记；空状态透明引导插画放大为整屏层，箭头终点校准到左下角的添加按钮。
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
- Redesigned the portrait workspace: removed the header and search entry, replaced the bottom navigation with a paper-style dock for Add, Execute/Planning, and Settings, kept only filtering and schedule suggestions in Candidates, moved Planning view choices into a top rail, and added an explicit return-to-candidates drop hint. Default accents now use deep brown ink to reduce red/green background casts; the timeline has no outer frame, Back to now sits below the top controls, and dock icons share one surface.
- Updated portrait Planning view choices to a shadow-free, evenly distributed top rail that fills the available width as the number of views changes; the Filter entry now sits flush at the upper-right without a default border.
- Rebuilt the portrait Execute page as a rounded phone-like primary surface: Tasks/Schedule, the centered candidate title, and right-side actions now share one top bar; the collapse and candidate-filter controls are removed in favor of a clearly selected Show completed shortcut. The Dock is now a dark full-width bottom bar, and the empty state adds a paper illustration that points to the emphasized lower-left Add action.
- Refined the portrait empty-state illustration and phone frame: the illustration is now a transparent line drawing rather than a mismatched paper-colored block, while the full Execute/Planning workspace is contained in one dark-shell rounded canvas with the bottom bar clipped into the same corners.
- Changed the portrait bottom bar to a lighter warm-stone tone with paper separation and theme-driven active marking; the transparent empty-state guide now scales to a full-screen layer with its arrow aligned to the lower-left Add button.
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
