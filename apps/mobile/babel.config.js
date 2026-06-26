module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-detects react-native-reanimated in
    // node_modules and adds its plugin - do not also add it manually below,
    // that registers it twice and breaks the build.
    presets: ["babel-preset-expo"],
  };
};
