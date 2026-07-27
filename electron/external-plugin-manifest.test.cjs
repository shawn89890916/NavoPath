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
        default: undefined,
        min: 1,
        max: 10,
      },
      {
        key: "mode",
        type: "select",
        label: "mode",
        labelI18n: undefined,
        default: undefined,
        options: [{ value: "safe", label: "Safe", labelI18n: undefined }],
      },
    ],
    source: "external",
  });

  fileSystem.readFileSync = () => "[]";
  assert.equal(readExternalPluginManifest("manifest.json", "folder", fileSystem), null);
});
