#!/usr/bin/env node
/**
 * Release verification script.
 *
 * Run after publishing a desktop release to confirm the auto-update manifest
 * (latest.yml) is reachable and consistent with the GitHub release tag, so the
 * Electron app can detect the new version. Fails fast on any mismatch.
 *
 * Usage:  node scripts/verify-release.mjs <tag>   (e.g. v1.2.28)
 */
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: node scripts/verify-release.mjs <tag> (e.g. v1.2.28)");
  process.exit(1);
}

const repo = "shawn89890916/NavoPath-planner";
const expectedVersion = tag.replace(/^v/, "");
let failures = 0;

function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  failures += 1;
}
function ok(msg) {
  console.log(`  OK    ${msg}`);
}

console.log(`\nVerifying release ${tag} (expecting latest.yml version ${expectedVersion})...\n`);

// 1. Release metadata
let release;
try {
  release = JSON.parse(
    execSync(`gh release view ${tag} --repo ${repo} --json tagName,isDraft,isPrerelease,assets`, {
      stdio: ["pipe", "pipe", "ignore"],
    }),
  );
} catch (err) {
  console.error("Could not fetch release metadata. Is gh authenticated?");
  process.exit(2);
}

if (release.isDraft) fail("release is still a draft");
else ok("release is published (not draft)");

if (release.isPrerelease) fail("release is marked as prerelease");
else ok("release is not a prerelease");

// 2. Required assets
const required = ["latest.yml", "NavoPath-Setup.exe", "NavoPath-Setup.exe.blockmap", "NavoPath-Portable.exe"];
for (const name of required) {
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) fail(`missing asset: ${name}`);
  else if (asset.state !== "uploaded") fail(`asset ${name} state is ${asset.state}`);
  else ok(`asset present: ${name} (${asset.size} bytes)`);
}

// 3. Asset URLs must reference the real tag, never untagged-*
const untagged = release.assets.filter((a) => /untagged-/.test(a.url || ""));
if (untagged.length > 0) fail(`assets still on untagged URLs: ${untagged.map((a) => a.name).join(", ")}`);
else ok("all asset URLs reference the real tag");

// 4. Download and inspect latest.yml via gh CLI (handles auth + redirects)
const tmpFile = `${tag}-latest.yml`;
let yml = "";
try {
  execSync(`gh release download ${tag} --repo ${repo} --pattern "latest.yml" --output "${tmpFile}"`, {
    stdio: "ignore",
  });
  yml = readFileSync(tmpFile, "utf8");
} catch (err) {
  fail(`could not download latest.yml via gh CLI: ${err.message}`);
} finally {
  try { unlinkSync(tmpFile); } catch {}
}

const versionMatch = yml.match(/^version:\s*(.+)$/m);
const ymlVersion = versionMatch ? versionMatch[1].trim() : null;
if (!ymlVersion) fail("latest.yml has no version field");
else if (ymlVersion !== expectedVersion) fail(`latest.yml version ${ymlVersion} != tag ${expectedVersion}`);
else ok(`latest.yml version matches tag: ${ymlVersion}`);

// 5. sha512 / size sanity (non-empty)
const shaMatch = yml.match(/^sha512:\s*(\S+)/m);
const sizeMatch = yml.match(/^\s+size:\s*(\d+)/m) || yml.match(/^size:\s*(\d+)/m);
if (!shaMatch) fail("latest.yml missing sha512");
else ok(`latest.yml sha512 present (${shaMatch[1].slice(0, 16)}...)`);
if (!sizeMatch) fail("latest.yml missing size");
else ok(`latest.yml size present (${sizeMatch[1]} bytes)`);

console.log("\nVerification complete.");
if (failures > 0) {
  console.error(`${failures} check(s) failed. Auto-update will NOT work correctly.`);
  process.exit(1);
} else {
  console.log("All checks passed. Auto-update manifest is consistent with the release.");
  process.exit(0);
}
