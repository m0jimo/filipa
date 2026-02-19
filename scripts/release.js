#!/usr/bin/env node
// scripts/release.js — bump minor version, update CHANGELOG, commit, and tag
// Usage: node scripts/release.js [minor|patch]  (default: minor)

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── helpers ────────────────────────────────────────────────────────────────

const run = (cmd) => execSync(cmd, { cwd: root, encoding: "utf-8" }).trim();

const today = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ── bump version ───────────────────────────────────────────────────────────

const bumpType = process.argv[2] ?? "minor";
if (bumpType !== "minor" && bumpType !== "patch") {
  console.error(`Invalid bump type "${bumpType}". Use "minor" or "patch".`);
  process.exit(1);
}

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

const newVersion =
  bumpType === "minor"
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version bumped (${bumpType}): ${major}.${minor}.${patch} → ${newVersion}`);

// ── collect commits since last version tag (or all if no tag) ─────────────

let logRange;
try {
  const prevVersion = `${major}.${minor}.${patch}`;
  const tagName = `v${prevVersion}`;
  run(`git rev-parse ${tagName}`); // throws if tag doesn't exist
  logRange = `${tagName}..HEAD`;
} catch {
  // no tag found — use commit that last touched package.json as boundary
  try {
    const lastVersionCommit = run(
      `git log --oneline --follow -n 1 -- package.json`
    ).split(" ")[0];
    logRange = `${lastVersionCommit}..HEAD`;
  } catch {
    logRange = "HEAD";
  }
}

const rawLog = run(`git log ${logRange} --pretty=format:"%s" --no-merges`);
const commits = rawLog ? rawLog.split("\n").filter(Boolean) : [];

// ── group commits by conventional-commit type ──────────────────────────────

const groups = {
  feat: [],
  fix: [],
  perf: [],
  refactor: [],
  docs: [],
  style: [],
  test: [],
  chore: [],
  other: [],
};

const typeLabels = {
  feat: "Added",
  fix: "Fixed",
  perf: "Performance",
  refactor: "Changed",
  docs: "Documentation",
  style: "Style",
  test: "Tests",
  chore: "Chore",
  other: "Other",
};

for (const msg of commits) {
  const match = msg.match(/^(\w+)(?:\([^)]+\))?:\s*(.+)$/);
  if (match) {
    const [, type, description] = match;
    const group = groups[type] ?? groups.other;
    group.push(description);
  } else {
    groups.other.push(msg);
  }
}

// ── build changelog entry ──────────────────────────────────────────────────

const changelogPath = resolve(root, "CHANGELOG.md");
const existingChangelog = readFileSync(changelogPath, "utf-8");

let entry = `## [${newVersion}] — ${today()}\n`;

const orderedTypes = ["feat", "fix", "perf", "refactor", "docs", "style", "test", "chore", "other"];
for (const type of orderedTypes) {
  const items = groups[type];
  if (items.length === 0) continue;
  entry += `\n### ${typeLabels[type]}\n\n`;
  for (const item of items) {
    entry += `- ${item}\n`;
  }
}

if (commits.length === 0) {
  entry += "\n_No changes recorded._\n";
}

entry += "\n";

// insert after the header block (after the first `---` separator)
const separatorIndex = existingChangelog.indexOf("---\n");
let newChangelog;
if (separatorIndex !== -1) {
  const before = existingChangelog.slice(0, separatorIndex + 4);
  const after = existingChangelog.slice(separatorIndex + 4);
  newChangelog = `${before}\n${entry}${after}`;
} else {
  newChangelog = existingChangelog + "\n" + entry;
}

writeFileSync(changelogPath, newChangelog);
console.log(`CHANGELOG.md updated with ${commits.length} commit(s).`);

// ── git commit & tag ───────────────────────────────────────────────────────

run(`git add package.json CHANGELOG.md`);
run(`git commit -m "chore: release v${newVersion}"`);
run(`git tag v${newVersion}`);
console.log(`Committed and tagged as v${newVersion}.`);

run(`git push`);
run(`git push --tags`);
console.log(`Pushed commit and tag — GitHub Actions will create the release.`);
