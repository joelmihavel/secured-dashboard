/// SettingsViewModel.swift
/// Flent Secured v2 - Settings ViewModel
///
/// Manages app settings and preferences
///
/// Figma: Settings screens

import Foundation
import Observation

// MARK: - Settings ViewModel

@Observable
final class SettingsViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case saving
        case saved
        case error(String)
    }

    // MARK: - Settings

    struct Settings: Equatable {
        var pushNotificationsEnabled: Bool = true
        var biometricLoginEnabled: Bool = false
        var autoPayEnabled: Bool = false
        var paymentReminders: Bool = true
        var marketingEmails: Bool = false
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    var settings: Settings = Settings()
    private var originalSettings: Settings = Settings()

    // MARK: - Computed Properties

    var isSaving: Bool {
        if case .saving = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var hasUnsavedChanges: Bool {
        settings != originalSettings
    }

    var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "Version \(version) (\(build))"
    }

    // MARK: - Dependencies

    private let userDefaults: UserDefaults
    private let biometricManager: BiometricManagerProtocol?

    // MARK: - Initialization

    init(
        userDefaults: UserDefaults = .standard,
        biometricManager: BiometricManagerProtocol? = nil
    ) {
        self.userDefaults = userDefaults
        self.biometricManager = biometricManager
        loadSettings()
    }

    // MARK: - Actions

    func loadSettings() {
        settings = Settings(
            pushNotificationsEnabled: userDefaults.bool(forKey: SettingsKeys.pushNotifications),
            biometricLoginEnabled: userDefaults.bool(forKey: SettingsKeys.biometricLogin),
            autoPayEnabled: userDefaults.bool(forKey: SettingsKeys.autoPay),
            paymentReminders: userDefaults.bool(forKey: SettingsKeys.paymentReminders),
            marketingEmails: userDefaults.bool(forKey: SettingsKeys.marketingEmails)
        )

        // Set defaults if not configured
        if !userDefaults.bool(forKey: SettingsKeys.hasBeenConfigured) {
            settings.pushNotificationsEnabled = true
            settings.paymentReminders = true
            saveSettings()
            userDefaults.set(true, forKey: SettingsKeys.hasBeenConfigured)
        }

        originalSettings = settings
    }

    func saveSettings() {
        state = .saving

        userDefaults.set(settings.pushNotificationsEnabled, forKey: SettingsKeys.pushNotifications)
        userDefaults.set(settings.biometricLoginEnabled, forKey: SettingsKeys.biometricLogin)
        userDefaults.set(settings.autoPayEnabled, forKey: SettingsKeys.autoPay)
        userDefaults.set(settings.paymentReminders, forKey: SettingsKeys.paymentReminders)
        userDefaults.set(settings.marketingEmails, forKey: SettingsKeys.marketingEmails)

        originalSettings = settings
        state = .saved

        // Reset state after delay
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if case .saved = state {
                state = .idle
            }
        }
    }

    @MainActor
    func togglePushNotifications() async {
        let newValue = !settings.pushNotificationsEnabled

        if newValue {
            // Request push notification permission
            await requestPushPermission()
        }

        settings.pushNotificationsEnabled = newValue
        saveSettings()
    }

    @MainActor
    func toggleBiometricLogin() async {
        let newValue = !settings.biometricLoginEnabled

        if newValue {
            // Check if biometric is available
            guard let manager = biometricManager,
                  manager.isBiometricAvailable else {
                state = .error("Biometric authentication is not available on this device")
                return
            }

            // Authenticate to enable
            let success = await manager.authenticate(reason: "Enable biometric login")
            if !success {
                state = .error("Biometric authentication failed")
                return
            }
        }

        settings.biometricLoginEnabled = newValue
        saveSettings()
    }

    func toggleAutoPay() {
        settings.autoPayEnabled = !settings.autoPayEnabled
        saveSettings()
    }

    func togglePaymentReminders() {
        settings.paymentReminders = !settings.paymentReminders
        saveSettings()
    }

    func toggleMarketingEmails() {
        settings.marketingEmails = !settings.marketingEmails
        saveSettings()
    }

    func clearError() {
        if case .error = state {
            state = .idle
        }
    }

    // MARK: - Private Helpers

    @MainActor
    private func requestPushPermission() async {
        // Request push notification permission
        // This would integrate with UNUserNotificationCenter
    }
}

// MARK: - Settings Keys

private enum SettingsKeys {
    static let hasBeenConfigured = "settings.hasBeenConfigured"
    static let pushNotifications = "settings.pushNotifications"
    static let biometricLogin = "settings.biometricLogin"
    static let autoPay = "settings.autoPay"
    static let paymentReminders = "settings.paymentReminders"
    static let marketingEmails = "settings.marketingEmails"
}

// MARK: - Biometric Manager Protocol

protocol BiometricManagerProtocol {
    var isBiometricAvailable: Bool { get }
    func authenticate(reason: String) async -> Bool
}

// MARK: - Preview Helpers

extension SettingsViewModel {
    static var preview: SettingsViewModel {
        let vm = SettingsViewModel()
        vm.settings = Settings(
            pushNotificationsEnabled: true,
            biometricLoginEnabled: false,
            autoPayEnabled: false,
            paymentReminders: true,
            marketingEmails: false
        )
        return vm
    }

    static var previewAllEnabled: SettingsViewModel {
        let vm = SettingsViewModel()
        vm.settings = Settings(
            pushNotificationsEnabled: true,
            biometricLoginEnabled: true,
            autoPayEnabled: true,
            paymentReminders: true,
            marketingEmails: true
        )
        return vm
    }
}
