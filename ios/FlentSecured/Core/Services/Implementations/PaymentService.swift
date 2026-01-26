/// PaymentService.swift
/// Flent Secured v2 - Payment Service Implementation
///
/// Implements PaymentServiceProtocol using Supabase Edge Functions
/// Handles payment initiation, status tracking, and history

import Foundation
import Supabase

// MARK: - Payment Service

final class PaymentService: PaymentServiceProtocol {

    // MARK: - Properties

    private let supabase: SupabaseManager

    // MARK: - Initialization

    init(supabase: SupabaseManager = .shared) {
        self.supabase = supabase
    }

    // MARK: - PaymentServiceProtocol

    func initiatePayment(
        tenancyId: String,
        paymentMethod: PaymentMethod,
        rentMonth: String,
        applyCashback: Bool
    ) async throws -> PaymentInitiation {
        guard await supabase.checkIsAuthenticated() else {
            throw PaymentServiceError.notAuthenticated
        }

        let request = InitiatePaymentRequest(
            tenancyId: tenancyId,
            paymentMethod: paymentMethod.rawValue,
            rentMonth: rentMonth,
            applyCashback: applyCashback
        )

        let idempotencyKey = await generateIdempotencyKey(tenancyId: tenancyId, rentMonth: rentMonth)

        do {
            let response: InitiatePaymentResponse = try await supabase.client.functions.invoke(
                "initiate-payment",
                options: FunctionInvokeOptions(
                    headers: [
                        "x-idempotency-key": idempotencyKey
                    ],
                    body: request
                )
            )

            guard response.success, let data = response.data else {
                if let error = response.error {
                    // Check for specific error types
                    if error.contains("already exists") || error.contains("ALREADY_PAID") {
                        throw PaymentServiceError.paymentAlreadyExists(month: rentMonth)
                    }
                    if error.contains("in progress") || error.contains("PAYMENT_IN_PROGRESS") {
                        throw PaymentServiceError.paymentInProgress
                    }
                    if error.contains("verification") || error.contains("VERIFICATION_REQUIRED") {
                        throw PaymentServiceError.verificationRequired
                    }
                }
                throw PaymentServiceError.serverError(response.error ?? "Failed to initiate payment")
            }

            return data
        } catch let error as PaymentServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func getPaymentStatus(paymentId: String) async throws -> PaymentStatusData {
        guard await supabase.checkIsAuthenticated() else {
            throw PaymentServiceError.notAuthenticated
        }

        do {
            let payment: PaymentStatusData = try await supabase.client
                .from("payments")
                .select("payment_id:id, status, settlement_status, updated_at")
                .eq("id", value: paymentId)
                .single()
                .execute()
                .value

            return payment
        } catch {
            if let postgrestError = error as? PostgrestError {
                if postgrestError.message.contains("no rows") {
                    throw PaymentServiceError.paymentNotFound
                }
            }
            throw mapError(error)
        }
    }

    func getPaymentHistory(tenancyId: String, limit: Int, offset: Int) async throws -> [PaymentData] {
        guard await supabase.checkIsAuthenticated() else {
            throw PaymentServiceError.notAuthenticated
        }

        do {
            let payments: [PaymentData] = try await supabase.client
                .from("payments")
                .select()
                .eq("tenancy_id", value: tenancyId)
                .order("created_at", ascending: false)
                .range(from: offset, to: offset + limit - 1)
                .execute()
                .value

            return payments
        } catch {
            throw mapError(error)
        }
    }

    func generateReceipt(paymentId: String) async throws -> ReceiptData {
        guard await supabase.checkIsAuthenticated() else {
            throw PaymentServiceError.notAuthenticated
        }

        do {
            let response: ReceiptResponse = try await supabase.client.functions.invoke(
                "generate-receipt",
                options: FunctionInvokeOptions(
                    body: ["payment_id": paymentId]
                )
            )

            guard response.success, let data = response.data else {
                throw PaymentServiceError.serverError(response.error ?? "Failed to generate receipt")
            }

            return data
        } catch let error as PaymentServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func hasPaymentForMonth(tenancyId: String, rentMonth: String) async throws -> Bool {
        guard await supabase.checkIsAuthenticated() else {
            throw PaymentServiceError.notAuthenticated
        }

        do {
            let payments: [PaymentExistsCheck] = try await supabase.client
                .from("payments")
                .select("id, status")
                .eq("tenancy_id", value: tenancyId)
                .eq("payment_month", value: rentMonth)
                .in("status", values: ["initiated", "processing", "success"])
                .limit(1)
                .execute()
                .value

            return !payments.isEmpty
        } catch {
            throw mapError(error)
        }
    }

    // MARK: - Private Helpers

    private func generateIdempotencyKey(tenancyId: String, rentMonth: String) async -> String {
        guard let userId = await supabase.getCurrentUserId() else {
            return UUID().uuidString
        }
        return "payment:\(userId.uuidString):\(tenancyId):\(rentMonth)"
    }

    private func mapError(_ error: Error) -> PaymentServiceError {
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

private struct InitiatePaymentRequest: Encodable {
    let tenancyId: String
    let paymentMethod: String
    let rentMonth: String
    let applyCashback: Bool

    enum CodingKeys: String, CodingKey {
        case tenancyId = "tenancy_id"
        case paymentMethod = "payment_method"
        case rentMonth = "rent_month"
        case applyCashback = "apply_cashback"
    }
}

// MARK: - Response Types

private struct InitiatePaymentResponse: Decodable {
    let success: Bool
    let data: PaymentInitiation?
    let error: String?
}

private struct ReceiptResponse: Decodable {
    let success: Bool
    let data: ReceiptData?
    let error: String?
}

private struct PaymentExistsCheck: Decodable {
    let id: String
    let status: String
}

private struct ErrorResponse: Decodable {
    let success: Bool
    let error: String?
}
