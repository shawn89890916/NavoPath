# Global Agent and external calendars

## Deployment

1. Apply `supabase/migrations/20260820090000_global_agent_and_external_calendars.sql`.
2. Deploy both Edge Functions:

   ```powershell
   supabase functions deploy ai-assistant
   supabase functions deploy external-calendar
   ```

3. Keep the existing AI provider secret and configure a dedicated calendar-encryption secret of at least 32 random characters:

   ```powershell
   supabase secrets set ICS_ENCRYPTION_KEY=<random-secret>
   ```

The Edge Functions also require the standard Supabase URL, publishable/anonymous key, and secret/service-role key. Service-role and encryption secrets must never enter Vite variables or the renderer.

The main-branch GitHub Actions workflow now applies pending migrations, keeps the stable encryption secret configured, and deploys both Edge Functions before Cloudflare Pages. Configure repository secrets named `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `ICS_ENCRYPTION_KEY`; rotating the encryption key after calendars have been connected makes their stored URLs unreadable.

## Security model

- The global Agent is cloud-account only. It resolves the bearer JWT and reads the user's profile through RLS; client workspace snapshots are not authority.
- Deterministic policy code classifies commands. Queries and small reversible changes can run automatically; deletion, archival, settings, recurrence, integrations, and bulk changes require confirmation.
- Model and safety selection live in the AI composer’s lower-left `+` menu. The safety preference is read from the authenticated profile: `standard` keeps the deterministic policy, `strict` promotes low-risk workspace writes to confirmation, and `readonly` blocks workspace writes and timer controls. These levels can only tighten policy and never turn a confirmation-only or forbidden command into an automatic one.
- Profile writes and audit updates share one revision-checked database transaction. Undo is available for 24 hours and fails after a later profile revision.
- Audit rows retain only tool names and command metadata and are pruned after 30 days during Agent use. Successful, rejected, and failed runs appear in the AI drawer; they do not store credentials, raw prompts, attachments, or ICS URLs.
- The Agent can read bounded local timer state and redacted metadata for connected calendars. Enabling or disabling an existing source is confirmation-only and reversible; URL, credential, creation, removal, and arbitrary-fetch operations remain unavailable to the model.
- ICS sources accept only HTTPS on port 443. Every redirect is revalidated, DNS results are rejected if private/link-local, responses time out after 10 seconds, and bodies are capped at 5 MB.
- ICS URLs are encrypted with AES-GCM and only a redacted hostname is returned to the app. Occurrences remain read-only busy blocks and are never written back.

## Runtime behavior

External calendars sync when connected, when the app starts, before proactive briefs, and every 15 minutes while the app is active. The first release intentionally has no background cron or push sync.

Start and end briefs default to `08:00` and `21:30`, are disabled for existing accounts, and run at most once per type per local day after the user opts in. Briefs are read-only; any follow-up action goes through the normal Agent policy.

For an explicit production verification with temporary users, provide the three runtime variables and run `npm run test:cloud-agent`. The script creates two isolated accounts, checks RLS and unauthenticated rejection, verifies calendar SSRF blocking, confirms and undoes an integration update, proves revision conflicts do not partially write, and removes the temporary accounts in a `finally` block.
