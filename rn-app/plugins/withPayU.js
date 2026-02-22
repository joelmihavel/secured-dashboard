const { withDangerousMod, withInfoPlist } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin for PayU Checkout Pro SDK.
 *
 * Handles:
 * 1. iOS Podfile: Convert PayU pods to dynamic frameworks (pre_install)
 * 2. iOS Info.plist: Add UPI app query schemes
 * 3. Android: PhonePe maven repo (handled via expo-build-properties in app.json)
 */

function withPayUPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfileContents = fs.readFileSync(podfilePath, "utf8");

      // PayU pre_install block: convert PayU pods to dynamic frameworks
      const preInstallBlock = `
# PayU Checkout Pro: Convert PayU pods to dynamic frameworks
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if pod.name.start_with?('PayU') ||
       ['Socket.IO-Client-Swift', 'Starscream'].include?(pod.name)
      def pod.build_type
        Pod::BuildType.dynamic_framework
      end
    end
  end
end
`;

      // Insert BEFORE the first 'target' line
      if (!podfileContents.includes("pre_install do |installer|")) {
        const targetIndex = podfileContents.indexOf("\ntarget ");
        if (targetIndex !== -1) {
          podfileContents =
            podfileContents.slice(0, targetIndex) +
            "\n" + preInstallBlock + "\n" +
            podfileContents.slice(targetIndex);
        } else {
          // Fallback: prepend after the first line
          const firstNewline = podfileContents.indexOf("\n");
          podfileContents =
            podfileContents.slice(0, firstNewline + 1) +
            preInstallBlock + "\n" +
            podfileContents.slice(firstNewline + 1);
        }
      }

      fs.writeFileSync(podfilePath, podfileContents);
      return config;
    },
  ]);
}

function withPayUInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    // Add UPI app query schemes for intent detection
    const schemes = config.modResults.LSApplicationQueriesSchemes || [];
    const upiSchemes = ["phonepe", "tez", "paytm", "bhim", "credpay"];

    for (const scheme of upiSchemes) {
      if (!schemes.includes(scheme)) {
        schemes.push(scheme);
      }
    }

    config.modResults.LSApplicationQueriesSchemes = schemes;
    return config;
  });
}

function withPayU(config) {
  config = withPayUPodfile(config);
  config = withPayUInfoPlist(config);
  return config;
}

module.exports = withPayU;
