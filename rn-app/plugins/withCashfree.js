const { withInfoPlist } = require("@expo/config-plugins");

/**
 * Expo config plugin for Cashfree PG SDK.
 *
 * Handles:
 * 1. iOS Info.plist: Add UPI app query schemes for intent detection
 * 2. Android: No additional config needed (Cashfree SDK handles it)
 */
function withCashfree(config) {
  return withInfoPlist(config, (config) => {
    const schemes = config.modResults.LSApplicationQueriesSchemes || [];
    const upiSchemes = ["phonepe", "tez", "paytmmp", "bhim", "amazonpay", "credpay"];

    for (const scheme of upiSchemes) {
      if (!schemes.includes(scheme)) {
        schemes.push(scheme);
      }
    }

    config.modResults.LSApplicationQueriesSchemes = schemes;
    return config;
  });
}

module.exports = withCashfree;
