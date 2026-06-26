const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

// This app lives at apps/mobile inside a pnpm workspace (see
// ../../pnpm-workspace.yaml). Metro needs two extra things to work in that
// layout: it must watch the workspace root (so changes to anything hoisted
// there are picked up) and it must be told pnpm uses symlinks in
// node_modules, or module resolution silently breaks.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
