# NavoPath MCP 配置说明

NavoPath 通过 Streamable HTTP 提供远程 MCP 服务。连接后，支持 MCP 的客户端可以读取项目、任务、日程块与安全设置，并在授权范围内创建、更新或删除数据。

> 每台电脑使用一个独立令牌。按设备命名后，可以在设备遗失、停用或令牌泄露时单独撤销。

## 三步连接

1. 在新电脑打开 NavoPath，登录保存规划数据的云端账户。
2. 前往 **设置 → 高级 → 日历与集成 → MCP**，用设备名称生成令牌，并立即保存完整的 `nvp_...` 内容。原始令牌只显示一次。
3. 选择下方客户端完成配置，彻底退出客户端后重新打开，再让它“列出我的 NavoPath 项目”。

连接资料：

| 项目 | 内容 |
| --- | --- |
| 服务地址 | `https://navopath-mcp.shawn89890916.workers.dev/mcp` |
| 传输方式 | Streamable HTTP |
| 认证请求头 | `Authorization: Bearer nvp_...` |

## Codex

Codex 桌面端、CLI 与 IDE 扩展共享本机的 `config.toml`。令牌保存在系统环境变量中，配置文件可以安全地在自己的设备间复制。

### 1. 写入配置

把下面内容加入 `~/.codex/config.toml`。Windows 的完整位置为 `$HOME\.codex\config.toml`。

```toml
[mcp_servers.navopath]
url = "https://navopath-mcp.shawn89890916.workers.dev/mcp"
bearer_token_env_var = "NAVOPATH_MCP_TOKEN"
```

### 2. 保存设备令牌

Windows PowerShell：

```powershell
[Environment]::SetEnvironmentVariable("NAVOPATH_MCP_TOKEN", "nvp_YOUR_TOKEN", "User")
```

macOS（zsh）：

```bash
echo 'export NAVOPATH_MCP_TOKEN="nvp_YOUR_TOKEN"' >> ~/.zshrc
```

Linux（bash）：

```bash
echo 'export NAVOPATH_MCP_TOKEN="nvp_YOUR_TOKEN"' >> ~/.bashrc
```

使用其他 shell 时，把同一条 `export` 写入相应的配置文件。

### 3. 重启并验证

彻底退出 Codex 后重新打开。进入 MCP 列表确认 `navopath` 已连接，或直接输入：

```text
列出我的 NavoPath 项目
```

## Claude Desktop

Claude Desktop 可通过 `mcp-remote` 连接带 Bearer Token 的远程服务。先安装 Node.js，并启动一次 Claude Desktop，让应用创建配置目录。

配置文件位置：

- Windows：`%APPDATA%\Claude\claude_desktop_config.json`
- macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows

把 `nvp_YOUR_TOKEN` 换成这台电脑的令牌：

```json
{
  "mcpServers": {
    "navopath": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "mcp-remote",
        "https://navopath-mcp.shawn89890916.workers.dev/mcp",
        "--header",
        "Authorization: Bearer nvp_YOUR_TOKEN"
      ]
    }
  }
}
```

### macOS 或 Linux

```json
{
  "mcpServers": {
    "navopath": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://navopath-mcp.shawn89890916.workers.dev/mcp",
        "--header",
        "Authorization: Bearer nvp_YOUR_TOKEN"
      ]
    }
  }
}
```

保存后彻底退出 Claude Desktop，再重新打开。在聊天输入框旁的连接器列表中确认 NavoPath 已出现。

## 换到另一台电脑

在新电脑依次完成：

1. 登录同一个 NavoPath 云端账户。
2. 生成以设备名称标记的新令牌，例如 `Office-PC`、`Home-Mac`。
3. 保存令牌并写入客户端配置。
4. 重启客户端。
5. 让客户端列出 NavoPath 项目，确认连接成功。

保留每台设备的独立令牌。令牌请避开聊天、截图、网盘共享目录和 Git 仓库。令牌泄露后，立即在 NavoPath 的 MCP 设置中撤销并重新生成。

## MCP Inspector

```powershell
npx @modelcontextprotocol/inspector@latest
```

选择 **Streamable HTTP**，输入服务地址，然后加入 `Authorization: Bearer nvp_YOUR_TOKEN` 请求头。

## 可用工具

- `get_workspace_summary`
- `list_projects`
- `list_tasks`
- `list_calendar`
- `get_settings`
- `update_settings`
- `create_project`
- `create_task`
- `update_task`
- `delete_task`

写入操作遵循网页端相同的 profile revision 约束。遇到 `PROFILE_REVISION_CONFLICT` 时，重新读取相关数据，再重试当前写入。

## 快速排错

| 现象 | 处理方式 |
| --- | --- |
| `401 Invalid or revoked bearer token` | 重新生成设备令牌，并更新完整的 `nvp_...` 内容。 |
| `Workspace not found` | 先在 NavoPath 登录同一云端账户，等待工作区加载完成。 |
| 客户端没有显示 NavoPath | 检查服务地址末尾的 `/mcp`，保存配置后彻底退出客户端并重新打开。 |
| `PROFILE_REVISION_CONFLICT` | 重新读取受影响的数据，再重试当前写入。 |
| Claude Desktop 启动失败 | 确认 Node.js 与 `npx` 可用；Windows 配置需要 `command: cmd` 和首个参数 `/c`。 |
| 工具参数错误 | 日期使用 `YYYY-MM-DD`，时间使用 24 小时制 `HH:mm`。 |

## 部署维护

以下步骤供 NavoPath 服务维护者使用。普通设备连接无需重新部署 Worker。

```powershell
cd mcp-worker
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

部署前先应用 Supabase migrations。Service Role Key 只存入 Worker secrets，请勿加入客户端构建或提交到 Git。
