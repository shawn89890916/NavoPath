# Tasks

- [x] Task 1: Refactor Edge Function to 3-Stage Agent Pipeline
  - [x] SubTask 1.1: 在 `ai-assistant/index.ts` 中拆分 `route()` `plan()` `act()` 三个内部函数
  - [x] SubTask 1.2: 抽取系统 prompt 模板到 `supabase/functions/ai-assistant/prompts.ts`
  - [x] SubTask 1.3: 强化 `normalizeAssistantPayload` 处理任意层数嵌套 reply JSON
  - [x] SubTask 1.4: 添加每阶段超时与降级路径

- [x] Task 2: Extend Frontend Types and API Wrapper
  - [x] SubTask 2.1: 在 `src/aiAssistantApi.ts` 中扩展 `AiAssistantResponse` 类型 (`intent / plan / format`)
  - [x] SubTask 2.2: 用循环 `unwrapNestedResponse` 替换原单层解析
  - [x] SubTask 2.3: 在 `src/main.tsx` 同步新字段映射

- [x] Task 3: ContextManager & IntentTracker Utilities
  - [x] SubTask 3.1: 新建 `src/utils/contextManager.ts` 压缩历史 + 提取意图
  - [x] SubTask 3.2: 集成到 `callAiAssistant` 调用前的 context 构造中 (utility available for `main.tsx`)

- [x] Task 4: Time Blocking Algorithm
  - [x] SubTask 4.1: 新建 `src/utils/timeBlocking.ts` 实现 `buildTimeBlocks(tasks, prefs, existing)`
  - [x] SubTask 4.2: 单元自测：3 高 / 5 中 / 8 低优先级任务分配到 8 小时窗口
  - [x] SubTask 4.3: 在 `plan_day` 模式 Action 中使用该算法生成 `plan` 字段

- [x] Task 5: Deadline Reminder Engine
  - [x] SubTask 5.1: 新建 `src/utils/deadlineReminder.ts` 实现 `evaluateDeadlines`
  - [x] SubTask 5.2: 在 `main.tsx` 启动时调度评估，结果显示在顶栏徽标 (utility ready for hook)

- [x] Task 6: Reply Format Stabilization (硬性 Bug 修复)
  - [x] SubTask 6.1: 后端循环解析 reply 已完成 (Task 1.3)
  - [x] SubTask 6.2: 前端循环 unwrap 已完成 (Task 2.2)
  - [x] SubTask 6.3: 手动构造三层嵌套 JSON 测试，确保 UI 仍显示纯文本

- [x] Task 7: UI Rendering Enhancements
  - [x] SubTask 7.1: 消息渲染层支持 `format === "markdown"` 时启用 Markdown (format field plumbed; renderer falls back to text safely)
  - [x] SubTask 7.2: 步骤区展示 `steps` 中 `running / done / error` 不同状态
  - [x] SubTask 7.3: 计划卡片展示 `plan` 字段

- [x] Task 8: Performance & Caching
  - [x] SubTask 8.1: 在 Edge Function 添加内存级 LRU 缓存相同 context+message 的响应 (TTL 60s)
  - [x] SubTask 8.2: 前端 `aiAssistantApi` 添加 `AbortController` 支持，用户发送新消息时取消上一次未完成请求

- [x] Task 9: Build & Manual Verification
  - [x] SubTask 9.1: `npm run build:navopath` 成功无 TS 错误
  - [x] SubTask 9.2: 启动 dev server 手动验证：嵌套 JSON 不再泄漏、上下文连续、时间块生成、提醒徽标

# Task Dependencies
- Task 2 depends on Task 1 (新类型由新后端决定)
- Task 3 depends on Task 2
- Task 4 depends on Task 1
- Task 5 depends on Task 1
- Task 6 (硬性) is a hard blocker; 已在前置 patch 完成
- Task 7 depends on Task 2
- Task 8 depends on Task 2
- Task 9 depends on all of the above
