/// PaymentServiceProtocol.swift
/// Flent Secured v2 - Payment Service Protocol
///
/// Defines the contract for payment operations
/// Including initiation, status tracking, and history

import Foundation

// MARK: - Payment Service Protocol

protocol PaymentServiceProtocol {
    /// Initiate a rent payment
    /// - Parameters:
    ///   - tenancyId: The tenancy to pay rent for
    ///   - paymentMethod: Selected payment method
    ///   - rentMonth: Month being paid (YYYY-MM format)
    ///   - applyCashback: Whether to apply available cashback
    /// - Returns: Payment initiation data with PayU params
    func initiatePayment(
        tenancyId: String,
        paymentMethod: PaymentMethod,
        rentMonth: String,
        applyCashback: Bool
    ) async throws -> PaymentInitiation

    /// Get payment status
    func getPaymentStatus(paymentId: String) async throws -> PaymentStatusData

    /// Get payment history
    func getPaymentHistory(tenancyId: String, limit: Int, offset: Int) async throws -> [PaymentData]

    /// Generate receipt for a completed payment
    func generateReceipt(paymentId: String) async throws -> ReceiptData

    /// Check if payment exists for a given month
    func hasPaymentForMonth(tenancyId: String, rentMonth: String) async throws -> Bool
}

// MARK: - Payment Method

enum PaymentMethod: String, Codable, CaseIterable {
    case upiIntent = "upi_intent"
    case upiCollect = "upi_collect"
    case netBanking = "net_banking"
    case creditCard = "credit_card"
    case debitCard = "debit_card"
    case wallet = "wallet"

    var displayName: String {
        switch self {
        case .upiIntent: return "UPI"
        case .upiCollect: return "UPI ID"
        case .netBanking: return "Net Banking"
        case .creditCard: return "Credit Card"
        case .debitCard: return "Debit Card"
        case .wallet: return "Wallet"
        }
    }

    var iconName: String {
        switch self {
        case .upiIntent, .upiCollect: return "upi_icon"
        case .netBanking: return "bank_icon"
        case .creditCard, .debitCard: return "card_icon"
        case .wallet: return "wallet_icon"
        }
    }

    /// Whether this method requires full verification (COMPLETE status)
    var requiresFullVerification: Bool {
        switch self {
        case .creditCard, .wallet:
            return true
        case .upiIntent, .upiCollect, .netBanking, .debitCard:
            return false
        }
    }
}

// MARK: - UPI App

enum UPIApp: String, Codable, CaseIterable {
    case gpay = "gpay"
    case phonePe = "phonepe"
    case paytm = "paytm"
    case bhim = "bhim"
    case amazonPay = "amazonpay"
    case other = "other"

    var displayName: String {
        switch self {
        case .gpay: return "Google Pay"
        case .phonePe: return "PhonePe"
        case .paytm: return "Paytm"
        case .bhim: return "BHIM"
        case .amazonPay: return "Amazon Pay"
        case .other: return "Other UPI"
        }
    }

    var urlScheme: String? {
        switch self {
        case .gpay: return "gpay://"
        case .phonePe: return "phonepe://"
        case .paytm: return "paytm://"
        case .bhim: return "bhim://"
        case .amazonPay: return "amazonpay://"
        case .other: return nil
        }
    }
}

// MARK: - Payment Initiation

struct PaymentInitiation: Codable, Equatable {
    let paymentId: String
    let txnId: String
    let amountPaise: Int
    let pgFeePaise: Int
    let cashbackAppliedPaise: Int
    let totalPaise: Int
    let payuParams: PayUParams
    let intentUrl: String?

    enum CodingKeys: String, CodingKey {
        case paymentId = "payment_id"
        case txnId = "txn_id"
        case amountPaise = "amount_paise"
        case pgFeePaise = "pg_fee_paise"
        case cashbackAppliedPaise = "cashback_applied_paise"
        case totalPaise = "total_paise"
        case payuParams = "payu"
        case intentUrl = "intent_url"
    }

    var amount: Double {
        Double(amountPaise) / 100.0
    }

    var total: Double {
        Double(totalPaise) / 100.0
    }

    var cashbackApplied: Double {
        Double(cashbackAppliedPaise) / 100.0
    }
}

// MARK: - PayU Params

struct PayUParams: Codable, Equatable {
    let key: String
    let txnid: String
    let amount: String
    let productinfo: String
    let firstname: String
    let email: String
    let phone: String
    let surl: String
    let furl: String
    let hash: String
    let udf1: String?
    let udf2: String?
    let udf3: String?

    /// Base URL for PayU (sandbox or production)
    var baseURL: String {
        // This should come from configuration
        #if DEBUG
        return "https://sandboxsecure.payu.in"
        #else
        return "https://secure.payu.in"
        #endif
    }
}

// MARK: - Payment Status Data

struct PaymentStatusData: Codable {
    let paymentId: String
    let status: String
    let settlementStatus: String?
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case paymentId = "payment_id"
        case status
        case settlementStatus = "settlement_status"
        case updatedAt = "updated_at"
    }

    var paymentStatus: PaymentStatus {
        PaymentStatus(rawValue: status) ?? .initiated
    }

    var settlement: SettlementStatus {
        SettlementStatus(rawValue: settlementStatus ?? "") ?? .pending
    }
}

// MARK: - Settlement Status

enum SettlementStatus: String, Codable, Hashable {
    case pending
    case processing
    case completed
    case failed

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .processing: return "Processing"
        case .completed: return "Completed"
        case .failed: return "Failed"
        }
    }
}

// MARK: - Receipt Data

struct ReceiptData: Codable, Equatable {
    let paymentId: String
    let receiptNumber: String
    let downloadUrl: String
    let generatedAt: String

    enum CodingKeys: String, CodingKey {
        case paymentId = "payment_id"
        case receiptNumber = "receipt_number"
        case downloadUrl = "download_url"
        case generatedAt = "generated_at"
    }
}

// MARK: - Payment Service Error

enum PaymentServiceError: LocalizedError {
    case notAuthenticated
    case tenancyNotFound
    case paymentNotFound
    case paymentAlreadyExists(month: String)
    case paymentInProgress
    case invalidPaymentMethod
    case verificationRequired
    case networkError(Error)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Please sign in to continue"
        case .tenancyNotFound:
            return "No active tenancy found"
        case .paymentNotFound:
            return "Payment not found"
        case .paymentAlreadyExists(let month):
            return "Payment already exists for \(month)"
        case .paymentInProgress:
            return "A payment is already in progress"
        case .invalidPaymentMethod:
            return "Selected payment method is not available"
        case .verificationRequired:
            return "Please complete verification to use this payment method"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        }
    }
}
