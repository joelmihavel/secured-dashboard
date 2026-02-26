const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Empty module shim for Node.js built-ins that don't exist in React Native.
// ws (used by @supabase/realtime-js) requires these but RN has native WebSocket,
// so they're never actually called at runtime.
const emptyModule = path.resolve(__dirname, 'shims/empty.js');

// In production, exclude dev-only and mock directories from the bundle
if (process.env.NODE_ENV === 'production') {
  config.resolver.blockList = [
    ...(config.resolver.blockList ? [config.resolver.blockList] : []),
    /src\/__dev__\/.*/,
    /src\/__mocks__\/.*/,
    /src\/services\/api\/__mocks__\/.*/,
  ];
}

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

module.exports = withNativeWind(config, { input: './global.css' });
