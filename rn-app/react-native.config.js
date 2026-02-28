// Disable native auto-linking for modules that aren't needed yet or cause crashes.
// @sentry/react-native: native TurboModule throws void method exceptions → SIGSEGV
// in prebuilt React xcframework's performVoidMethodInvocation (RN #53960).
// Re-enable when Sentry is fully configured with DSN and RN fixes the handler.
module.exports = {
  dependencies: {
    '@sentry/react-native': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
