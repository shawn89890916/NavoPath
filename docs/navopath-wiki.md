# NavoPath Wiki

This page explains how NavoPath works at a practical level: what each workspace is for, how tasks move through the system, and what to expect in local versus cloud-backed mode.

## What NavoPath Is

NavoPath is a planning tool designed to bridge long-range project thinking with day-level execution.

Instead of treating planning and scheduling as separate tools, NavoPath keeps them in one flow:

- break projects into actionable tasks
- choose what should move forward now
- place those tasks onto a real timeline

## The Main Model

NavoPath revolves around two workspaces:

- `Planning`: organize projects, tasks, and subtasks in a tree
- `Execute`: schedule selected work on a timeline and run the day

The core idea is simple: not every planned task belongs in today's schedule. Planning stays broad; execution stays selective.

## Typical Workflow

### 1. Build project structure in `Planning`

Start by creating projects and breaking them down into tasks and subtasks.

Use this area to:

- capture long-term goals
- decompose large work into smaller steps
- keep related tasks grouped by project

### 2. Pick tasks for action

Once the plan is clear, choose the tasks that should move into active execution.

This step is important because NavoPath is not trying to show your entire backlog on the daily timeline. It helps you narrow down the work that matters now.

### 3. Move into `Execute`

In the `Execute` workspace, selected tasks can be scheduled onto the timeline.

Use this area to:

- assign tasks to today's work
- place them into time blocks
- visually adjust the day when priorities or durations change

### 4. Refine with AI assistance

NavoPath includes AI-assisted planning features that can help generate or refine a daily plan based on the tasks already present in the system.

AI is an assistive layer, not the primary source of truth. The underlying plan and task structure still come from your projects and selections.

## Key Concepts

### Projects

Projects are the top-level containers for organized work. They represent broader goals, initiatives, or areas of responsibility.

### Tasks and subtasks

Tasks can represent concrete work items. Subtasks allow further decomposition when a task is still too large or vague to execute directly.

### Planning picks

Planning picks are the bridge between the tree and the timeline. They represent the tasks you intentionally move from general planning into active consideration.

### Timeline execution

The timeline is where work becomes time-bound. This is the operational layer of the app: what happens today, when it happens, and how the day is shaped in practice.

## Runtime Modes

NavoPath currently supports two main runtime patterns.

### Local preview mode

In local preview mode:

- no Supabase environment variables are required
- data stays in browser storage
- the app is useful for development, demos, and local-only usage

This is the fastest way to run the app if you just want to explore the workflow.

### Public web mode

In public web mode:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required
- users can sign up and sign in
- planner data is stored in Supabase

This mode is intended for persistent usage across sessions and devices.

## Desktop and Web

NavoPath is built as both:

- a web app powered by React + Vite
- a desktop app packaged with Electron

The core product model is shared across both. The main difference is how the app is delivered and how data is stored/configured.

## Related Files

If you are trying to understand or extend the project, these files are the best starting points:

- `README.md`: product-level overview and setup
- `docs/dayflow-web-deploy.md`: deployment notes for Cloudflare Pages and Supabase
- `src/main.tsx`: main application shell and workspace orchestration
- `src/PlanningView.tsx`: planning tree UI
- `src/autoSchedule.ts`: deterministic scheduling logic
- `src/supabasePlannerApi.ts`: cloud-backed planner API integration

## When To Read This Page

This wiki page is most useful when you need one of these:

- a quick conceptual introduction before reading the code
- a plain-language explanation of how `Planning` and `Execute` fit together
- a short orientation doc for contributors, testers, or early users
