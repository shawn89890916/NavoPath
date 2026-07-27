const fs = require("node:fs");

const MAX_SNAPSHOT_BYTES = 21 * 1024 * 1024;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSnapshotPayload(payload) {
  if (!isRecord(payload)) throw new TypeError("Snapshot payload must be an object.");
  for (const key of ["data", "settings", "authUser"]) {
    if (payload[key] != null && !isRecord(payload[key])) {
      throw new TypeError(`Snapshot ${key} must be an object or null.`);
    }
  }
}

function isSnapshotFileSizeAllowed(size) {
  return Number.isSafeInteger(size) && size >= 0 && size <= MAX_SNAPSHOT_BYTES;
}

function serializeSnapshot(payload, appVersion, exportedAt = new Date().toISOString(), maxBytes = MAX_SNAPSHOT_BYTES) {
  assertSnapshotPayload(payload);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("Snapshot byte limit must be a non-negative safe integer.");
  }
  const source = JSON.stringify({
    exportedAt,
    appVersion,
    data: payload.data ?? null,
    settings: payload.settings ?? null,
    authUser: payload.authUser ?? null,
  }, null, 2);
  if (Buffer.byteLength(source, "utf8") > maxBytes) {
    throw new RangeError("Snapshot exceeds the maximum local file size.");
  }
  return source;
}

function writeSnapshotFile(filePath, source) {
  const temporaryPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, source, "utf8");
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

function readSnapshotFile(filePath) {
  if (!isSnapshotFileSizeAllowed(fs.statSync(filePath).size)) {
    throw new RangeError("Snapshot exceeds the maximum local file size.");
  }
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assertSnapshotPayload(payload);
  return payload;
}

module.exports = {
  MAX_SNAPSHOT_BYTES,
  isSnapshotFileSizeAllowed,
  readSnapshotFile,
  serializeSnapshot,
  writeSnapshotFile,
};
