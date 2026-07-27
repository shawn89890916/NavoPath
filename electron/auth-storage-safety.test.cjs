const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_AUTH_STORAGE_BYTES,
  parseAuthStorageSource,
  readAuthStorageFile,
  serializeAuthStorage,
  writeAuthStorageFile,
} = require("./auth-storage-safety.cjs");

test("accepts only object-shaped authentication storage and filters invalid values", () => {
  assert.deepEqual(parseAuthStorageSource('{"sb-project-auth-token":"safe:value","ignored":"value","bad":4}'), {
    ok: true,
    data: { "sb-project-auth-token": "safe:value" },
  });
  assert.deepEqual(parseAuthStorageSource("null"), { ok: false, reason: "invalid-root" });
  assert.deepEqual(parseAuthStorageSource("[]"), { ok: false, reason: "invalid-root" });
  assert.deepEqual(parseAuthStorageSource("{"), { ok: false, reason: "invalid-json" });
});

test("rejects oversized authentication storage before reading it", () => {
  let read = false;
  const result = readAuthStorageFile("auth-session.json", {
    existsSync: () => true,
    statSync: () => ({ size: MAX_AUTH_STORAGE_BYTES + 1 }),
    readFileSync: () => {
      read = true;
      return "{}";
    },
  });
  assert.deepEqual(result, { ok: false, reason: "too-large" });
  assert.equal(read, false);
});

test("atomically replaces valid authentication storage and preserves it after rejected writes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "navopath-auth-storage-"));
  const filePath = path.join(directory, "auth-session.json");
  try {
    fs.writeFileSync(filePath, '{"sb-project-auth-token":"safe:old"}', "utf8");
    writeAuthStorageFile(filePath, { "sb-project-auth-token": "safe:new" });
    assert.deepEqual(readAuthStorageFile(filePath), {
      ok: true,
      data: { "sb-project-auth-token": "safe:new" },
    });
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);

    assert.throws(() => serializeAuthStorage({ "sb-project-auth-token": null }), /string values/);
    assert.throws(() => writeAuthStorageFile(filePath, { "sb-project-auth-token": null }), /string values/);
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), {
      "sb-project-auth-token": "safe:new",
    });
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
