# NavoPath calendar subscription

NavoPath publishes a private, read-only iCalendar feed from the existing Cloudflare Worker. The feed contains scheduled timeline blocks, calendar events, and incomplete task deadlines that do not already have a timeline block.

## Deploy

1. Apply `supabase/migrations/20260719153000_calendar_feed_tokens.sql` to the linked Supabase project.
2. Deploy `mcp-worker` with its existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets.
3. Deploy the main web application. If it uses a non-default Worker URL, set `VITE_MCP_ENDPOINT` to the Worker `/mcp` endpoint before building.

The raw subscription token is generated in the browser. Supabase stores only its SHA-256 digest. Replacing the link revokes the previous active token for that user.

## Subscribe

1. Sign in to NavoPath.
2. Open **Settings → Advanced → Calendar & Integrations → Calendar**.
3. Select **Create subscription link**.
4. On iPhone, select **Subscribe in Calendar**. For another client, copy the HTTPS link and add it as an iCalendar or Webcal subscription.

Calendar subscriptions are read-only. Changes made in Apple Calendar or Notion Calendar do not update NavoPath, and calendar clients decide when to refresh remote feeds.
