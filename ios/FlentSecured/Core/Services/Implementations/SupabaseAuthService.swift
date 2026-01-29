/// SupabaseAuthService.swift
/// Flent Secured v2 - Supabase Authentication Service Implementation
///
/// Implements AuthServiceProtocol using Supabase Auth directly.
/// Uses Supabase's built-in phone OTP with Twilio Verify integration.
///
/// ## Authentication Flow
/// 1. `sendOTP(to:)` → Calls `supabase.auth.signInWithOTP(phone:)`
/// 2. `verifyOTP(phone:otp:)` → Calls `supabase.auth.verifyOTP(phone:token:type:)`
///
/// ## Test Phone Numbers
/// Test numbers are configured in Supabase Dashboard (Authentication → Providers → Phone):
/// - 919999999999=000000  (use +919999999999 with OTP 000000)
/// - 916362877970=000000
///
/// ## Important Notes
/// - This service uses Supabase Auth's native phone authentication
/// - Twilio Verify is configured in Supabase Dashboard, not in Edge Functions
/// - Test numbers bypass Twilio and accept the configured OTP directly
/// - Mobile 360 consent is recorded separately after successful auth
///
/// ## Migration from Edge Function
/// Previously this service called the `auth-otp` Edge Function which directly
/// called Twilio Verify API. That approach bypassed Supabase Auth's test number
/// support. Now we use Supabase Auth directly to leverage Dashboard configuration.

import Foundation
import Supabase

// MARK: - Supabase Auth Service

final class SupabaseAuthService: AuthServiceProtocol {

    // MARK: - Properties

    private let supabase: SupabaseManager

    // MARK: - Initialization

    init(supabase: SupabaseManager = .shared) {
        self.supabase = supabase
    }

    // MARK: - AuthServiceProtocol

    var isAuthenticated: Bool {
        get async {
            await supabase.currentSession != nil
        }
    }

    /// Send OTP to phone number using Supabase Auth
    ///
    /// This calls Supabase Auth's `signInWithOTP` which uses the Twilio Verify
    /// configuration from the Dashboard. Test phone numbers configured in the
    /// Dashboard will bypass Twilio and work with their assigned OTPs.
    ///
    /// - Parameter phone: Phone number (10 digits or with +91 prefix)
    /// - Returns: OTP send result with masked phone and status
    func sendOTP(to phone: String) async throws -> OTPSendResult {
        // Validate and normalize phone
        let cleanPhone = normalizePhone(phone)
        guard isValidPhone(cleanPhone) else {
            throw AuthError.invalidPhone
        }

        do {
            // Call Supabase Auth to send OTP via configured provider (Twilio Verify)
            try await supabase.client.auth.signInWithOTP(
                phone: cleanPhone,
                channel: .sms,
                shouldCreateUser: true
            )

            // Return success result
            let maskedPhone = "XXXXXX" + cleanPhone.suffix(4)
            return OTPSendResult(
                success: true,
                data: OTPSendResult.OTPSendData(
                    verificationSid: nil, // Not available from Supabase Auth
                    status: "pending",
                    channel: "sms",
                    phoneMasked: maskedPhone,
                    message: "OTP sent via SMS. Please verify to continue."
                ),
                error: nil
            )
        } catch let error as AuthError {
            throw error
        } catch {
            throw mapSupabaseError(error)
        }
    }

    /// Verify OTP and sign in using Supabase Auth
    ///
    /// This calls Supabase Auth's `verifyOTP` which validates the OTP against
    /// the Twilio Verify service (or test configuration). On success, a session
    /// is automatically created and stored.
    ///
    /// - Parameters:
    ///   - phone: Phone number used to request OTP
    ///   - otp: 6-digit OTP code (use "000000" for test numbers)
    ///   - consentForMobile360: User consent for Mobile 360 identity fetch
    /// - Returns: Authentication result with user ID and session status
    func verifyOTP(phone: String, otp: String, consentForMobile360: Bool) async throws -> AuthResult {
        // Validate inputs
        let cleanPhone = normalizePhone(phone)
        guard isValidPhone(cleanPhone) else {
            throw AuthError.invalidPhone
        }

        guard otp.count == 6, otp.allSatisfy(\.isNumber) else {
            throw AuthError.invalidOTP
        }

        do {
            // Verify OTP with Supabase Auth - this creates a session automatically
            let authResponse = try await supabase.client.auth.verifyOTP(
                phone: cleanPhone,
                token: otp,
                type: .sms
            )

            let user = authResponse.user
            let userId = user.id.uuidString

            // Store user ID in SecureStorage
            SecureStorage.shared.saveUserId(userId)

            // Wait for session to be available before making authenticated requests
            // The SDK stores the session asynchronously after verifyOTP returns
            print("[SupabaseAuthService] verifyOTP succeeded, waiting for session to propagate...")
            try await waitForSession(maxAttempts: 10, delayMs: 100)
            print("[SupabaseAuthService] Session is now available")

            // Record Mobile 360 consent if requested
            if consentForMobile360 {
                await recordMobile360Consent(userId: userId, phone: cleanPhone)
            }

            // Determine if this is a new user (created within last 5 seconds)
            let isNewUser = Date().timeIntervalSince(user.createdAt) < 5

            return AuthResult(
                success: true,
                data: AuthResult.AuthResultData(
                    userId: userId,
                    isNewUser: isNewUser,
                    consentVerificationId: nil, // Will be set by consent recording
                    consentStatus: consentForMobile360 ? "CONSENT_GIVEN" : nil,
                    message: "Phone verified successfully. You are now signed in.",
                    nextSteps: consentForMobile360
                        ? ["identity_verification_ready"]
                        : ["identity_verification_requires_separate_consent"]
                ),
                error: nil
            )
        } catch let error as AuthError {
            throw error
        } catch {
            throw mapSupabaseError(error)
        }
    }

    /// Wait for the session to become available after authentication
    /// The Supabase SDK stores sessions asynchronously, so we need to poll
    /// Uses direct client access to avoid MainActor isolation issues
    private func waitForSession(maxAttempts: Int, delayMs: UInt64) async throws {
        for attempt in 1...maxAttempts {
            // Access client.auth.session directly to avoid MainActor isolation issues
            if let session = try? await supabase.client.auth.session {
                print("[SupabaseAuthService] Session available after \(attempt) attempt(s), user: \(session.user.id)")
                return
            }
            print("[SupabaseAuthService] Waiting for session... attempt \(attempt)/\(maxAttempts)")
            try await Task.sleep(nanoseconds: delayMs * 1_000_000)
        }
        print("[SupabaseAuthService] WARNING: Session not available after \(maxAttempts) attempts, proceeding anyway")
    }

    func getCurrentSession() async -> SessionInfo? {
        guard let session = await supabase.currentSession else {
            return nil
        }

        return SessionInfo(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt,
            user: UserInfo(
                id: session.user.id.uuidString,
                phone: session.user.phone,
                email: session.user.email,
                createdAt: session.user.createdAt.ISO8601Format()
            )
        )
    }

    func signOut() async throws {
        do {
            try await supabase.signOut()
            SecureStorage.shared.clearSession()
        } catch {
            throw mapSupabaseError(error)
        }
    }

    // MARK: - Private Helpers

    /// Normalize phone number to +91XXXXXXXXXX format
    private func normalizePhone(_ phone: String) -> String {
        var clean = phone.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")

        // Add +91 if not present
        if !clean.hasPrefix("+") {
            if clean.hasPrefix("91") && clean.count == 12 {
                clean = "+" + clean
            } else if clean.count == 10 {
                clean = "+91" + clean
            }
        }

        return clean
    }

    /// Validate phone number format (+91 followed by 10 digits starting with 6-9)
    private func isValidPhone(_ phone: String) -> Bool {
        let pattern = #"^\+91[6-9]\d{9}$"#
        return phone.range(of: pattern, options: .regularExpression) != nil
    }

    /// Map Supabase errors to AuthError
    private func mapSupabaseError(_ error: Error) -> AuthError {
        let errorMessage = error.localizedDescription.lowercased()

        // Check for common OTP errors
        if errorMessage.contains("otp") && errorMessage.contains("expired") {
            return .otpExpired
        }
        if errorMessage.contains("otp") || errorMessage.contains("token") {
            return .invalidOTP
        }
        if errorMessage.contains("phone") && errorMessage.contains("invalid") {
            return .invalidPhone
        }
        if errorMessage.contains("rate") || errorMessage.contains("limit") {
            return .serverError("Too many attempts. Please wait before trying again.")
        }

        // Check for network errors
        if let urlError = error as? URLError {
            return .networkError(urlError)
        }

        // Default to server error
        return .serverError(error.localizedDescription)
    }

    /// Record Mobile 360 consent in identity_verifications table
    private func recordMobile360Consent(userId: String, phone: String) async {
        print("[SupabaseAuthService] recordMobile360Consent - Starting for userId: \(userId)")

        // Check current session state - access client directly to avoid MainActor issues
        if let session = try? await supabase.client.auth.session {
            print("[SupabaseAuthService] recordMobile360Consent - Session user id: \(session.user.id)")
            print("[SupabaseAuthService] recordMobile360Consent - Session access token prefix: \(String(session.accessToken.prefix(20)))...")
        } else {
            print("[SupabaseAuthService] recordMobile360Consent - WARNING: No session!")
        }

        do {
            // Sanitize phone (remove +91 prefix for storage)
            let sanitizedPhone = phone.hasPrefix("+91")
                ? String(phone.dropFirst(3))
                : phone

            print("[SupabaseAuthService] recordMobile360Consent - Inserting consent record")

            // Insert consent record
            try await supabase.client
                .from("identity_verifications")
                .insert([
                    "user_id": userId,
                    "verification_id": "CONSENT_\(Int(Date().timeIntervalSince1970))_\(UUID().uuidString.prefix(8))",
                    "status": "CONSENT_GIVEN",
                    "consent_phone": sanitizedPhone,
                    "consent_timestamp": ISO8601DateFormatter().string(from: Date()),
                ])
                .execute()

            print("[SupabaseAuthService] Mobile 360 consent recorded for user: \(userId)")
        } catch {
            // Log but don't fail auth if consent recording fails
            print("[SupabaseAuthService] Failed to record consent: \(error)")
        }
    }
}
