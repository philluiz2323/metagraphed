import { promises as fs } from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib.mjs";

const targetRoots = [
  "README.md",
  "docs",
  "registry",
  "schemas",
  "public",
  ".github"
];

const patterns = [
  { name: "local absolute path", regex: /\/Users\/|\/home\/|C:\\Users\\/ },
  { name: "private key marker", regex: /BEGIN [A-Z ]*PRIVATE KEY/ },
  { name: "github token", regex: /ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/ },
  { name: "openai-style token", regex: /sk-[A-Za-z0-9]{20,}/ },
  { name: "slack-style token", regex: /xox[baprs]-[A-Za-z0-9-]+/ },
  { name: "loopback URL", regex: /localhost:[0-9]+|127\.0\.0\.1|0\.0\.0\.0/ },
  { name: "wallet/key wording", regex: /\b(coldkey|hotkey|wallet path|private key)\b/i }
];

const findings = [];

async function* walk(target) {
  const fullPath = path.join(repoRoot, target);
  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch {
    return;
  }

  if (stat.isFile()) {
    yield fullPath;
    return;
  }

  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    const nested = path.join(target, entry.name);
    if (entry.isDirectory()) {
      yield* walk(nested);
    } else if (entry.isFile()) {
      yield path.join(repoRoot, nested);
    }
  }
}

for (const root of targetRoots) {
  for await (const filePath of walk(root)) {
    const relative = path.relative(repoRoot, filePath);
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          findings.push(`${relative}:${index + 1}: ${pattern.name}`);
        }
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`Public-safety scan found ${findings.length} issue(s):`);
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Public-safety scan passed.");
