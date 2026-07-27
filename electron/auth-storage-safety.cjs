const fs = require("node:fs");

const MAX_AUTH_STORAGE_BYTES = 4 * 1024 * 1024;
const AUTH_STORAGE_KEY_PATTERN = /^sb-[a-z0-9-]+-(?:auth-token|code-verifier)$/i;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAuthStorageKey(key) {
  return typeof key === "string" && AUTH_STORAGE_KEY_PATTERN.test(key);
}

function parseAuthStorageSource(source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (!isRecord(parsed)) return { ok: false, reason: "invalid-root" };
  const data = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isAuthStorageKey(key) && typeof value === "string") data[key] = value;
  }
  return { ok: true, data };
}

function readAuthStorageFile(filePath, fileSystem = fs) {
  if (!fileSystem.existsSync(filePath)) return { ok: true, data: {} };
  const size = fileSystem.statSync(filePath).size;
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_AUTH_STORAGE_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  return parseAuthStorageSource(fileSystem.readFileSync(filePath, "utf8"));
}

function serializeAuthStorage(data, maxBytes = MAX_AUTH_STORAGE_BYTES) {
  if (
    !isRecord(data)
    || Object.entries(data).some(([key, value]) => !isAuthStorageKey(key) || typeof value !== "string")
  ) {
    throw new TypeError("Authentication storage must contain supported keys with string values.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("Authentication storage byte limit must be a non-negative safe integer.");
  }
  const source = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(source, "utf8") > maxBytes) {
    throw new RangeError("Authentication storage exceeds the maximum local file size.");
  }
  return source;
}

function writeAuthStorageFile(filePath, data, fileSystem = fs) {
  const source = serializeAuthStorage(data);
  const temporaryPath = `${filePath}.tmp`;
  try {
    fileSystem.writeFileSync(temporaryPath, source, "utf8");
    fileSystem.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fileSystem.unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

module.exports = {
  MAX_AUTH_STORAGE_BYTES,
  isAuthStorageKey,
  parseAuthStorageSource,
  readAuthStorageFile,
  serializeAuthStorage,
  writeAuthStorageFile,
};
