import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load the monorepo `.env` whether the process cwd is the repo root or a workspace package (services/*, apps/*).
 */
export function loadServeOsEnv(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env")
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path, override: true });
      return;
    }
  }
  config();
}
