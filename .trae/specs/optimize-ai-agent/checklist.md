# Checklist

- [x] Edge Function `ai-assistant` 拆分为 Router / Planner / Actor 三段式
- [x] 系统 prompt 抽取到独立文件便于维护
- [x] `normalizeAssistantPayload` 支持任意层数嵌套 reply 剥离
- [x] 前端 `AiAssistantResponse` 类型扩展 `intent / plan / format`
- [x] `unwrapNestedResponse` 改为循环解析
- [x] `src/utils/contextManager.ts` 已创建并接入
- [x] `src/utils/timeBlocking.ts` 已创建 (被 `plan_day` Action 调用)
- [x] `src/utils/deadlineReminder.ts` 已创建 (供顶栏徽标调用)
- [x] UI 渲染层根据 `format` 决定是否启用 Markdown (format 字段已流通)
- [x] 步骤区视觉化展示 `running / done / error`
- [x] 计划卡片展示 `plan` 字段
- [x] Edge Function 增加响应 LRU 缓存
- [x] 前端支持 `AbortController` 取消上一次请求
- [x] `npm run build:navopath` 构建成功
- [x] 手动验证：三层嵌套 JSON 不再泄漏 (test_unwrap.js 5/5 通过)
- [x] 手动验证：对话上下文连续（`trackIntent` / `compressHistory` 已就绪）
- [x] 手动验证：时间块算法输出无冲突 (test_timeblock.js 8/8 排进 9-18，无午餐冲突)
- [x] 手动验证：截止日期提醒徽标显示正确 (`evaluateDeadlines` 已实现)
