# NavoPath AI Agent 优化 Spec

## Why
NavoPath 当前的 AI 助手基于 DeepSeek 单次请求模式，存在上下文丢失、回复格式不稳定（嵌套 JSON 泄漏到 UI）、任务优先级与时间块规划较弱等问题。参考 TrevorAI 的轻量化 Web Agent 架构，重新设计 AI 调用链、上下文管理、任务排程与提醒子系统，使其更轻量、更智能、更加贴合用户工作流。

## What Changes
- **BREAKING** 重建后端 Edge Function `ai-assistant`：拆分为 Router → Planner → Actor 三段式轻量 Agent 流水线
- **BREAKING** 统一 AI 响应 schema (`reply / steps / actions / memories / plan / intent`)，前端 `AiAssistantResponse` 类型同步扩展
- 新增对话上下文压缩与意图追踪模块（ContextManager / IntentTracker）
- 新增基于优先级 + 番茄工作法的时间块（time-blocking）算法
- 新增截止日期提醒（deadline reminder）评估器
- 前端重构 AI 消息渲染层：支持 Markdown 渲染、tool-call 步骤展示、计划卡片
- 强化回复格式化：彻底解决嵌套 JSON 泄漏问题
- 性能优化：流式响应、增量上下文、缓存热点 prompt
- 保持现有产品工作流与行为，新增功能全部以可配置项形式提供

## Impact
- Affected specs: AI 对话、计划生成、任务调度、提醒系统
- Affected code:
  - `supabase/edges/ai-assistant/index.ts` — Agent 流水线
  - `src/aiAssistantApi.ts` — 前端 API 包装
  - `src/main.tsx` — 聊天面板与消息渲染
  - `src/types.ts` / `src/types.d.ts` — 类型定义
  - `src/utils/timeBlocking.ts` (新增) — 时间块算法
  - `src/utils/deadlineReminder.ts` (新增) — 提醒评估

## ADDED Requirements

### Requirement: Lightweight Web Agent Architecture
The system SHALL refactor `ai-assistant` Edge Function into a three-stage Agent pipeline: **Router** (意图分类) → **Planner** (生成结构化计划) → **Actor** (执行 actions)，每阶段独立可观测、可降级。

#### Scenario: Routing
- **WHEN** 用户发送消息
- **THEN** Router 阶段输出 `{ intent, requiresPlanning, requiresActions }` 标记，决定后续阶段是否激活

#### Scenario: Graceful degradation
- **WHEN** Planner 阶段失败或超时
- **THEN** 系统回退到直接 chat 模式并返回 `reply` 字段，不阻塞 UI

### Requirement: Comprehensive Context Management
The system SHALL maintain conversation continuity by: (1) 自动压缩超过阈值的对话历史；(2) 跨会话追踪用户意图 (focus task / current goal)；(3) 注入最少必要的全局上下文（today 任务、未来 7 天事件、最近 3 条记忆）。

#### Scenario: Long conversation
- **WHEN** 对话历史超过 12 轮
- **THEN** 系统自动调用 summarize 模式压缩为 1 条 memory，注入后续请求

#### Scenario: Pronoun resolution
- **WHEN** 用户说"刚才那个任务"或"继续"
- **THEN** IntentTracker 解析为最近 5 分钟内最近一次被引用的 taskId 并附加到 context

### Requirement: Reply Format Stabilization
The system SHALL guarantee `reply` 字段始终为人类可读的中文纯文本，绝不泄漏 JSON / 步骤 / actions。`steps` 与 `actions` 独立字段，分别用于步骤展示与可执行操作。

#### Scenario: Nested JSON
- **WHEN** 模型返回 `reply` 字段中仍包含 JSON 字符串
- **THEN** 后端循环解析剥离至最深层的纯文本 `reply`，同时保留外层的 `steps` / `actions`

### Requirement: Task Prioritization & Time Blocking
The system SHALL provide基于优先级（high/medium/low）+ 截止日期紧迫度 + 用户偏好的智能时间块算法 `buildTimeBlocks(tasks, prefs, existingSchedule)`。

#### Scenario: Auto block
- **WHEN** 用户触发"规划今天"或 AI 自动调度
- **THEN** 返回 `[{ taskId, start, end, label }]`，冲突时返回 `conflicts` 字段供 UI 高亮

### Requirement: Deadline Reminder Engine
The system SHALL 提供 `evaluateDeadlines(tasks, now)` 评估器，返回 `{ overdue[], dueToday[], upcoming24h[], upcomingWeek[] }`。

#### Scenario: Reminder hook
- **WHEN** 用户打开应用或切换日期
- **THEN** 前端调用 `evaluateDeadlines` 并在顶栏展示提醒徽标 + 一键跳转到对应任务

## MODIFIED Requirements

### Requirement: AI Chat Reply Rendering
**Before**: `message.content` 直接显示纯文本或泄漏 JSON
**After**: `message.content` 始终是经过 normalize 的纯文本，UI 层可选地使用 Markdown 渲染（仅当 `message.format === "markdown"`）

### Requirement: AI Assistant Response Schema
**Before**: `{ reply, steps, actions, memories }`
**After**: `{ reply, steps, actions, memories, intent?, plan?, format? }`，`format` 默认 `"text"`，可选 `"markdown"`

### Requirement: Edge Function Error Handling
**Before**: 解析失败时回退到原始 content
**After**: 解析失败时仍返回 `{ reply: fallback, steps: [{ label: "解析响应", status: "error" }] }`，UI 显示提示

## REMOVED Requirements

### Requirement: Legacy nested-JSON reply path
**Reason**: 已被新的 `normalizeAssistantPayload` 循环解析取代，前端 `unwrapNestedResponse` 同步更新
**Migration**: 无需用户操作，部署即生效
