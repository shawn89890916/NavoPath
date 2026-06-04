# NavoPath Web Deploy

NavoPath can run in two modes:

- Local preview: no cloud env vars, data stays in browser localStorage.
- Public web app: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, users sign up and their planner data is stored in Supabase.

## Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication settings, configure email signups.
4. Copy the project URL and anon public key.

## Cloudflare Pages

Use these build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 or newer

Set these Cloudflare Pages environment variables:

```text
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

## Personal Site Link

Your current site is `https://xiaoyang-chen-website.pages.dev`.

The quickest public launch path is to deploy NavoPath as a separate Cloudflare Pages project, then add a link from your personal site to that NavoPath URL. A later step can move it to a custom subdomain such as `navopath.xiaoyang-chen.com` if the domain is available in Cloudflare.
