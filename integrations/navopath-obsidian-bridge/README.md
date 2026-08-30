# NavoPath Obsidian Bridge

This plugin watches the vault-relative folder `升学/资料` and sends only incremental file metadata and bounded scheduling-relevant excerpts to the NavoPath workspace-event API.

## Privacy and behavior

- The first startup creates a local hash baseline and uploads no document content.
- Later create, modify, rename, and delete events are debounced and deduplicated.
- Plaintext excerpts prioritize frontmatter, dates, deadlines, unchecked tasks, tests, interviews, and submission-related lines. Binary files upload metadata and a local content hash only.
- The NavoPath device token is selected through Obsidian SecretStorage. The plugin `data.json` contains only the secret name, never the token value.
- On Windows desktop, an administrator can provision a token once through `%LOCALAPPDATA%\NavoPath\navopath-obsidian-bridge.token`. The plugin validates it, imports it into SecretStorage, and deletes the bootstrap file immediately; the file must be restricted to the current Windows user before Obsidian starts.
- Failed uploads do not advance the manifest, so changes are retried on the next flush or startup.
- The plugin makes no file modifications and includes no telemetry.

## Installation

Build with `npm install && npm run build`, then copy `main.js`, `manifest.json`, and `versions.json` into `.obsidian/plugins/navopath-bridge/`. Enable **NavoPath Bridge** under Community plugins, open its settings, and create or select a SecretStorage entry containing a device-specific `nvp_...` token.
