#!/usr/bin/env node
/**
 * setup-hooks.cjs
 * Run once after cloning: node scripts/setup-hooks.cjs
 * Configures git to use .githooks/ directory for all developers.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

try {
  execSync("git config core.hooksPath .githooks", { stdio: "inherit" });
  // Make hooks executable on Unix/Mac
  const hooksDir = path.join(__dirname, "../.githooks");
  if (fs.existsSync(hooksDir)) {
    fs.readdirSync(hooksDir).forEach((file) => {
      try {
        fs.chmodSync(path.join(hooksDir, file), "755");
      } catch (_) {}
    });
  }
  console.log("✅ Git hooks configured from .githooks/");
  console.log("   - prepare-commit-msg: auto-prepends date to every commit");
  console.log("   - pre-push: warns if CHANGELOG.md wasn't updated");
} catch (e) {
  console.error("❌ Failed to set up hooks:", e.message);
  process.exit(1);
}
