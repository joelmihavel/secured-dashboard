/// PayUManager.swift
/// Flent Secured v2 - PayU Payment Manager
///
/// Manages PayU payment integration including:
/// - UPI intent handling
/// - Payment URL generation
/// - App availability checks

import Foundation

#if canImport(UIKit)
import UIKit
#endif

// MARK: - PayU Manager

final class PayUManager {
    static let shared = PayUManager()

    private init() {}

    // MARK: - UPI App Availability

    /// Check if a specific UPI app is installed
    func isUPIAppInstalled(_ app: UPIApp) -> Bool {
        guard let scheme = app.urlScheme,
              let url = URL(string: scheme) else {
            return false
        }
        return UIApplication.shared.canOpenURL(url)
    }

    /// Get list of installed UPI apps
    func getInstalledUPIApps() -> [UPIApp] {
        UPIApp.allCases.filter { isUPIAppInstalled($0) }
    }

    /// Check if any UPI app is available
    var hasAnyUPIApp: Bool {
        !getInstalledUPIApps().isEmpty
    }

    // MARK: - UPI Intent

    /// Open UPI intent URL
    func openUPIIntent(url: URL, completion: @escaping (Bool) -> Void) {
        guard UIApplication.shared.canOpenURL(url) else {
            completion(false)
            return
        }

        UIApplication.shared.open(url, options: [:]) { success in
            completion(success)
        }
    }

    /// Open specific UPI app with payment URL
    func openUPIApp(_ app: UPIApp, intentUrl: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: intentUrl) else {
            completion(false)
            return
        }

        // For specific apps, we might need to modify the URL scheme
        // For now, use the intent URL directly
        openUPIIntent(url: url, completion: completion)
    }

    // MARK: - Payment URL Building

    /// Build PayU payment URL for web checkout
    func buildPaymentURL(params: PayUParams) -> URL? {
        var components = URLComponents(string: "\(params.baseURL)/_payment")
        components?.queryItems = [
            URLQueryItem(name: "key", value: params.key),
            URLQueryItem(name: "txnid", value: params.txnid),
            URLQueryItem(name: "amount", value: params.amount),
            URLQueryItem(name: "productinfo", value: params.productinfo),
            URLQueryItem(name: "firstname", value: params.firstname),
            URLQueryItem(name: "email", value: params.email),
            URLQueryItem(name: "phone", value: params.phone),
            URLQueryItem(name: "surl", value: params.surl),
            URLQueryItem(name: "furl", value: params.furl),
            URLQueryItem(name: "hash", value: params.hash)
        ]

        if let udf1 = params.udf1 {
            components?.queryItems?.append(URLQueryItem(name: "udf1", value: udf1))
        }
        if let udf2 = params.udf2 {
            components?.queryItems?.append(URLQueryItem(name: "udf2", value: udf2))
        }
        if let udf3 = params.udf3 {
            components?.queryItems?.append(URLQueryItem(name: "udf3", value: udf3))
        }

        return components?.url
    }

    // MARK: - Deep Link Handling

    /// Parse PayU callback URL
    func parseCallbackURL(_ url: URL) -> PayUCallbackResult? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else {
            return nil
        }

        let queryItems = components.queryItems ?? []

        func value(for key: String) -> String? {
            queryItems.first(where: { $0.name.lowercased() == key.lowercased() })?.value
        }

        let status = value(for: "status") ?? ""
        let txnId = value(for: "txnid") ?? ""
        let amount = value(for: "amount") ?? ""
        let mihpayid = value(for: "mihpayid")
        let errorMessage = value(for: "error_Message")
        let bankRefNum = value(for: "bank_ref_num")

        let isSuccess = status.lowercased() == "success"

        return PayUCallbackResult(
            isSuccess: isSuccess,
            txnId: txnId,
            amount: amount,
            payuTransactionId: mihpayid,
            bankRefNum: bankRefNum,
            errorMessage: errorMessage,
            rawStatus: status
        )
    }

    // MARK: - Validation

    /// Validate PayU params before initiating payment
    func validateParams(_ params: PayUParams) -> PayUValidationResult {
        var errors: [String] = []

        if params.key.isEmpty {
            errors.append("Merchant key is missing")
        }
        if params.txnid.isEmpty {
            errors.append("Transaction ID is missing")
        }
        if params.amount.isEmpty || Double(params.amount) == nil {
            errors.append("Invalid amount")
        }
        if params.productinfo.isEmpty {
            errors.append("Product info is missing")
        }
        if params.firstname.isEmpty {
            errors.append("Customer name is missing")
        }
        if params.email.isEmpty {
            errors.append("Email is missing")
        }
        if params.phone.isEmpty || params.phone.count != 10 {
            errors.append("Invalid phone number")
        }
        if params.hash.isEmpty {
            errors.append("Hash is missing")
        }

        return PayUValidationResult(isValid: errors.isEmpty, errors: errors)
    }
}

// MARK: - PayU Callback Result

struct PayUCallbackResult {
    let isSuccess: Bool
    let txnId: String
    let amount: String
    let payuTransactionId: String?
    let bankRefNum: String?
    let errorMessage: String?
    let rawStatus: String
}

// MARK: - PayU Validation Result

struct PayUValidationResult {
    let isValid: Bool
    let errors: [String]

    var errorMessage: String? {
        errors.isEmpty ? nil : errors.joined(separator: ", ")
    }
}

// MARK: - PayU Configuration

enum PayUConfiguration {
    static var baseURL: String {
        #if DEBUG
        return "https://sandboxsecure.payu.in"
        #else
        return "https://secure.payu.in"
        #endif
    }

    static var isSandbox: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
}
