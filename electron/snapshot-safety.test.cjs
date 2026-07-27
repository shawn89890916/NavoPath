const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MAX_SNAPSHOT_BYTES,
  isSnapshotFileSizeAllowed,
  readSnapshotFile,
  serializeSnapshot,
  writeSnapshotFile,
} = require("./snapshot-safety.cjs");

test("accepts snapshot files only within the local byte budget", () => {
  assert.equal(isSnapshotFileSizeAllowed(0), true);
  assert.equal(isSnapshotFileSizeAllowed(MAX_SNAPSHOT_BYTES), true);
  assert.equal(isSnapshotFileSizeAllowed(MAX_SNAPSHOT_BYTES + 1), false);
  assert.equal(isSnapshotFileSizeAllowed(-1), false);
  assert.equal(isSnapshotFileSizeAllowed(1.5), false);
});

test("serializes only bounded object-shaped snapshot payloads", () => {
  assert.throws(() => serializeSnapshot(null, "1.0.0"), /must be an object/);
  assert.throws(
    () => serializeSnapshot({ data: [] }, "1.0.0"),
    /data must be an object or null/,
  );
  assert.throws(
    () => serializeSnapshot({ data: { tasks: [] }, settings: { note: "long" } }, "1.0.0", undefined, 32),
    /maximum local file size/,
  );
  assert.deepEqual(
    JSON.parse(serializeSnapshot({ data: { tasks: [] } }, "1.2.3", "2026-07-27T00:00:00.000Z")),
    {
      exportedAt: "2026-07-27T00:00:00.000Z",
      appVersion: "1.2.3",
      data: { tasks: [] },
      settings: null,
      authUser: null,
    },
  );
});

test("atomically replaces snapshots and rejects oversized reads before parsing", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "navopath-snapshot-"));
  const filePath = path.join(directory, "snapshot.json");
  try {
    fs.writeFileSync(filePath, '{"marker":"old"}', "utf8");
    const source = serializeSnapshot({ data: { tasks: [] } }, "1.2.3");
    writeSnapshotFile(filePath, source);
    assert.deepEqual(readSnapshotFile(filePath).data, { tasks: [] });
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);

    fs.truncateSync(filePath, MAX_SNAPSHOT_BYTES + 1);
    assert.throws(() => readSnapshotFile(filePath), /maximum local file size/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("allows only the primary renderer to read or write desktop recovery snapshots", () => {
  const electronMainSource = fs.readFileSync(path.resolve("electron", "main.cjs"), "utf8");
  const rendererSource = fs.readFileSync(path.resolve("src", "main.tsx"), "utf8");

  assert.match(electronMainSource, /handleTrusted\("backup:writeSnapshot", \(event, payload\) => \{/);
  assert.match(electronMainSource, /handleTrusted\("backup:readLatest", \(event\) => \{/);
  assert.equal(
    electronMainSource.match(/if \(!isPrimaryWindowEvent\(event\)\) return \{ ok: false,/g)?.length,
    2,
  );
  assert.match(rendererSource, /const isCompactWindowRoute = routeSearchParams\.get\("compactWindow"\) === "1";/);
  assert.match(rendererSource, /if \(typeof window === "undefined" \|\| isCompactWindowRoute \|\| !window\.desktopApi\?\.writeSnapshot\) return;/);
  assert.match(rendererSource, /if \(!isCompactWindowRoute\) \{\s*try \{\s*void window\.desktopApi\?\.writeSnapshot\?\.\(/);
});
