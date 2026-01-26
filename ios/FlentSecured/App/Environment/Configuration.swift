/// Configuration.swift
/// Flent Secured v2 - Environment Configuration
///
/// Reads configuration values from Info.plist (set via xcconfig files)
/// CRITICAL: Never hardcode API keys in code
///
/// Usage:
/// ```swift
/// let url = Configuration.supabaseURL
/// let key = Configuration.supabaseAnonKey
/// ```

import Foundation

// MARK: - Configuration

enum Configuration {

    // MARK: - Test Detection

    /// Whether we're running in a test environment
    private static var isRunningTests: Bool {
        NSClassFromString("XCTestCase") != nil
    }

    // MARK: - Supabase

    /// Supabase project URL
    static var supabaseURL: URL {
        if let urlString = Bundle.main.infoDictionary?["SUPABASE_URL"] as? String,
           !urlString.isEmpty,
           let url = URL(string: urlString) {
            return url
        }

        // In test environment, return a placeholder URL
        if isRunningTests {
            return URL(string: "https://test.supabase.co")!
        }

        fatalError("SUPABASE_URL not configured in Info.plist")
    }

    /// Supabase anonymous key (public)
    static var supabaseAnonKey: String {
        if let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String,
           !key.isEmpty {
            return key
        }

        // In test environment, return a placeholder key
        if isRunningTests {
            return "test-anon-key"
        }

        fatalError("SUPABASE_ANON_KEY not configured in Info.plist")
    }

    // MARK: - PayU

    /// PayU merchant key
    static var payuMerchantKey: String {
        guard let key = Bundle.main.infoDictionary?["PAYU_MERCHANT_KEY"] as? String,
              !key.isEmpty else {
            #if DEBUG
            return "" // Allow empty in debug for testing
            #else
            fatalError("PAYU_MERCHANT_KEY not configured in Info.plist")
            #endif
        }
        return key
    }

    /// PayU base URL
    static var payuBaseURL: URL {
        guard let urlString = Bundle.main.infoDictionary?["PAYU_BASE_URL"] as? String,
              !urlString.isEmpty,
              let url = URL(string: urlString) else {
            // Default to sandbox
            return URL(string: "https://sandboxsecure.payu.in")!
        }
        return url
    }

    // MARK: - Environment

    /// Current API environment
    static var environment: Environment {
        guard let env = Bundle.main.infoDictionary?["API_ENVIRONMENT"] as? String else {
            #if DEBUG
            return .development
            #else
            return .production
            #endif
        }
        return Environment(rawValue: env) ?? .development
    }

    /// Whether debug features are enabled
    static var isDebugEnabled: Bool {
        #if DEBUG
        return Bundle.main.infoDictionary?["ENABLE_DEBUG_FEATURES"] as? String == "YES"
        #else
        return false
        #endif
    }

    /// Whether mock data should be used
    static var useMockData: Bool {
        #if DEBUG
        return Bundle.main.infoDictionary?["ENABLE_MOCK_DATA"] as? String == "YES"
        #else
        return false
        #endif
    }

    // MARK: - App Info

    /// App version string
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    /// Build number
    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    /// Full version string (e.g., "1.0.0 (42)")
    static var fullVersion: String {
        "\(appVersion) (\(buildNumber))"
    }
}

// MARK: - Environment Type

extension Configuration {
    enum Environment: String {
        case development
        case staging
        case production

        var isProduction: Bool {
            self == .production
        }
    }
}
