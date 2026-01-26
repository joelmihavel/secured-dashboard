/// AppEnvironment.swift
/// Flent Secured v2 - Dependency Injection Container
///
/// Provides centralized service management and dependency injection
/// Supports both production and test configurations

import Foundation
import Supabase

// MARK: - App Environment

/// Central dependency injection container for the app
/// Access services through this environment for testability
@MainActor
final class AppEnvironment: ObservableObject {

    // MARK: - Singleton

    static let shared: AppEnvironment = {
        #if DEBUG
        if useMockServices {
            return AppEnvironment.createTestEnvironment()
        }
        #endif
        return AppEnvironment()
    }()

    // MARK: - Services

    /// Authentication service
    let authService: AuthServiceProtocol

    /// User and dashboard service
    let userService: UserServiceProtocol

    /// Payment service
    let paymentService: PaymentServiceProtocol

    /// Verification service
    let verificationService: VerificationServiceProtocol

    // MARK: - Managers

    /// Supabase client manager
    let supabaseManager: SupabaseManager

    // MARK: - Initialization

    private init(
        authService: AuthServiceProtocol? = nil,
        userService: UserServiceProtocol? = nil,
        paymentService: PaymentServiceProtocol? = nil,
        verificationService: VerificationServiceProtocol? = nil,
        supabaseManager: SupabaseManager? = nil
    ) {
        let manager = supabaseManager ?? .shared
        self.supabaseManager = manager

        self.authService = authService ?? SupabaseAuthService(supabase: manager)
        self.userService = userService ?? UserService(supabase: manager)
        self.paymentService = paymentService ?? PaymentService(supabase: manager)
        self.verificationService = verificationService ?? VerificationService(supabase: manager)
    }

    // MARK: - Testing

    /// Create a mock environment for testing
    static func mock(
        authService: AuthServiceProtocol? = nil,
        userService: UserServiceProtocol? = nil,
        paymentService: PaymentServiceProtocol? = nil,
        verificationService: VerificationServiceProtocol? = nil
    ) -> AppEnvironment {
        AppEnvironment(
            authService: authService ?? MockAuthService(),
            userService: userService ?? MockUserService(),
            paymentService: paymentService ?? MockPaymentService(),
            verificationService: verificationService ?? MockVerificationService()
        )
    }

    /// Create a preview environment for SwiftUI Previews
    static var preview: AppEnvironment {
        mock()
    }

    #if DEBUG
    /// Create a test environment with properly configured mocks
    /// This is used when USE_MOCK_SERVICES=true environment variable is set
    static func createTestEnvironment() -> AppEnvironment {
        let mockAuth = TestModeAuthService()
        let mockUser = TestModeUserService(authService: mockAuth)
        let mockPayment = MockPaymentService()
        let mockVerification = MockVerificationService()

        print("[AppEnvironment] 🧪 Running in TEST MODE with mock services")

        return AppEnvironment(
            authService: mockAuth,
            userService: mockUser,
            paymentService: mockPayment,
            verificationService: mockVerification
        )
    }
    #endif
}

// MARK: - Environment Key

private struct AppEnvironmentKey: EnvironmentKey {
    static let defaultValue = AppEnvironment.shared
}

extension EnvironmentValues {
    var appEnvironment: AppEnvironment {
        get { self[AppEnvironmentKey.self] }
        set { self[AppEnvironmentKey.self] = newValue }
    }
}

// MARK: - View Extension

import SwiftUI

extension View {
    /// Injects the app environment into the view hierarchy
    func appEnvironment(_ environment: AppEnvironment) -> some View {
        self.environment(\.appEnvironment, environment)
    }
}

// MARK: - Service Accessors

extension AppEnvironment {
    /// Whether the user is currently authenticated
    var isAuthenticated: Bool {
        supabaseManager.isAuthenticated
    }

    /// Current user if authenticated
    var currentUser: User? {
        supabaseManager.currentUser
    }
}

// MARK: - Feature Flags

extension AppEnvironment {
    /// Whether to use mock services (for testing/preview)
    static var useMockServices: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.environment["USE_MOCK_SERVICES"] == "true"
        #else
        return false
        #endif
    }

    /// Whether to enable verbose logging
    static var verboseLogging: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
}

// MARK: - Logging

extension AppEnvironment {
    /// Log a debug message
    func log(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        guard Self.verboseLogging else { return }
        let filename = (file as NSString).lastPathComponent
        print("[AppEnvironment] [\(filename):\(line)] \(function) - \(message)")
    }
}
