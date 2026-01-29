/// AppState.swift
/// Flent Secured v2 - Global App State
///
/// Centralized state management using iOS 17+ @Observable
/// Handles authentication state, user data, and global flags

import SwiftUI
import Observation
import Combine
import os.log

private let logger = Logger(subsystem: "app.flent.secured", category: "AppState")

// MARK: - App State

@Observable
final class AppState {

    // MARK: - Authentication State

    /// Whether the user is authenticated
    var isAuthenticated: Bool = false

    /// Current user ID (from Supabase)
    var userId: String?

    /// Current session token
    var accessToken: String?

    // MARK: - User State

    /// Current user status
    var userStatus: UserStatus? = nil

    /// User profile data
    var userProfile: UserProfile?

    /// Current tenancy
    var currentTenancy: Tenancy?

    // MARK: - Onboarding State

    /// Name entered during phone entry (before profile is created)
    /// Used to pre-fill NameVerificationView
    var pendingUserName: String?

    // MARK: - App State

    /// Whether the app has finished initializing
    var isInitialized: Bool = false

    /// Whether the app is in loading state
    var isLoading: Bool = false

    // MARK: - Error Handling

    /// Current error to display
    private(set) var currentError: AppError?

    /// Error alert for display
    var errorAlert: ErrorAlert?

    /// Legacy: Global error message to display
    var errorMessage: String?

    /// Legacy: Whether to show error alert
    var showError: Bool = false

    // MARK: - Feature Flags

    /// Feature flags from backend
    var featureFlags: FeatureFlags = .default

    // MARK: - Notification Observers

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    @MainActor
    func initialize() async {
        isLoading = true

        // Try to restore session from Keychain
        do {
            let restored = try await restoreSession()
            if restored {
                await loadUserData()
            }
        } catch {
            print("Session restoration failed: \(error)")
        }

        isLoading = false
        isInitialized = true
    }

    // MARK: - Session Management

    @MainActor
    func setSession(userId: String, accessToken: String) async {
        self.userId = userId
        self.accessToken = accessToken
        self.isAuthenticated = true

        // Save to Keychain
        SecureStorage.shared.saveSession(userId: userId, accessToken: accessToken)

        await loadUserData()
    }

    @MainActor
    func clearSession() {
        userId = nil
        accessToken = nil
        isAuthenticated = false
        userStatus = .unknown
        userProfile = nil
        currentTenancy = nil

        // Clear from Keychain
        SecureStorage.shared.clearSession()
    }

    // MARK: - Private Helpers

    @MainActor
    private func restoreSession() async throws -> Bool {
        guard let session = SecureStorage.shared.getSession() else {
            return false
        }

        self.userId = session.userId
        self.accessToken = session.accessToken
        self.isAuthenticated = true

        return true
    }

    @MainActor
    private func loadUserData() async {
        guard isAuthenticated else { return }

        // This will be implemented when we create the UserService
        // For now, just mark as needing implementation
        // await userService.fetchCurrentUser()
    }

    // MARK: - Error Handling

    /// Show an error with optional retry action
    @MainActor
    func handle(_ error: Error, retryAction: (() -> Void)? = nil) {
        let appError = AppError.from(error)
        currentError = appError

        // Log the error (sanitized)
        ErrorLogger.shared.log(error)

        // Handle session expiration
        if appError.requiresSignOut {
            Task { @MainActor in
                clearSession()
                NotificationCenter.default.post(name: .sessionExpired, object: nil)
            }
            return
        }

        // Create and show alert
        errorAlert = ErrorAlert.from(appError, retryAction: retryAction)

        // Legacy support
        errorMessage = appError.userMessage
        showError = true
    }

    /// Show error from AppError directly
    @MainActor
    func show(_ error: AppError, retryAction: (() -> Void)? = nil) {
        currentError = error

        // Log the error
        ErrorLogger.shared.log(error)

        // Handle session expiration
        if error.requiresSignOut {
            Task { @MainActor in
                clearSession()
                NotificationCenter.default.post(name: .sessionExpired, object: nil)
            }
            return
        }

        errorAlert = ErrorAlert.from(error, retryAction: retryAction)
        errorMessage = error.userMessage
        showError = true
    }

    /// Legacy: Show error message string
    @MainActor
    func showError(_ message: String) {
        errorMessage = message
        showError = true
    }

    @MainActor
    func dismissError() {
        currentError = nil
        errorAlert = nil
        errorMessage = nil
        showError = false
    }

    // MARK: - Setup Notification Observers

    func setupNotificationObservers() {
        // Listen for sign out required notifications
        NotificationCenter.default.publisher(for: .signOutRequired)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.clearSession()
                }
            }
            .store(in: &cancellables)
    }
}

// Note: UserStatus, UserProfile, Tenancy, TenancyStatus, and FeatureFlags
// are defined in their respective model files in Core/Models/
