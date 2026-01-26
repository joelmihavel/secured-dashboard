/// ErrorHandling.swift
/// Flent Secured v2 - Centralized Error Handling
///
/// Provides unified error handling with:
/// - User-friendly error messages
/// - Retry logic with exponential backoff
/// - Error categorization
/// - Analytics integration (without exposing internals)

import Foundation

// MARK: - App Error

/// Unified error type that wraps all domain errors
enum AppError: LocalizedError, Equatable {
    // Network errors
    case noInternet
    case timeout
    case serverUnavailable

    // Auth errors
    case sessionExpired
    case notAuthenticated
    case invalidCredentials

    // Payment errors
    case paymentFailed(reason: String)
    case paymentCancelled
    case paymentInProgress
    case paymentAlreadyExists

    // Verification errors
    case verificationFailed(reason: String)
    case documentProcessingFailed
    case bankVerificationFailed
    case utilityVerificationFailed

    // Generic errors
    case validationError(String)
    case unknown(String)

    // MARK: - Error Description

    var errorDescription: String? {
        switch self {
        case .noInternet:
            return "No internet connection"
        case .timeout:
            return "Request timed out"
        case .serverUnavailable:
            return "Service temporarily unavailable"
        case .sessionExpired:
            return "Your session has expired"
        case .notAuthenticated:
            return "Please sign in to continue"
        case .invalidCredentials:
            return "Invalid phone number or OTP"
        case .paymentFailed(let reason):
            return reason
        case .paymentCancelled:
            return "Payment was cancelled"
        case .paymentInProgress:
            return "A payment is already in progress"
        case .paymentAlreadyExists:
            return "Payment already exists for this month"
        case .verificationFailed(let reason):
            return reason
        case .documentProcessingFailed:
            return "Failed to process your document"
        case .bankVerificationFailed:
            return "Bank verification failed"
        case .utilityVerificationFailed:
            return "Utility verification failed"
        case .validationError(let message):
            return message
        case .unknown(let message):
            return message.isEmpty ? "Something went wrong" : message
        }
    }

    // MARK: - User-Friendly Message

    /// A user-friendly message suitable for display in alerts
    var userMessage: String {
        switch self {
        case .noInternet:
            return "Please check your internet connection and try again."
        case .timeout:
            return "The request took too long. Please try again."
        case .serverUnavailable:
            return "Our servers are temporarily unavailable. Please try again later."
        case .sessionExpired:
            return "Your session has expired. Please sign in again."
        case .notAuthenticated:
            return "Please sign in to continue."
        case .invalidCredentials:
            return "The phone number or OTP you entered is invalid. Please try again."
        case .paymentFailed(let reason):
            return reason.isEmpty ? "Your payment could not be processed. Please try again." : reason
        case .paymentCancelled:
            return "You cancelled the payment. No amount was charged."
        case .paymentInProgress:
            return "You have a payment in progress. Please wait for it to complete."
        case .paymentAlreadyExists:
            return "You've already paid rent for this month."
        case .verificationFailed(let reason):
            return reason.isEmpty ? "Verification failed. Please try again." : reason
        case .documentProcessingFailed:
            return "We couldn't process your document. Please upload a clearer image."
        case .bankVerificationFailed:
            return "We couldn't verify your bank account. Please check your details."
        case .utilityVerificationFailed:
            return "We couldn't verify your utility connection. Please check your details."
        case .validationError(let message):
            return message
        case .unknown:
            return "Something went wrong. Please try again."
        }
    }

    // MARK: - Recovery Suggestions

    var recoverySuggestion: String? {
        switch self {
        case .noInternet:
            return "Check your Wi-Fi or mobile data connection"
        case .timeout:
            return "Try again when you have a better connection"
        case .serverUnavailable:
            return "Try again in a few minutes"
        case .sessionExpired, .notAuthenticated:
            return "Sign in to continue"
        case .paymentFailed:
            return "Try a different payment method"
        case .documentProcessingFailed:
            return "Upload a clearer photo of your agreement"
        case .bankVerificationFailed:
            return "Double-check your account number and IFSC code"
        case .utilityVerificationFailed:
            return "Verify your consumer number and provider"
        default:
            return nil
        }
    }

    // MARK: - Retryable

    /// Whether this error can be retried
    var isRetryable: Bool {
        switch self {
        case .noInternet, .timeout, .serverUnavailable:
            return true
        case .paymentFailed, .verificationFailed:
            return true
        case .sessionExpired, .notAuthenticated, .invalidCredentials:
            return false
        case .paymentCancelled, .paymentInProgress, .paymentAlreadyExists:
            return false
        case .validationError:
            return false
        case .documentProcessingFailed, .bankVerificationFailed, .utilityVerificationFailed:
            return true
        case .unknown:
            return true
        }
    }

    // MARK: - Requires Sign Out

    /// Whether this error requires the user to sign out
    var requiresSignOut: Bool {
        switch self {
        case .sessionExpired:
            return true
        default:
            return false
        }
    }

    // MARK: - Analytics Category

    /// Category for analytics tracking (doesn't expose internals)
    var analyticsCategory: String {
        switch self {
        case .noInternet, .timeout, .serverUnavailable:
            return "network"
        case .sessionExpired, .notAuthenticated, .invalidCredentials:
            return "auth"
        case .paymentFailed, .paymentCancelled, .paymentInProgress, .paymentAlreadyExists:
            return "payment"
        case .verificationFailed, .documentProcessingFailed, .bankVerificationFailed, .utilityVerificationFailed:
            return "verification"
        case .validationError:
            return "validation"
        case .unknown:
            return "unknown"
        }
    }

    // MARK: - Static comparison for Equatable

    static func == (lhs: AppError, rhs: AppError) -> Bool {
        switch (lhs, rhs) {
        case (.noInternet, .noInternet),
             (.timeout, .timeout),
             (.serverUnavailable, .serverUnavailable),
             (.sessionExpired, .sessionExpired),
             (.notAuthenticated, .notAuthenticated),
             (.invalidCredentials, .invalidCredentials),
             (.paymentCancelled, .paymentCancelled),
             (.paymentInProgress, .paymentInProgress),
             (.paymentAlreadyExists, .paymentAlreadyExists),
             (.documentProcessingFailed, .documentProcessingFailed),
             (.bankVerificationFailed, .bankVerificationFailed),
             (.utilityVerificationFailed, .utilityVerificationFailed):
            return true
        case (.paymentFailed(let l), .paymentFailed(let r)):
            return l == r
        case (.verificationFailed(let l), .verificationFailed(let r)):
            return l == r
        case (.validationError(let l), .validationError(let r)):
            return l == r
        case (.unknown(let l), .unknown(let r)):
            return l == r
        default:
            return false
        }
    }
}

// MARK: - Error Mapping

extension AppError {

    /// Create AppError from any Error
    static func from(_ error: Error) -> AppError {
        // Check for URLError (network errors)
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return .noInternet
            case .timedOut:
                return .timeout
            case .cannotConnectToHost, .cannotFindHost:
                return .serverUnavailable
            default:
                return .unknown(urlError.localizedDescription)
            }
        }

        // Check for domain-specific errors
        if let authError = error as? AuthError {
            return mapAuthError(authError)
        }

        if let paymentError = error as? PaymentServiceError {
            return mapPaymentError(paymentError)
        }

        if let verificationError = error as? VerificationServiceError {
            return mapVerificationError(verificationError)
        }

        if let userError = error as? UserServiceError {
            return mapUserError(userError)
        }

        // Default
        return .unknown(error.localizedDescription)
    }

    private static func mapAuthError(_ error: AuthError) -> AppError {
        switch error {
        case .invalidPhone, .invalidOTP:
            return .invalidCredentials
        case .otpExpired:
            return .invalidCredentials
        case .sessionExpired:
            return .sessionExpired
        case .notAuthenticated:
            return .notAuthenticated
        case .networkError(let underlying):
            return from(underlying)
        case .serverError(let message):
            return .unknown(message)
        }
    }

    private static func mapPaymentError(_ error: PaymentServiceError) -> AppError {
        switch error {
        case .notAuthenticated:
            return .notAuthenticated
        case .tenancyNotFound:
            return .unknown("No active tenancy found")
        case .paymentNotFound:
            return .unknown("Payment not found")
        case .paymentAlreadyExists:
            return .paymentAlreadyExists
        case .paymentInProgress:
            return .paymentInProgress
        case .invalidPaymentMethod:
            return .paymentFailed(reason: "Selected payment method is not available")
        case .verificationRequired:
            return .verificationFailed(reason: "Please complete verification first")
        case .networkError(let underlying):
            return from(underlying)
        case .serverError(let message):
            return .paymentFailed(reason: message)
        }
    }

    private static func mapVerificationError(_ error: VerificationServiceError) -> AppError {
        switch error {
        case .notAuthenticated:
            return .notAuthenticated
        case .tenancyNotFound:
            return .unknown("No active tenancy found")
        case .invalidBankDetails:
            return .bankVerificationFailed
        case .bankVerificationFailed(let message):
            return message.isEmpty ? .bankVerificationFailed : .verificationFailed(reason: message)
        case .utilityVerificationFailed(let message):
            return message.isEmpty ? .utilityVerificationFailed : .verificationFailed(reason: message)
        case .inviteFailed(let message):
            return .verificationFailed(reason: message.isEmpty ? "Failed to send landlord invite" : message)
        case .alreadyVerified:
            return .validationError("This verification is already complete")
        case .networkError(let underlying):
            return from(underlying)
        case .serverError(let message):
            return .unknown(message)
        }
    }

    private static func mapUserError(_ error: UserServiceError) -> AppError {
        switch error {
        case .notAuthenticated:
            return .notAuthenticated
        case .userNotFound:
            return .sessionExpired
        case .tenancyNotFound:
            return .unknown("No active tenancy found")
        case .networkError(let underlying):
            return from(underlying)
        case .serverError(let message):
            return .unknown(message)
        }
    }
}

// MARK: - Retry Handler

/// Handles retry logic with exponential backoff
actor RetryHandler {

    struct Configuration {
        let maxRetries: Int
        let baseDelay: TimeInterval
        let maxDelay: TimeInterval
        let shouldRetry: (Error) -> Bool

        static let `default` = Configuration(
            maxRetries: 3,
            baseDelay: 1.0,
            maxDelay: 30.0,
            shouldRetry: { error in
                let appError = AppError.from(error)
                return appError.isRetryable
            }
        )

        static let payment = Configuration(
            maxRetries: 2,
            baseDelay: 2.0,
            maxDelay: 10.0,
            shouldRetry: { error in
                let appError = AppError.from(error)
                // Don't retry most payment errors
                switch appError {
                case .noInternet, .timeout, .serverUnavailable:
                    return true
                default:
                    return false
                }
            }
        )
    }

    /// Execute an async operation with retry logic
    func execute<T>(
        configuration: Configuration = .default,
        operation: @Sendable () async throws -> T
    ) async throws -> T {
        var lastError: Error?

        for attempt in 0..<configuration.maxRetries {
            do {
                return try await operation()
            } catch {
                lastError = error

                // Check if we should retry
                guard configuration.shouldRetry(error) else {
                    throw error
                }

                // Calculate delay with exponential backoff
                let delay = min(
                    configuration.baseDelay * pow(2.0, Double(attempt)),
                    configuration.maxDelay
                )

                // Add jitter to prevent thundering herd
                let jitter = Double.random(in: 0...0.3) * delay
                let totalDelay = delay + jitter

                // Wait before retrying
                try await Task.sleep(nanoseconds: UInt64(totalDelay * 1_000_000_000))
            }
        }

        throw lastError ?? AppError.unknown("Retry exhausted")
    }
}

// MARK: - Error Alert

/// Alert data for displaying errors
struct ErrorAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let primaryAction: AlertAction?
    let secondaryAction: AlertAction?

    struct AlertAction {
        let title: String
        let style: ActionStyle
        let action: () -> Void

        enum ActionStyle {
            case `default`
            case cancel
            case destructive
        }
    }

    static func from(_ error: AppError, retryAction: (() -> Void)? = nil) -> ErrorAlert {
        var primaryAction: AlertAction? = nil
        var secondaryAction: AlertAction? = nil

        if error.isRetryable, let retry = retryAction {
            primaryAction = AlertAction(title: "Retry", style: .default, action: retry)
            secondaryAction = AlertAction(title: "Cancel", style: .cancel, action: {})
        } else if error.requiresSignOut {
            primaryAction = AlertAction(title: "Sign In", style: .default, action: {
                // This will be handled by the coordinator
                NotificationCenter.default.post(name: .signOutRequired, object: nil)
            })
        }

        return ErrorAlert(
            title: error.errorDescription ?? "Error",
            message: error.userMessage,
            primaryAction: primaryAction,
            secondaryAction: secondaryAction
        )
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let signOutRequired = Notification.Name("signOutRequired")
    static let sessionExpired = Notification.Name("sessionExpired")
}

// MARK: - Error Logger

/// Logs errors without exposing sensitive information
final class ErrorLogger {
    static let shared = ErrorLogger()

    private init() {}

    /// Log an error for analytics (sanitizes sensitive data)
    func log(_ error: Error, context: [String: String] = [:]) {
        let appError = AppError.from(error)

        // Create sanitized context
        var sanitizedContext = context

        // Remove any potentially sensitive keys
        let sensitiveKeys = ["phone", "email", "account", "ifsc", "consumer", "otp"]
        for key in sanitizedContext.keys {
            if sensitiveKeys.contains(where: { key.lowercased().contains($0) }) {
                sanitizedContext[key] = "[REDACTED]"
            }
        }

        // Log to analytics (PostHog or Sentry would go here)
        #if DEBUG
        print("📛 [Error] Category: \(appError.analyticsCategory)")
        print("   Message: \(appError.errorDescription ?? "Unknown")")
        print("   Retryable: \(appError.isRetryable)")
        if !sanitizedContext.isEmpty {
            print("   Context: \(sanitizedContext)")
        }
        #endif

        // In production, this would send to Sentry or analytics
        // SentrySDK.capture(error: error)
        // PostHogSDK.shared.capture("error", properties: sanitizedContext)
    }
}
