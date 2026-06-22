import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error(
    "[serveos] DATABASE_URL is missing. Copy .env.example to the repo root .env and set your Neon direct connection URL."
  );
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);
const schemaPath = path.join(here, "..", "prisma", "schema.prisma");
const result = spawnSync("npx", ["prisma", ...prismaArgs, "--schema", schemaPath], {
  stdio: "inherit",
  shell: true,
  cwd: path.join(here, ".."),
  env: process.env
});

process.exit(result.status ?? 1);
