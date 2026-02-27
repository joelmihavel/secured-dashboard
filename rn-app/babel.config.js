module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-worklets/plugin',
    ],
    env: {
      test: {
        plugins: [
          // Transform dynamic import() to require() so Jest can mock modules
          'babel-plugin-dynamic-import-node',
        ],
      },
    },
  };
};
