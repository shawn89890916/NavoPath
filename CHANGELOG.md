# NavoPath 更新日志

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
