/// SupabaseAuthService.swift
/// Flent Secured v2 - Supabase Authentication Service Implementation
///
/// Implements AuthServiceProtocol using Supabase Edge Functions
/// Calls auth-otp Edge Function for OTP-based authentication

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

    func sendOTP(to phone: String) async throws -> OTPSendResult {
        // Validate phone
        let cleanPhone = normalizePhone(phone)
        guard isValidPhone(cleanPhone) else {
            throw AuthError.invalidPhone
        }

        // Call auth-otp Edge Function
        let request = AuthOTPRequest(
            action: "send_otp",
            phoneNumber: cleanPhone
        )

        do {
            let response: OTPSendResult = try await supabase.client.functions.invoke(
                "auth-otp",
                options: FunctionInvokeOptions(body: request)
            )
            return response
        } catch {
            throw mapError(error)
        }
    }

    func verifyOTP(phone: String, otp: String, consentForMobile360: Bool) async throws -> AuthResult {
        // Validate inputs
        let cleanPhone = normalizePhone(phone)
        guard isValidPhone(cleanPhone) else {
            throw AuthError.invalidPhone
        }

        guard otp.count == 6, otp.allSatisfy(\.isNumber) else {
            throw AuthError.invalidOTP
        }

        // Call auth-otp Edge Function
        let request = VerifyOTPRequest(
            action: "verify_otp",
            phoneNumber: cleanPhone,
            otp: otp,
            consentForMobile360: consentForMobile360
        )

        do {
            let response: AuthResult = try await supabase.client.functions.invoke(
                "auth-otp",
                options: FunctionInvokeOptions(body: request)
            )

            // If successful, store the user ID for later use
            // Note: The backend verifies the OTP but doesn't return a full session
            // The app should use Supabase Auth directly for session management
            if response.success, let userId = response.userId {
                // Store user ID in SecureStorage
                SecureStorage.shared.saveUserId(userId)
            }

            return response
        } catch {
            throw mapError(error)
        }
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
            throw mapError(error)
        }
    }

    // MARK: - Private Helpers

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

    private func isValidPhone(_ phone: String) -> Bool {
        // Must be +91 followed by 10 digits
        let pattern = #"^\+91[6-9]\d{9}$"#
        return phone.range(of: pattern, options: .regularExpression) != nil
    }

    private func mapError(_ error: Error) -> AuthError {
        if let functionError = error as? FunctionsError {
            switch functionError {
            case .httpError(let code, let data):
                if let response = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    return .serverError(response.error ?? "Unknown error")
                }
                return .serverError("HTTP Error \(code)")
            case .relayError:
                return .networkError(error)
            }
        }

        return .networkError(error)
    }
}

// MARK: - Request Types

private struct AuthOTPRequest: Encodable {
    let action: String
    let phoneNumber: String

    enum CodingKeys: String, CodingKey {
        case action
        case phoneNumber = "phone_number"
    }
}

private struct VerifyOTPRequest: Encodable {
    let action: String
    let phoneNumber: String
    let otp: String
    let consentForMobile360: Bool

    enum CodingKeys: String, CodingKey {
        case action
        case phoneNumber = "phone_number"
        case otp
        case consentForMobile360 = "consent_for_mobile360"
    }
}

private struct ErrorResponse: Decodable {
    let success: Bool
    let error: String?
}
