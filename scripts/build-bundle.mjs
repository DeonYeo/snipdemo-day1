import { execFileSync, execSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = path.join(root, "bundle");
const frontend = path.join(root, "frontend");
const buildOutput = path.join(frontend, "dist", "snip-frontend", "browser");
const publicOutput = path.join(bundle, "public");
const shouldPush = process.argv.includes("--push");

function git(args, cwd = root) {
  execFileSync("git", args, { cwd, stdio: "inherit" });
}

function shell(command, cwd) {
  execSync(command, { cwd, stdio: "inherit" });
}

function hasStagedChanges(cwd) {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    stdio: "ignore",
  });
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`git diff --cached failed in ${cwd}`);
}

function commitStaged(cwd, message) {
  if (!hasStagedChanges(cwd)) return false;
  git(
    [
      "commit",
      "-m",
      message,
      "-m",
      "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>\nCo-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>",
    ],
    cwd,
  );
  return true;
}

if (gitOutput(["branch", "--show-current"]) !== "main") {
  throw new Error("Run the bundle build from the main superproject branch.");
}

const bundleStatus = gitOutput(["status", "--porcelain"], bundle);
if (bundleStatus) {
  throw new Error("The bundle worktree is not clean; preserve its existing changes and retry.");
}

git(["submodule", "update", "--init", "--remote", "backend", "frontend", "cli"]);
shell("npm install", frontend);
shell("npx ng build", frontend);
if (!existsSync(path.join(buildOutput, "index.html"))) {
  throw new Error(`Angular build output is missing: ${path.join(buildOutput, "index.html")}`);
}

cpSync(path.join(root, "backend", "server.js"), path.join(bundle, "server.js"));
cpSync(path.join(root, "cli", "cli.js"), path.join(bundle, "cli.js"));
rmSync(publicOutput, { recursive: true, force: true });
mkdirSync(publicOutput, { recursive: true });
cpSync(buildOutput, publicOutput, { recursive: true });
writeFileSync(path.join(bundle, ".env"), "PUBLIC_DIR=./public\n");
writeFileSync(
  path.join(bundle, "package.json"),
  `${JSON.stringify({ name: "snip-bundle", private: true, scripts: { start: "bun server.js" } }, null, 2)}\n`,
);
writeFileSync(
  path.join(bundle, "Dockerfile"),
  [
    "FROM oven/bun:1-alpine",
    "WORKDIR /app",
    "COPY . .",
    "ENV PORT=3000",
    "EXPOSE 3000",
    "CMD [\"bun\", \"server.js\"]",
    "",
  ].join("\n"),
);
writeFileSync(
  path.join(bundle, ".dockerignore"),
  ["node_modules", ".git", ".gitmodules", "*.log", "",].join("\n"),
);
writeFileSync(
  path.join(bundle, "railway.json"),
  `${JSON.stringify(
    {
      "$schema": "https://railway.app/railway.schema.json",
      build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    },
    null,
    2,
  )}\n`,
);

git(["add", "-A"], bundle);
const bundleChanged = commitStaged(bundle, "Build generated Snip release");
if (bundleChanged) {
  console.log("Created generated bundle commit.");
} else {
  console.log("Bundle unchanged.");
}

git(["add", "bundle"]);
const mainChanged = commitStaged(root, "Update generated bundle pointer");
if (mainChanged) {
  console.log("Updated bundle gitlink on main.");
} else {
  console.log("Main bundle pointer unchanged.");
}

if (shouldPush) {
  git(["push", "origin", "HEAD:bundle"], bundle);
  git(["push", "origin", "main"]);
  console.log("Pushed bundle and main.");
} else {
  console.log("Local only; rerun with --push to publish.");
}

function gitOutput(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}
