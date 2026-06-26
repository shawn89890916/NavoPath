# NavoPath 更新日志

## 2026-06-26 · 短任务时长调整、同步方向与更新检测

### 改进
- 设置 → 云端同步新增「推送到云端」「从云端拉取」两个方向按钮：可单独把本机数据上传到云端，或单独用云端数据覆盖本机，无需每次都执行双向合并，跨设备同步更可控。
- 优化任务块调整手柄的视觉与交互：判定区域收窄为任务块宽度的四分之一并居中，避免遮挡标题；提示条改为更细的常驻指示线，悬停时高亮，减少视觉干扰。

### 修复
- 修复重复创建后台窗口的问题：防止从托盘菜单或 app.activate 事件重复调用 createWindow() 时创建多个不可见窗口，确保应用始终只保留一个窗口。
- 修复 15 分钟与 30 分钟短任务时长无法调整的问题：短任务块现可在顶部与底部边缘拖拽缩放，调整手柄横向居中于任务块、悬停时清晰可见，且不再与拖动移动冲突。
- 修复桌面应用检查更新始终提示「已是最新版本」的问题；此前的更新清单（latest.yml）版本号停留在旧版本，现已随每次发布正确生成，新版本发布后即可被准确检测到。

---

## 2026-06-25 · 同步、本地备份与任务块填充

### 改进
- 设置 → 插件页面完成重构：所有插件卡片现由统一插件注册表驱动，「启用/停用」按钮真正写入设置并触发插件生命周期钩子；点击「配置」会弹出表单对话框编辑该插件的字段（番茄时长、城市、Markdown 开关等），保存后即时生效。
- 同步按钮点击后现显示旋转加载动画，并根据结果给出明确反馈：同步完成、已是最新数据或同步失败均有对应提示，不再静默无响应。
- 设置 → 外观新增「任务块颜色填充」开关：开启后时间轴任务块以归属项目色整块填充，任务名与悬停后的归属项目文字加上细微白色描边，在饱和色块上依旧清晰可读。
- 每次打开桌面应用时自动将当前数据与设置导出为本地 JSON 快照（保留最近 10 份历史快照与一份最新副本），即便云端异常也不会丢失数据。
- 桌面应用新增「开机自启动」开关（设置页），登录系统时可自动打开 NavoPath。
- 桌面应用新增单实例锁，重复启动时会聚焦到已打开的窗口而非多开。
- 时间轴短任务（15 分钟）标题字体最小提升至 12px 并启用抗锯齿渲染，解决文字模糊不清的问题；设置 → 外观新增"时间轴字体大小"滑块（85% – 130%），可在不同屏幕尺寸下自由调整。
- 时间轴快速添加面板重构为单行紧凑布局：移除顶部时间显示区域，仅保留任务名输入框与确认勾选按钮，添加效率更高。
- 时间轴左右翻页按钮宽度从 36px 扩大至 48px，并通过伪元素扩展横向触摸识别区域，减少误触与操作无效。

### 修复
- 修复任务块在「颜色填充」模式下完成时背景被替换为灰色的问题；现在完成态仅降低透明度并保留原项目色，删除线效果单独叠加，视觉一致性恢复。
- 修复同步功能始终使用缓存数据、无法拉取服务器最新版本的问题；启动与刷新现在会强制拉取最新 profile，跨设备改动不再被本地缓存覆盖。
- 修复短任务（15 分钟）调整手柄判定问题：短任务现在仅在块中心一条窄带可拖拽缩放，顶部与底部边缘回归拖动移动，避免误触改时长。
- 修复已登录用户在云端 profile 查询失败时被强制进入本地预览模式、无法退出登录的问题；profile 查询失败现在降级为内存空数据，保持登录状态可用。
- 修复运行时降级标志被持久化到 localStorage 导致应用永久困在预览模式的问题；降级现在仅在当前会话生效，重启后重新尝试云端后端，并清理旧版本残留的持久化标志。
- 修复执行页候选任务卡片删除后任务重新出现的问题；所有删除路径现在统一使用 `dataRef.current` 读取最新数据，彻底消除 stale-closure 竞态。
- 修复任务详情抽屉中删除任务后任务重新出现的问题。
- 修复将任务转换为事件时删除原任务可能被恢复的问题。
- 修复云端数据库查询失败时应用卡在加载页无法进入的问题；现在会自动降级到本地预览模式，保证工作区始终可用。
- 修复应用被永久困在本地预览模式的问题；运行时降级现在仅在当前会话生效，下次启动会重新尝试云端后端。
- 修复 15 分钟单行任务在时间轴中标题被调整手柄和勾选框遮挡的问题；标题现在占据完整高度并垂直居中，不再被裁切。
- 修复 `package.json` 描述字段的编码乱码问题。

---

访问 [www.navopath.com](https://www.navopath.com) 来开启 NavoPath 之旅！

## 2026-06-23 · 更可靠的桌面登录与同步

### 改进
- Windows 桌面端现在会使用系统加密存储长期保留登录会话，关闭应用或重启电脑后仍可直接进入工作区，主动退出登录后才会清除会话。
- Windows 桌面端未登录时直接显示简洁的登录与注册页面，不再先展示网站介绍；网页端首页保持不变。
- 多设备同步改为以最新版本合并，不再把本地数据固定覆盖到云端，其他设备新增的任务和计划不会再被误删。
- 深色模式整体改为简约中性灰风格，移除蓝紫色调，文字、卡片与设置面板对比度更高，长时间使用更舒适。
- 设置面板的强调色与导航项在深色模式下改为中性背景，去除蓝紫色高亮。
- 左上角 NavoPath logo 在浅色与深色模式下都保持清晰，去除灰蒙蒙的反色滤镜。
- 设置"一天开始时间"后时间轴会平滑滚动到对应时刻并显示确认提示。
- 默认字号略微调大，阅读更舒适。

### 修复
- 修复三日、周和月视图切换按钮被时间轴左右翻页热区遮挡而无法点击的问题。
- 修复桌面端下载更新后点击"重启并安装"会触发 `quitAndInstall is not a function` 异常、导致无法进入安装流程的问题。
- 修复深色模式下部分文字仍为黑色难以辨认的问题。
- 修复时间轴中 15 分钟时长的任务标题显示不全的问题。

---

访问 [www.navopath.com](https://www.navopath.com) 来开启 NavoPath 之旅！

## 2026-06-24 · 时间轴快速添加与短任务修复

### 改进
- 时间轴快速添加弹窗重新设计为统一卡片样式，包含时间标签、输入框与项目选择菜单，视觉更连贯，不再出现割裂的浮层。
- "一天开始时间"设置现在支持分钟精度（如 09:30），时间轴网格、任务块、当前时间线与拖放定位均按精确起点对齐。
- 时间轴同一时段超过 4 个重叠任务时不再被压缩到同一列，每个任务都会获得独立列，不再互相遮挡。

### 修复
- 修复点击时间轴上已有任务块时仍会弹出快速添加面板的问题；现在仅在点击空白时段时触发。
- 修复 15 分钟时长的短任务标题被截断、调整大小手柄不可操作的问题。
- 修复快速添加任务后面板不关闭、持续残留的问题；现在保存后面板自动关闭并记住上次选择的项目。
- 修复修改"一天开始时间"后快速点击添加任务导致时间轴错位的问题。
- 修复规划页面删除子任务后子任务暂时消失又重新出现、无法成功删除的问题。
- 修复规划页面添加大量子任务后按钮与图标布局错位的问题。
- 修复三日、周视图中点击某天快速添加任务后，被点击的当天会跳到视图最左侧的问题；现在若目标日期已在可见范围内就保持原位。
- 修复时间轴左右翻页切换日期失灵的问题。
- 修复深色模式下快速添加确认按钮变成白色、几乎看不见的问题，现在恢复为强调色按钮。

---

访问 [www.navopath.com](https://www.navopath.com) 来开启 NavoPath 之旅！

## 2026-06-22 · 桌面端体验全面提升

### 新功能
- 桌面端新增系统托盘后台运行能力，关闭窗口后应用驻留托盘，点击托盘图标可恢复窗口。
- 设置 → 外观新增"一天开始时间"选项，默认 0:00，可自定义一天起始时刻。
- 全屏模式支持按 ESC 键快速退出。
- 网页端与桌面端默认每小时自动同步一次云端任务、计划与设置；可在设置 → 账户 → 云端同步里改为每 15 分钟、每 6 小时、每 24 小时，或关闭自动同步、只保留手动同步。
- 设置 → 账户新增"立即同步"按钮，可随时把本地修改推上云端并拉回最新版本，同步过程中按钮显示"正在同步"并被禁用。
- 同步时间会被记录并跟随账户同步到所有设备，账户页会显示"刚刚 / N 分钟前 / N 小时前"相对时间与绝对时间，方便查看上次同步时间。

### 改进
- 桌面端 AI 功能改为优先使用本地 DeepSeek IPC 通道，网络异常时自动回退到云端 Edge Function。
- "明确下一步"按钮新增加载状态和完成提示，点击后可见"生成中…"动画和结果通知。
- 添加栏 Task / Project 切换按钮改为两等分占满全部横向空间。
- 设置中强调色区域新增分隔线和分类标题，视觉层次更清晰。
- 去除设置中强调色选择框的多余阴影。
- 三日视图展开时勾选框与任务名不再重叠，短任务块布局更紧凑。
- 时间轴 24:00 底部不再留有大段空白，时间轴紧贴底部结束。
- Plan Suggestions 按钮缩小并左移，不再遮挡三日和周视图最左侧的日期。
- 浅色模式下时间轴任务勾选确认色改为黑色，对比度更佳。
- 今日候选标题和候选任务名加粗显示。
- 时间轴左右切换按钮改为整个左侧/右侧纵向区域均可触发，操作更便捷。
- 横屏模式左上角 NavoPath logo 去除外围描边并放大图标。
- Planning 区域改用纸面层级风格，背景与 Execute 模式统一，去除灰色割裂感。
- 桌面应用图标使用白色 N 表面、黑色立体阴影和透明外围，在浅色与深色系统界面中都保持清晰。
- 收起今日候选后，三日、周和月视图会统一进入简洁阅读模式。
- 周视图中 15 分钟长度的任务块标题现在清晰可读，去掉了多余的勾选与缩进，使短时长块也能在窄列里完整显示。

### 修复
- 修复时间轴全屏后仍受普通工作区高度约束、顶部留下大块空白的问题；全屏现在会铺满整个可用视口。
- "查看发布说明"现在稳定打开应用内更新日志，不再依赖临时或未标记的 GitHub 发布地址。
- 修复单日时间轴在当日未添加任何任务时，0:00 顶部与全天栏下方出现大段空白的问题；0:00 现在紧贴在全天栏下方。

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

## 2026-06-21 · 连续年度日历

### 新功能
- 点击工作区顶部的月份和年份可打开连续年度日历，并通过上一年、下一年、回到今天或任意日期直接导航。
- 官网与 Web 工作区设置新增最新版 Windows 安装包下载入口；桌面应用每 24 小时自动检查更新，也支持手动下载并重启安装。

### 改进
- 年度日历在横屏下保留今日候选任务，在竖屏下使用全宽月份画布并继续显示主屏的执行、规划与添加工具坞；当前月份、所选日期、今天和已有安排均有清晰标记。
- 年度日历会自动定位当前月份，切换年份或横竖屏方向时保持正在查看的月份，并继承当前页面的明暗主题与交互强调色。
- Windows 桌面应用现在使用与网页端相同的账户和云端工作区，登录同一账户即可同步任务、日程与设置。
- Windows 桌面应用现在始终直接进入 `/app` 工作区，不再在应用窗口中显示官网首页；窗口、可执行文件、安装器与快捷方式统一使用 NavoPath 名称和品牌图标。
- 竖屏时间轴任务改为短暂长按后才可拖动，并缩窄日期切换箭头的横向触控区域。
- Windows 安装包体积大幅缩小，下载与安装更快捷；自动更新、PDF、DOCX、图片 OCR 与 Supabase 同步等功能全部保留。

### 修复
- 修复竖屏快速添加中的归属项目列表被页头遮挡、任务标题输入框未适配深色模式，以及任务或事件详情缺少明确退出按钮的问题。

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
- 竖屏时间轴的日期严格居中，日期切换箭头移到 Day/Month 按钮左侧；时间块拖到左侧刻度区可直接放回今日候选。
- 竖屏头部与底部工具坞移除可见控件边框，Navo 图标更靠左并略微放大，新增按钮使用更完整的圆形轮廓。
- 竖屏 Day 控件改为视图菜单，可直接选择天、3 天、周和月；时间轴增加底部滚动安全空间，23:00 后的落点不再被工具坞遮挡。

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
- Fixed the runtime fallback flag being persisted to localStorage, which permanently trapped the app in preview mode; the fallback now lasts only for the current session, the next launch retries the cloud backend, and stale persisted flags from earlier builds are cleaned up.
- Fixed deleted candidate task cards on the Execute page reappearing after deletion; all deletion paths now read from `dataRef.current` to eliminate stale-closure races.
- Fixed tasks reappearing after being deleted from the task detail drawer.
- Fixed the original task reappearing after being converted to an event.
- Fixed the app getting stuck on the loading screen when the cloud database query fails; it now automatically falls back to local preview mode so the workspace remains usable.
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
- Fixed the quick-add panel staying open and persisting after saving a task; it now closes automatically while remembering the last selected project.
- Fixed timeline misalignment when rapidly clicking the add button after changing the day start time.
- Fixed deleted sub-pages on the Planning page temporarily disappearing then reappearing, preventing successful deletion.
- Fixed button and icon layout misalignment on the Planning page after adding a large number of subtasks.
- Fixed the clicked day jumping to the leftmost column in 3-day and week views after quick-adding a task; the view now stays put when the target date is already visible.
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
