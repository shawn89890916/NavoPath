import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

const payloadPath = process.argv[2];
const token = process.env.NAVOPATH_MCP_TOKEN || "";
const endpoint = process.env.NAVOPATH_WORKSPACE_EVENT_URL || "https://navopath-mcp.shawn89890916.workers.dev/api/workspace-events";

if (!payloadPath) throw new Error("Usage: node scripts/navopath-workspace-event.mjs <payload.json>");
if (!/^nvp_[a-f0-9]{64}$/.test(token)) throw new Error("NAVOPATH_MCP_TOKEN must contain a complete NavoPath device token");

const source = await readFile(payloadPath, "utf8");
const payload = JSON.parse(source);
const body = JSON.stringify(payload);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac("sha256", token).update(`${timestamp}.${body}`).digest("hex");

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-navopath-timestamp": timestamp,
    "x-navopath-signature": `sha256=${signature}`,
  },
  body,
});

const responseText = await response.text();
if (!response.ok) throw new Error(`Workspace event rejected (${response.status}): ${responseText.slice(0, 500)}`);
console.log(responseText);
