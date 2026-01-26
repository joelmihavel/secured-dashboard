/// FeatureFlags.swift
/// Flent Secured v2 - Feature Flags Model
///
/// Remote configuration for enabling/disabling features

import Foundation

// MARK: - Feature Flags

struct FeatureFlags: Equatable, Codable {
    var enableCreditCard: Bool
    var enableCashback: Bool
    var enableReferrals: Bool
    var maintenanceMode: Bool
    var minAppVersion: String?
    var forceUpdate: Bool

    // Default configuration
    static let `default` = FeatureFlags(
        enableCreditCard: true,
        enableCashback: true,
        enableReferrals: false,
        maintenanceMode: false,
        minAppVersion: nil,
        forceUpdate: false
    )

    /// Check if app needs update
    func needsUpdate(currentVersion: String) -> Bool {
        guard forceUpdate, let minVersion = minAppVersion else { return false }
        return currentVersion.compare(minVersion, options: .numeric) == .orderedAscending
    }
}
