/**
 * Keeps Vite's dependency cache consistent in the monorepo.
 * Corrupted or half-built .vite/deps bundles cause blank pages (504 on react-dom).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(appDir, "..");
const repoRoot = path.resolve(appRoot, "../..");

const requiredDeps = ["react.js", "react-dom.js", "react-dom_client.js", "react_jsx-dev-runtime.js"];

const workspaceWatchFiles = [
  path.join(repoRoot, "core/shared/src/signupWizard.ts"),
  path.join(repoRoot, "core/shared/src/index.ts"),
  path.join(repoRoot, "core/ambient/src/index.ts"),
  path.join(repoRoot, "core/loading/src/index.ts"),
  path.join(repoRoot, "core/theme/src/index.ts")
];

function viteCacheDirs() {
  const dirs = [
    path.join(appRoot, "node_modules", ".vite"),
    path.join(repoRoot, "node_modules", ".vite")
  ];
  return [...new Set(dirs)];
}

function cacheLooksHealthy(cacheDir) {
  const depsDir = path.join(cacheDir, "deps");
  const metadataPath = path.join(depsDir, "_metadata.json");
  if (!fs.existsSync(metadataPath)) return false;
  try {
    JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch {
    return false;
  }
  return requiredDeps.every((file) => fs.existsSync(path.join(depsDir, file)));
}

function newestMtime(paths) {
  let newest = 0;
  for (const target of paths) {
    if (!fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      newest = Math.max(newest, stat.mtimeMs);
      continue;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const full = path.join(target, entry.name);
        newest = Math.max(newest, fs.statSync(full).mtimeMs);
      }
    }
  }
  return newest;
}

function cacheMetadataMtime(cacheDir) {
  const metadataPath = path.join(cacheDir, "deps", "_metadata.json");
  if (!fs.existsSync(metadataPath)) return 0;
  return fs.statSync(metadataPath).mtimeMs;
}

function shouldClearCache(cacheDir) {
  if (!cacheLooksHealthy(cacheDir)) return true;
  const workspaceMtime = newestMtime(workspaceWatchFiles);
  const cacheMtime = cacheMetadataMtime(cacheDir);
  return workspaceMtime > cacheMtime;
}

let clearedAny = false;

for (const cacheDir of viteCacheDirs()) {
  if (!fs.existsSync(cacheDir)) continue;
  if (!shouldClearCache(cacheDir)) continue;
  fs.rmSync(cacheDir, { recursive: true, force: true });
  clearedAny = true;
  console.log(`[customer-web] Cleared stale Vite cache (${path.relative(repoRoot, cacheDir)})`);
}

if (!clearedAny) {
  const hasHealthyCache = viteCacheDirs().some((dir) => fs.existsSync(dir) && cacheLooksHealthy(dir));
  if (!hasHealthyCache) {
    console.log("[customer-web] Vite cache will rebuild on next dev start");
  }
}
