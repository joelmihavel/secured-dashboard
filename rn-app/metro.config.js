const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Empty module shim for Node.js built-ins that don't exist in React Native.
// ws (used by @supabase/realtime-js) requires these but RN has native WebSocket,
// so they're never actually called at runtime.
const emptyModule = path.resolve(__dirname, 'shims/empty.js');

// Note: __dev__ and __mocks__ are NOT in blockList because service files
// have dynamic imports to mocks (guarded by __DEV__). Metro needs to resolve
// these paths even in production builds. The __DEV__ guard ensures the mock
// code is stripped from production bundles at compile time.

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('readable-stream'),
  // Node.js built-ins required by ws — shimmed as empty since RN uses native WebSocket
  https: emptyModule,
  http: emptyModule,
  net: emptyModule,
  tls: emptyModule,
  zlib: emptyModule,
  crypto: emptyModule,
  url: emptyModule,
  events: emptyModule,
  buffer: emptyModule,
  bufferutil: emptyModule,
  'utf-8-validate': emptyModule,
};

module.exports = config;
