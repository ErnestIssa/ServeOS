/**
 * Monorepo shim: `node_modules/expo/AppEntry.js` does `import App from "../../App"`, which
 * resolves here when `expo` is hoisted to the repo root (npm workspaces). Without this file,
 * Metro reports `Unable to resolve module` for `../../App` from AppEntry.
 *
 * The real default export is `apps/mobile-app/Root` (same tree as `index.tsx` uses).
 * Mobile entry remains `main` in `apps/mobile-app/package.json` (typically `index.tsx`).
 */
export { default } from "./apps/mobile-app/Root";
