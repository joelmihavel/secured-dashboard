/// AuthServiceProtocol.swift
/// Flent Secured v2 - Authentication Service Protocol
///
/// Defines the contract for authentication operations
/// Implemented by SupabaseAuthService and MockAuthService

import Foundation

// MARK: - Auth Service Protocol

protocol AuthServiceProtocol {
    /// Send OTP to phone number
    /// - Parameter phone: Phone number with country code (e.g., "+919999999999")
    /// - Returns: OTP send result
    func sendOTP(to phone: String) async throws -> OTPSendResult

    /// Verify OTP and sign in
    /// - Parameters:
    ///   - phone: Phone number with country code
    ///   - otp: 6-digit OTP code
    ///   - consentForMobile360: User consent for Mobile 360 identity fetch
    /// - Returns: Authentication result with session and user status
    func verifyOTP(phone: String, otp: String, consentForMobile360: Bool) async throws -> AuthResult

    /// Get current session
    func getCurrentSession() async -> SessionInfo?

    /// Sign out current user
    func signOut() async throws

    /// Check if user is authenticated
    var isAuthenticated: Bool { get async }
}

// MARK: - OTP Send Result

struct OTPSendResult: Codable {
    let success: Bool
    let data: OTPSendData?
    let error: String?

    struct OTPSendData: Codable {
        let verificationSid: String?
        let status: String
        let channel: String
        let phoneMasked: String
        let message: String

        enum CodingKeys: String, CodingKey {
            case verificationSid = "verification_sid"
            case status
            case channel
            case phoneMasked = "phone_masked"
            case message
        }
    }

    var message: String {
        data?.message ?? error ?? "Unknown error"
    }
}

// MARK: - Auth Result

struct AuthResult: Codable {
    let success: Bool
    let data: AuthResultData?
    let error: String?

    struct AuthResultData: Codable {
        let userId: String
        let isNewUser: Bool
        let consentVerificationId: String?
        let consentStatus: String?
        let message: String
        let nextSteps: [String]?

        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case isNewUser = "is_new_user"
            case consentVerificationId = "consent_verification_id"
            case consentStatus = "consent_status"
            case message
            case nextSteps = "next_steps"
        }
    }

    var isNewUser: Bool {
        data?.isNewUser ?? false
    }

    var userId: String? {
        data?.userId
    }
}

// MARK: - Session Info

struct SessionInfo: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: TimeInterval
    let user: UserInfo

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case user
    }

    var expiresAtDate: Date {
        Date(timeIntervalSince1970: expiresAt)
    }

    var isExpired: Bool {
        expiresAtDate < Date()
    }
}

// MARK: - User Info

struct UserInfo: Codable {
    let id: String
    let phone: String?
    let email: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case phone
        case email
        case createdAt = "created_at"
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case invalidPhone
    case invalidOTP
    case otpExpired
    case networkError(Error)
    case serverError(String)
    case sessionExpired
    case notAuthenticated

    var errorDescription: String? {
        switch self {
        case .invalidPhone:
            return "Please enter a valid 10-digit phone number"
        case .invalidOTP:
            return "Invalid OTP. Please try again"
        case .otpExpired:
            return "OTP has expired. Please request a new one"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        case .sessionExpired:
            return "Your session has expired. Please sign in again"
        case .notAuthenticated:
            return "You are not signed in"
        }
    }
}
