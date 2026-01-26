/// VerificationService.swift
/// Flent Secured v2 - Verification Service Implementation
///
/// Implements VerificationServiceProtocol using Supabase Edge Functions
/// Handles bank, utility, and landlord verification

import Foundation
import Supabase

// MARK: - Verification Service

final class VerificationService: VerificationServiceProtocol {

    // MARK: - Properties

    private let supabase: SupabaseManager

    // MARK: - Initialization

    init(supabase: SupabaseManager = .shared) {
        self.supabase = supabase
    }

    // MARK: - VerificationServiceProtocol

    func verifyBank(
        tenancyId: String,
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        partyType: PartyType
    ) async throws -> BankVerificationResult {
        guard await supabase.checkIsAuthenticated() else {
            throw VerificationServiceError.notAuthenticated
        }

        // Validate IFSC format
        guard isValidIFSC(ifscCode) else {
            throw VerificationServiceError.invalidBankDetails
        }

        let request = VerifyBankRequest(
            tenancyId: tenancyId,
            accountHolderName: accountHolderName,
            accountNumber: accountNumber,
            ifscCode: ifscCode.uppercased(),
            partyType: partyType.rawValue
        )

        do {
            let response: VerifyBankResponse = try await supabase.client.functions.invoke(
                "verify-bank",
                options: FunctionInvokeOptions(body: request)
            )

            guard response.success, let data = response.data else {
                throw VerificationServiceError.bankVerificationFailed(
                    response.error ?? "Verification failed"
                )
            }

            return data
        } catch let error as VerificationServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func getUtilityOperators() async throws -> [UtilityOperator] {
        // This endpoint doesn't require authentication
        do {
            let response: UtilityOperatorsResponse = try await supabase.client.functions.invoke(
                "verify-utility",
                options: FunctionInvokeOptions(
                    method: .get,
                    query: [URLQueryItem(name: "action", value: "operators")]
                )
            )

            guard response.success, let data = response.data else {
                throw VerificationServiceError.serverError(
                    response.error ?? "Failed to fetch operators"
                )
            }

            return data.operators
        } catch let error as VerificationServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func verifyUtility(
        tenancyId: String,
        consumerNumber: String,
        operatorCode: String
    ) async throws -> UtilityVerificationResult {
        guard await supabase.checkIsAuthenticated() else {
            throw VerificationServiceError.notAuthenticated
        }

        let request = VerifyUtilityRequest(
            tenancyId: tenancyId,
            consumerNumber: consumerNumber,
            operatorCode: operatorCode
        )

        do {
            let response: VerifyUtilityResponse = try await supabase.client.functions.invoke(
                "verify-utility",
                options: FunctionInvokeOptions(body: request)
            )

            guard response.success, let data = response.data else {
                throw VerificationServiceError.utilityVerificationFailed(
                    response.error ?? "Verification failed"
                )
            }

            return data
        } catch let error as VerificationServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func sendLandlordInvite(
        tenancyId: String,
        channel: InviteChannel
    ) async throws -> LandlordInviteResult {
        guard await supabase.checkIsAuthenticated() else {
            throw VerificationServiceError.notAuthenticated
        }

        let request = SendInviteRequest(
            tenancyId: tenancyId,
            channel: channel.rawValue
        )

        do {
            let response: SendInviteResponse = try await supabase.client.functions.invoke(
                "send-landlord-invite",
                options: FunctionInvokeOptions(body: request)
            )

            guard response.success, let data = response.data else {
                throw VerificationServiceError.inviteFailed(
                    response.error ?? "Failed to send invite"
                )
            }

            return data
        } catch let error as VerificationServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func getVerificationStatus(tenancyId: String) async throws -> VerificationStatus {
        guard await supabase.checkIsAuthenticated() else {
            throw VerificationServiceError.notAuthenticated
        }

        do {
            let status: VerificationStatus = try await supabase.client
                .from("tenancies")
                .select("""
                    tenancy_id:id,
                    bank_verified,
                    utility_verified,
                    landlord_approved,
                    bank_verification_date,
                    utility_verification_date,
                    landlord_approval_date
                """)
                .eq("id", value: tenancyId)
                .single()
                .execute()
                .value

            return status
        } catch {
            if let postgrestError = error as? PostgrestError {
                if postgrestError.message.contains("no rows") {
                    throw VerificationServiceError.tenancyNotFound
                }
            }
            throw mapError(error)
        }
    }

    // MARK: - Private Helpers

    private func isValidIFSC(_ ifsc: String) -> Bool {
        // IFSC: 4 letters + 0 + 6 alphanumeric characters
        let pattern = #"^[A-Z]{4}0[A-Z0-9]{6}$"#
        return ifsc.uppercased().range(of: pattern, options: .regularExpression) != nil
    }

    private func mapError(_ error: Error) -> VerificationServiceError {
        if let postgrestError = error as? PostgrestError {
            return .serverError(postgrestError.message)
        }

        if let functionError = error as? FunctionsError {
            switch functionError {
            case .httpError(_, let data):
                if let response = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    return .serverError(response.error ?? "Unknown error")
                }
                return .serverError("Server error")
            case .relayError:
                return .networkError(error)
            }
        }

        return .networkError(error)
    }
}

// MARK: - Request Types

private struct VerifyBankRequest: Encodable {
    let tenancyId: String
    let accountHolderName: String
    let accountNumber: String
    let ifscCode: String
    let partyType: String

    enum CodingKeys: String, CodingKey {
        case tenancyId = "tenancy_id"
        case accountHolderName = "account_holder_name"
        case accountNumber = "account_number"
        case ifscCode = "ifsc_code"
        case partyType = "party_type"
    }
}

private struct VerifyUtilityRequest: Encodable {
    let tenancyId: String
    let consumerNumber: String
    let operatorCode: String

    enum CodingKeys: String, CodingKey {
        case tenancyId = "tenancy_id"
        case consumerNumber = "consumer_number"
        case operatorCode = "operator_code"
    }
}

private struct SendInviteRequest: Encodable {
    let tenancyId: String
    let channel: String

    enum CodingKeys: String, CodingKey {
        case tenancyId = "tenancy_id"
        case channel
    }
}

// MARK: - Response Types

private struct VerifyBankResponse: Decodable {
    let success: Bool
    let data: BankVerificationResult?
    let error: String?
}

private struct UtilityOperatorsResponse: Decodable {
    let success: Bool
    let data: OperatorsData?
    let error: String?

    struct OperatorsData: Decodable {
        let operators: [UtilityOperator]
    }
}

private struct VerifyUtilityResponse: Decodable {
    let success: Bool
    let data: UtilityVerificationResult?
    let error: String?
}

private struct SendInviteResponse: Decodable {
    let success: Bool
    let data: LandlordInviteResult?
    let error: String?
}

private struct ErrorResponse: Decodable {
    let success: Bool
    let error: String?
}
