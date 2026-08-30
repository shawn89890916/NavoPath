import test from "node:test";
import assert from "node:assert/strict";
import { detectManifestChanges, eventDedupeKey, isPathWatched, isValidDeviceToken, schedulingExcerpt, type BridgeManifest } from "./change-utils.ts";

test("accepts only complete NavoPath device tokens", () => {
  assert.equal(isValidDeviceToken(`nvp_${"a".repeat(64)}`), true);
  assert.equal(isValidDeviceToken(`nvp_${"a".repeat(63)}`), false);
  assert.equal(isValidDeviceToken("nvp_not-a-token"), false);
});

test("watches only the configured admissions folder", () => {
  assert.equal(isPathWatched("升学/资料/申请.md", "升学/资料"), true);
  assert.equal(isPathWatched("升学\\资料\\申请.md", "升学/资料"), true);
  assert.equal(isPathWatched("升学/资料备份/申请.md", "升学/资料"), false);
  assert.equal(isPathWatched("日记/今天.md", "升学/资料"), false);
});

test("detects only content changes and deletions", () => {
  const previous: BridgeManifest = {
    "升学/资料/a.md": { hash: "same", mtime: 1, size: 10 },
    "升学/资料/deleted.md": { hash: "gone", mtime: 2, size: 5 },
  };
  const current: BridgeManifest = {
    "升学/资料/a.md": { hash: "same", mtime: 99, size: 10 },
    "升学/资料/new.md": { hash: "new", mtime: 3, size: 8 },
  };
  assert.deepEqual(detectManifestChanges(previous, current).map(({ path, changeType }) => ({ path, changeType })), [
    { path: "升学/资料/deleted.md", changeType: "deleted" },
    { path: "升学/资料/new.md", changeType: "created" },
  ]);
});

test("extracts scheduling evidence instead of the whole note", () => {
  const content = `---\nstatus: active\ndue: 2026-09-01\n---\n背景材料很长。\n- [ ] 8月30日前提交推荐信\n普通说明。\n面试时间 09:30。`;
  const excerpt = schedulingExcerpt(content, 200);
  assert.match(excerpt, /due: 2026-09-01/);
  assert.match(excerpt, /提交推荐信/);
  assert.match(excerpt, /09:30/);
  assert.doesNotMatch(excerpt, /普通说明/);
});

test("dedupe key is stable for retries and changes when mtime changes", async () => {
  const change = [{ path: "升学/资料/a.md", changeType: "modified" as const, current: { hash: "abc", mtime: 10, size: 3 } }];
  assert.equal(await eventDedupeKey(change), await eventDedupeKey([...change]));
  assert.notEqual(await eventDedupeKey(change), await eventDedupeKey([{ ...change[0], current: { ...change[0].current, mtime: 11 } }]));
});
