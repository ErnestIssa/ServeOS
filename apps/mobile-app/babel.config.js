const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const workletsPluginPath = path.join(
  workspaceRoot,
  "node_modules",
  "react-native-worklets",
  "plugin",
  "index.js"
);
const workletsPkgPath = path.join(workspaceRoot, "node_modules", "react-native-worklets", "package.json");

function workletsToolingFingerprint() {
  try {
    const version = JSON.parse(fs.readFileSync(workletsPkgPath, "utf8")).version;
    const pluginHash = crypto.createHash("sha1").update(fs.readFileSync(workletsPluginPath)).digest("hex").slice(0, 12);
    return `${version}@${pluginHash}`;
  } catch {
    return "worklets-missing";
  }
}

module.exports = function (api) {
  api.cache(() => workletsToolingFingerprint());

  if (!fs.existsSync(workletsPluginPath)) {
    throw new Error(
      `Missing react-native-worklets Babel plugin at ${workletsPluginPath}. Install deps from the monorepo root.`
    );
  }

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          worklets: false,
          reanimated: false,
          native: { worklets: false, reanimated: false },
          web: { worklets: false, reanimated: false }
        }
      ]
    ],
    plugins: [workletsPluginPath]
  };
};
