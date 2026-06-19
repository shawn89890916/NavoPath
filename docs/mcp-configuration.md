# NavoPath MCP configuration

NavoPath exposes a remote MCP server over Streamable HTTP. It can read and update projects, tasks, scheduled task blocks, and safe settings. Events are not exposed; fixed commitments are scheduled tasks.

## Deploy the Worker

```powershell
cd mcp-worker
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

Apply the Supabase migrations before deployment. The service-role key belongs only in Worker secrets and must never be added to a client build or committed to Git.

The endpoint is:

```text
https://navopath-mcp.<your-workers-subdomain>.workers.dev/mcp
```

## Create a personal token

1. Sign in to NavoPath.
2. Open **Settings > MCP**.
3. Give the token a device or client name and select **Generate**.
4. Store the returned `nvp_...` token immediately. Only its hash is stored and the raw token cannot be shown again.

Revoke unused or exposed tokens from the same settings section.

## Codex

Add the remote endpoint to your Codex MCP configuration and pass the token as a Bearer header:

```toml
[mcp_servers.navopath]
url = "https://navopath-mcp.<your-workers-subdomain>.workers.dev/mcp"
http_headers = { Authorization = "Bearer nvp_REPLACE_ME" }
```

Restart Codex after changing its MCP configuration.

## Claude Desktop

Use `mcp-remote` when the client does not support authenticated remote HTTP directly:

```json
{
  "mcpServers": {
    "navopath": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://navopath-mcp.<your-workers-subdomain>.workers.dev/mcp",
        "--header",
        "Authorization: Bearer nvp_REPLACE_ME"
      ]
    }
  }
}
```

## MCP Inspector

```powershell
npx @modelcontextprotocol/inspector@latest
```

Choose Streamable HTTP, enter the `/mcp` endpoint, and add `Authorization: Bearer nvp_REPLACE_ME`.

## Tools

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

Writes use the same profile revision contract as the web app. A concurrent update returns `PROFILE_REVISION_CONFLICT`; clients should read the affected data and retry instead of repeating a stale payload indefinitely.

## Troubleshooting

- `401 Invalid or revoked bearer token`: create a new token and verify the complete header value.
- `Workspace not found`: sign in to the web app once so its cloud profile exists.
- `PROFILE_REVISION_CONFLICT`: refresh the workspace and retry the specific mutation.
- Connection failure: confirm the Worker is deployed, `/mcp` is used, and the client supports Streamable HTTP.
- Tool schema error: inspect the reported field; dates use `YYYY-MM-DD` and times use 24-hour `HH:mm`.
