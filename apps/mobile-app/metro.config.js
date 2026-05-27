const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve hoisted workspace packages from the monorepo root.
config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
const hoist = (name: string) => path.resolve(workspaceRoot, "node_modules", name);
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "expo-notifications": hoist("expo-notifications"),
  "expo-image-picker": hoist("expo-image-picker"),
  "expo-image-manipulator": hoist("expo-image-manipulator")
};

// Tie Metro's transform cache to the hoisted Worklets package + plugin bytes so stale
// bundles (stamped with an old __pluginVersion) cannot survive a version skew.
const workletsPkgJson = path.join(workspaceRoot, "node_modules", "react-native-worklets", "package.json");
const workletsPluginFile = path.join(workspaceRoot, "node_modules", "react-native-worklets", "plugin", "index.js");
try {
  const version = JSON.parse(fs.readFileSync(workletsPkgJson, "utf8")).version;
  const pluginHash = crypto.createHash("sha1").update(fs.readFileSync(workletsPluginFile)).digest("hex").slice(0, 12);
  config.transformer = {
    ...config.transformer,
    workletsVersion: `${version}+plugin-${pluginHash}`
  };
} catch {
  // keep Expo's default workletsVersion from getDefaultConfig
}

module.exports = wrapWithReanimatedMetroConfig(config);

