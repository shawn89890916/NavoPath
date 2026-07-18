import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageFile = fileURLToPath(new URL("../ios/App/CapApp-SPM/Package.swift", import.meta.url));
const source = readFileSync(packageFile, "utf8");
const normalized = source.replace(/path: "([^"]+)"/g, (_, value) => `path: "${value.replaceAll("\\", "/")}"`);
const checking = process.argv.includes("--check");

if (checking && normalized !== source) {
  console.error("Capacitor SPM paths still contain Windows separators. Run npm run ios:sync.");
  process.exit(1);
}

if (!checking && normalized !== source) {
  writeFileSync(packageFile, normalized, "utf8");
  console.log("Normalized Capacitor SPM paths for macOS/Xcode.");
}
