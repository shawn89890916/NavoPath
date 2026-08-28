[README.md](https://github.com/user-attachments/files/28858357/README.md)
# NavoPath

NavoPath is a planning tool for turning long-term goals into concrete daily action.

It combines tree-based project planning with timeline-based execution, so you can break large projects into smaller tasks, decide what matters today, and place that work onto a realistic schedule.

## Core Workflow

### 1. Plan in trees

Use the `Planning` workspace to organize projects, break goals into tasks, and build a clear structure before you start scheduling.

### 2. Choose what moves today forward

Pick the tasks worth advancing now instead of carrying your entire backlog into the day.

### 3. Execute on a timeline

Use the `Execute` workspace to place work on a daily timeline, adjust timing visually, and keep the day grounded in actual time.

### 4. Get AI help when needed

NavoPath includes AI-assisted daily planning to help suggest schedules based on the tasks you already selected and organized.

## Key Features

- Tree-based planning for long-term projects and multi-step goals
- Timeline-based execution for scheduling a realistic day
- AI-assisted daily planning
- Always-online cloud scheduling at 08:30 and 20:30 Asia/Shanghai, plus signed incremental workspace events
- Optional cloud sync with Supabase for the public web app
- Local preview mode for offline or single-browser use
- Desktop packaging with Electron

## Runtime Modes

NavoPath currently supports two main runtime modes:

### Local preview mode

- No cloud environment variables required
- Data stays in browser storage for local use
- Best for development, quick demos, or private single-device usage

### Public web mode

- Requires Supabase environment variables
- Users can sign up and sign in
- Planner data is stored in Supabase and available across sessions/devices

## Tech Stack

- React 19
- TypeScript
- Vite
- Electron
- Supabase
- Cloudflare Pages

## Local Development

Install dependencies:

```powershell
npm install
```

Start the development app:

```powershell
npm run dev
```

This starts the Vite dev server and launches the Electron app against it.

## Web Build

Create a production web build:

```powershell
npm run build
```

The build output is written to:

```text
dist
```

Check the production asset size budget:

```powershell
npm run size
```

To check the existing `dist` output without rebuilding:

```powershell
npm run size:check
```

## Desktop Packaging

Build the desktop app and package the Windows portable executable:

```powershell
npm run dist
```

The packaged output is written to:

```text
release
```

## Environment Variables

Set these variables only when you want the public web app with Supabase-backed accounts and sync:

```text
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

Without these variables, NavoPath runs in local preview mode.

## Web Deployment

NavoPath can be deployed as a Cloudflare Pages project.

Cloudflare Pages build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20` or newer

Supabase setup:

1. Create a Supabase project.
2. Open the SQL Editor and run `supabase/schema.sql`.
3. Enable email signups in Supabase Authentication.
4. Copy the project URL and anon public key into the environment variables above.

For more deployment detail, see [`docs/dayflow-web-deploy.md`](./docs/dayflow-web-deploy.md).

The cloud worker, incremental workspace event API, DeepSeek safety boundary, notifications, and deployment steps are documented in [`docs/cloud-proactive-assistant.md`](./docs/cloud-proactive-assistant.md).

## Project Structure

```text
src/        React application code
electron/   Electron main and preload processes
public/     Static assets
supabase/   Database schema and related setup
docs/       Deployment notes
```

## Status

NavoPath is an actively evolving project focused on bridging long-range planning and day-level execution in a single workflow.
