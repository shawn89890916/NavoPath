const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES,
  readExternalPluginManifest,
} = require("./external-plugin-manifest.cjs");

test("rejects oversized plugin manifests before reading them", () => {
  let read = false;
  const fileSystem = {
    statSync: () => ({ size: MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES + 1 }),
    readFileSync: () => {
      read = true;
      throw new Error("must not read");
    },
  };

  assert.equal(readExternalPluginManifest("manifest.json", "sample", fileSystem), null);
  assert.equal(read, false);
});

test("accepts only object-shaped plugin manifests and sanitizes exposed fields", () => {
  const fileSystem = {
    statSync: () => ({ size: 512 }),
    readFileSync: () => JSON.stringify({
      id: "sample",
      name: " Sample plugin ",
      permissions: ["tasks", "unknown", "settings"],
      configFields: [
        { key: "limit<script>", type: "number", label: "Limit", min: 1, max: 10 },
        { key: "mode", type: "select", options: [{ value: "safe", label: "Safe" }] },
      ],
    }),
  };

  assert.deepEqual(readExternalPluginManifest("manifest.json", "folder", fileSystem), {
    id: "sample",
    name: "Sample plugin",
    nameI18n: undefined,
    description: "Local plugin installed in the desktop plugin directory.",
    descriptionI18n: undefined,
    enabledSummaryI18n: {
      zh: "本地插件已保留在用户插件目录中；当前版本加载 manifest 和配置，不执行外部脚本。",
      en: "This local plugin is preserved in the user plugin directory; this build loads its manifest and config, not external scripts.",
    },
    version: "0.0.0",
    author: "Local",
    icon: "P",
    permissions: ["tasks", "settings"],
    configFields: [
      {
        key: "limitscript",
        type: "number",
        label: "Limit",
        labelI18n: undefined,
        default: 1,
        min: 1,
        max: 10,
      },
      {
        key: "mode",
        type: "select",
        label: "mode",
        labelI18n: undefined,
        default: "safe",
        options: [{ value: "safe", label: "Safe", labelI18n: undefined }],
      },
    ],
    source: "external",
  });

  fileSystem.readFileSync = () => "[]";
  assert.equal(readExternalPluginManifest("manifest.json", "folder", fileSystem), null);
});

test("rejects unsafe storage keys and normalizes external config defaults", () => {
  const fileSystem = {
    statSync: () => ({ size: 1024 }),
    readFileSync: () => JSON.stringify({
      id: "safe-plugin",
      name: "Safe plugin",
      configFields: [
        { key: "__proto__", type: "string", default: "polluted" },
        { key: "constructor", type: "boolean", default: true },
        { key: "count", type: "number", min: 1, max: 10, default: 999 },
        { key: "label", type: "string", default: "x".repeat(12_000) },
        { key: "mode", type: "select", default: "unknown", options: [{ value: "safe", label: "Safe" }] },
        { key: "mode!", type: "select", default: "safe", options: [{ value: "other", label: "Other" }] },
        { key: "missing-options", type: "select", default: "unsafe" },
      ],
    }),
  };

  const plugin = readExternalPluginManifest("manifest.json", "folder", fileSystem);
  assert.deepEqual(plugin.configFields.map((field) => field.key), ["count", "label", "mode"]);
  assert.equal(plugin.configFields[0].default, 10);
  assert.equal(plugin.configFields[1].default.length, 10_000);
  assert.equal(plugin.configFields[2].default, "safe");

  fileSystem.readFileSync = () => JSON.stringify({ id: "__proto__", name: "Unsafe" });
  assert.equal(readExternalPluginManifest("manifest.json", "folder", fileSystem), null);
});
