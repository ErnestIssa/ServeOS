const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const reanimatedPluginPath = path.join(
  workspaceRoot,
  "node_modules",
  "react-native-reanimated",
  "plugin",
  "index.js"
);

function reanimatedPluginFingerprint() {
  try {
    const hash = crypto.createHash("sha1").update(fs.readFileSync(reanimatedPluginPath)).digest("hex").slice(0, 12);
    return `reanimated-plugin@${hash}`;
  } catch {
    return "reanimated-missing";
  }
}

module.exports = function (api) {
  api.cache(() => reanimatedPluginFingerprint());

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Preset must not inject worklets/reanimated; we register the plugin explicitly below.
          // `react-native-reanimated/plugin` re-exports `react-native-worklets/plugin` — adding both duplicates the pass.
          worklets: false,
          reanimated: false,
          native: { worklets: false, reanimated: false },
          web: { worklets: false, reanimated: false }
        }
      ]
    ],
    /** Official Reanimated 4+: one plugin entry (delegates internally to react-native-worklets). */
    plugins: ["react-native-reanimated/plugin"]
  };
};
