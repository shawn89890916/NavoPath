# NavoPath 云端主动日程助理

## 运行架构

主动助理运行在现有 `navopath-mcp` Cloudflare Worker 中，不依赖用户电脑：

- Cloudflare Cron 在 `00:30 UTC` 和 `12:30 UTC` 触发，对应 `Asia/Shanghai` 的 `08:30` 和 `20:30`。
- Cron 只为已启用的账户写入 Cloudflare Queue；Queue consumer 负责天气、工作区读取、DeepSeek 决策、写入、通知与失败重试。
- 工作区事件通过 HTTPS API 入库后延迟 45 秒入队。消费者一次认领同一用户所有已经稳定 30 秒的事件，从而合并编辑器一次保存产生的多条事件。
- Supabase 保存启用状态、用户偏好、事件游标、最后快照、上次扫描摘要、Agent job、通知和 change set。模型不承担记忆职责。
- 每个定时 job 使用 `schedule:<morning|evening>:<date>`；每个事件 job 使用事件 ID 集合的 SHA-256 作为幂等键。重复队列消息不会再次调用模型。

## iCloud Drive 边界

Apple 提供的 CloudKit Web Services 面向应用自己的 CloudKit container；私有数据库也属于该应用 container 和当前已认证用户。它不是一个让第三方服务器长期遍历用户任意 iCloud Drive 目录的通用文件 API。相关边界见 Apple 的 [CloudKit container](https://developer.apple.com/documentation/cloudkit/ckcontainer)、[CKDatabase](https://developer.apple.com/documentation/cloudkit/ckdatabase) 与 [CloudKit Web Services](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html) 文档。

因此 NavoPath 不保存 Apple ID、iCloud cookie 或短期 Web Auth Token，也不尝试从服务器抓取逻辑目录 `升学/资料`。推荐路径是：iCloud Drive 继续在受信任的本地设备同步；本地 Agent 或其他已授权 Agent 完成工作后，只把变化清单、摘要、日程影响和必要片段发送到 workspace event API。云端在电脑离线时使用最后一次增量快照继续规划。

## Workspace event API

Endpoint：

```text
POST https://navopath-mcp.shawn89890916.workers.dev/api/workspace-events
```

认证与防重放：

- `Authorization: Bearer nvp_...`
- `X-NavoPath-Timestamp: <Unix seconds>`
- `X-NavoPath-Signature: sha256=<hex HMAC-SHA256>`
- 签名原文为 `<timestamp>.<raw request body>`，密钥为该设备的完整 `nvp_...` 令牌。
- 服务器只接受前后 5 分钟内的签名。令牌仍按账户隔离，可在 NavoPath 中单独撤销。

Body：

```json
{
  "changed_files": [
    {
      "path": "升学/资料/ESAT/本周计划.md",
      "change_type": "modified",
      "content_hash": "sha256:..."
    }
  ],
  "fragments": [
    {
      "path": "升学/资料/ESAT/本周计划.md",
      "excerpt": "只放完成判断或排程所需的变化片段",
      "content_hash": "sha256:..."
    }
  ],
  "summary": "完成了力学错题整理，新增两组限时练习。",
  "schedule_impact": "本周需要新增两次 45 分钟练习。",
  "timestamp": "2026-08-28T08:40:00+08:00",
  "dedupe_key": "agent-run-20260828-esat-001"
}
```

约束：最多 100 个变化文件、20 个片段、每段 4000 字符、片段 JSON 总量 24 KB、整个请求 64 KB。相同账户的相同 `dedupe_key` 永远只产生一个有效事件；重复请求返回原事件且不再次入队。

仓库内的 `scripts/navopath-workspace-event.mjs` 可直接签名并发送一个 JSON payload：

```powershell
$env:NAVOPATH_MCP_TOKEN = "nvp_YOUR_DEVICE_TOKEN"
node scripts/navopath-workspace-event.mjs .\workspace-event.json
```

令牌只放在环境变量中，不要写入 iCloud Drive、payload、日志或 Git。

## Obsidian Bridge

仓库内的 `integrations/navopath-obsidian-bridge` 可在桌面端和移动端 Obsidian 中监听 Vault 相对目录 `升学/资料`。它使用 Obsidian Vault 事件接收新建、修改、重命名和删除，连续保存默认合并 45 秒，并在插件重新启动时通过本地哈希清单补发离线期间遗漏的变化。

隐私边界：

- 首次启动只为现有文件建立哈希基线，不上传当前资料。
- Markdown、文本、CSV、YAML、HTML 和 Python 文件只提取 frontmatter、日期、截止、未完成清单、考试、面试和提交相关行；图片等二进制文件只上传路径、变更类型与本地哈希。
- 上传成功后才推进基线；网络或鉴权失败会保留变化并自动重试。
- 设备令牌通过 Obsidian SecretStorage 选择。插件同步数据只保存 SecretStorage 名称和文件哈希，不保存 `nvp_...` 令牌或资料正文。
- 插件使用 Vault 内相对路径，不写死 Windows `C:\` 路径，因此同一个 iCloud Vault 可在 Windows、macOS、iPhone、iPad 和 Android 上安装。移动设备只有在 Obsidian 运行时才能发送；下次打开时会补扫 iCloud 已同步的变化。

构建并安装：

```powershell
cd integrations/navopath-obsidian-bridge
npm install
npm test
npm run typecheck
npm run build
```

将 `main.js`、`manifest.json` 和 `versions.json` 复制到 Vault 的 `.obsidian/plugins/navopath-bridge/`，在社区插件中启用，然后到插件设置中创建或选择一个仅供该设备使用的 NavoPath MCP 令牌。

## DeepSeek 决策边界

- 默认模型固定为 `deepseek-ai/DeepSeek-V4-Flash`。Worker 通过仅 Service Role 可访问的内部模式复用现有 Supabase AI Edge Function 与其 SiliconFlow 凭据，不复制第二份模型密钥。
- 模型只能调用一个带严格 JSON Schema 的 `batch_update_tasks` function。即使模型返回工具参数，Worker 仍会重新做类型、长度、ID、日期、时长、冲突、锁定和硬截止校验。
- 模型上下文不含整份资料。它只得到未完成任务的必要元数据、今明两天时间块、温州天气、持久状态摘要，以及事件上传的有限片段。
- 普通任务可创建、拆分、更新和重排；删除不在模型工具白名单。锁定日程和硬截止移动会落为 `pending_confirmation`，不会写入 profile。
- 写入通过 profile revision 原子提交。每个 change set 保存原因、前后值、逆操作、幂等键和 24 小时撤销窗口。

## MCP/API 能力

- `get_changes_since(cursor)`
- `reschedule_task(taskId, startTime, durationMinutes, date, idempotency_key)`
- `upsert_schedule_block`
- `batch_update_tasks(operations, dry_run, commit, idempotency_key)`
- `get_activity_history`
- `confirm_change(changeSetId)`
- `undo_change(changeSetId)`
- `ingest_workspace_event`
- `send_notification`
- `configure_cloud_assistant(enabled, email_enabled)`

应用内通知可从 `GET /api/notifications` 读取；该接口使用同一个 Bearer Token，并只返回当前账户已到投递时间的通知。开启邮件后，Worker 可通过 Resend 同时发送邮件。19:00 后的普通通知延迟到次日 08:30；只有紧急截止风险可以立即打扰。

## 部署

先应用 Supabase migrations，然后创建 Queue 并配置 Worker secrets：

```powershell
npx wrangler queues create navopath-cloud-assistant --config mcp-worker/wrangler.jsonc
npx wrangler queues create navopath-cloud-assistant-dead --config mcp-worker/wrangler.jsonc
npx wrangler secret put SUPABASE_URL --config mcp-worker/wrangler.jsonc
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config mcp-worker/wrangler.jsonc
```

可选邮件：

```powershell
npx wrangler secret put RESEND_API_KEY --config mcp-worker/wrangler.jsonc
npx wrangler secret put RESEND_FROM --config mcp-worker/wrangler.jsonc
```

最后部署：

```powershell
npm ci --prefix mcp-worker
npm test --prefix mcp-worker
npm run typecheck --prefix mcp-worker
npm run deploy --prefix mcp-worker
```

Cron Triggers 使用 UTC，配置中的 `30 0 * * *` 与 `30 12 * * *` 分别对应上海 08:30 与 20:30。Cloudflare 的运行方式见 [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) 和 [Worker handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/)。
