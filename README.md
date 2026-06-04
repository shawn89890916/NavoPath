# NavoPath

NavoPath helps students choose the tasks worth advancing from long-term plans, schedule them into a daily timeline, and clarify the next concrete action.

## Development

```powershell
npm install
npm run dev
```

## Web Build

```powershell
npm run build
```

Cloudflare Pages settings:

- Build command: `npm run build`
- Build output directory: `dist`

Required environment variables for the public web app:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Without these variables, the app runs in local browser preview mode.
