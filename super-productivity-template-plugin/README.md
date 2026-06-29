# Template Mode for Super Productivity

This plugin adds a NavoPath-style template workflow to Super Productivity.

## Features

- Create reusable templates.
- Add or remove periods.
- Select only the periods you want to add today.
- Save templates with Super Productivity synced plugin data.
- Apply selected periods as Super Productivity tasks.

## Current API limitation

Super Productivity's public plugin API can create tasks with title, notes, due day, estimate, project, and tags. It does not currently expose a stable public method for placing tasks into the planner with exact start and end times.

For that reason, this plugin stores the period time range in the created task notes and sets the task estimate from the period duration.

## Install

1. Zip `manifest.json`, `index.html`, and `README.md`.
2. In Super Productivity, open plugin settings.
3. Import the zip file.
4. Open `Template Mode` from the plugin menu or side panel.
