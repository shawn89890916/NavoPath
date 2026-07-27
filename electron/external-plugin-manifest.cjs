const fs = require("node:fs");

const MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES = 256 * 1024;
const MAX_PLUGIN_CONFIG_STRING_LENGTH = 10_000;
const allowedPluginPermissions = new Set(["tasks", "settings", "ui", "events", "calendar"]);
const allowedPluginFieldTypes = new Set(["boolean", "number", "string", "select"]);
const unsafeStorageKeys = new Set(["__proto__", "prototype", ...Object.getOwnPropertyNames(Object.prototype)]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : fallback;
}

function cleanLocalizedText(value) {
  if (!isRecord(value)) return undefined;
  const result = {};
  for (const lang of ["zh", "en"]) {
    const text = cleanText(value[lang]);
    if (text) result[lang] = text;
  }
  return Object.keys(result).length ? result : undefined;
}

function isSafeStorageKey(value) {
  return Boolean(value) && !unsafeStorageKeys.has(value);
}

function cleanPluginConfigFields(fields) {
  if (!Array.isArray(fields)) return [];
  const result = [];
  const seenKeys = new Set();
  for (const field of fields.slice(0, 20)) {
    if (!isRecord(field)) continue;
    const key = cleanText(field.key).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64);
    const type = cleanText(field.type);
    if (!isSafeStorageKey(key) || seenKeys.has(key) || !allowedPluginFieldTypes.has(type)) continue;
    const cleanField = {
      key,
      label: cleanText(field.label, key),
      labelI18n: cleanLocalizedText(field.labelI18n),
      type,
    };
    if (type === "number") {
      const min = Number.isFinite(field.min) ? Number(field.min) : undefined;
      const max = Number.isFinite(field.max) ? Number(field.max) : undefined;
      if (min !== undefined && max !== undefined && min > max) continue;
      if (min !== undefined) cleanField.min = min;
      if (max !== undefined) cleanField.max = max;
      let value = Number.isFinite(field.default) ? Number(field.default) : 0;
      if (min !== undefined) value = Math.max(min, value);
      if (max !== undefined) value = Math.min(max, value);
      cleanField.default = value;
    } else if (type === "boolean") {
      cleanField.default = typeof field.default === "boolean" ? field.default : false;
    } else if (type === "string") {
      cleanField.default = typeof field.default === "string"
        ? field.default.slice(0, MAX_PLUGIN_CONFIG_STRING_LENGTH)
        : "";
    }
    if (type === "select") {
      if (!Array.isArray(field.options)) continue;
      const seenValues = new Set();
      cleanField.options = field.options.slice(0, 50).flatMap((option) => {
        if (!isRecord(option)) return [];
        const value = cleanText(option.value).slice(0, 100);
        if (!value || seenValues.has(value)) return [];
        seenValues.add(value);
        return [{
          value,
          label: cleanText(option.label, value),
          labelI18n: cleanLocalizedText(option.labelI18n),
        }];
      });
      if (cleanField.options.length === 0) continue;
      cleanField.default = typeof field.default === "string"
        && cleanField.options.some((option) => option.value === field.default)
        ? field.default
        : cleanField.options[0].value;
    }
    seenKeys.add(key);
    result.push(cleanField);
  }
  return result;
}

function isExternalPluginManifestFileSizeAllowed(size) {
  return Number.isSafeInteger(size) && size >= 0 && size <= MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES;
}

function readExternalPluginManifest(filePath, folderId, fileSystem = fs) {
  if (!isExternalPluginManifestFileSizeAllowed(fileSystem.statSync(filePath).size)) return null;
  const manifest = JSON.parse(fileSystem.readFileSync(filePath, "utf8"));
  if (!isRecord(manifest)) return null;
  const id = cleanText(manifest.id, folderId).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
  const name = cleanText(manifest.name, id);
  if (!isSafeStorageKey(id) || !name) return null;
  return {
    id,
    name,
    nameI18n: cleanLocalizedText(manifest.nameI18n),
    description: cleanText(manifest.description, "Local plugin installed in the desktop plugin directory.").slice(0, 500),
    descriptionI18n: cleanLocalizedText(manifest.descriptionI18n),
    enabledSummaryI18n: cleanLocalizedText(manifest.enabledSummaryI18n) || {
      zh: "本地插件已保留在用户插件目录中；当前版本加载 manifest 和配置，不执行外部脚本。",
      en: "This local plugin is preserved in the user plugin directory; this build loads its manifest and config, not external scripts.",
    },
    version: cleanText(manifest.version, "0.0.0").slice(0, 40),
    author: cleanText(manifest.author, "Local").slice(0, 80),
    icon: cleanText(manifest.icon, "P").slice(0, 4),
    permissions: Array.isArray(manifest.permissions)
      ? manifest.permissions.filter((permission) => allowedPluginPermissions.has(permission)).slice(0, 5)
      : [],
    configFields: cleanPluginConfigFields(manifest.configFields),
    source: "external",
  };
}

module.exports = {
  MAX_EXTERNAL_PLUGIN_MANIFEST_BYTES,
  MAX_PLUGIN_CONFIG_STRING_LENGTH,
  isExternalPluginManifestFileSizeAllowed,
  readExternalPluginManifest,
};
