/// ReferralViewModel.swift
/// Flent Secured v2 - Referral ViewModel
///
/// Manages referral program functionality
///
/// Figma: Referral screens

import Foundation
import Observation

// MARK: - Referral ViewModel

@MainActor
@Observable
final class ReferralViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var referralCode: String?
    private(set) var referralStats: ReferralStats?
    private(set) var referrals: [Referral] = []

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var hasReferralCode: Bool {
        referralCode != nil
    }

    var shareableLink: String? {
        guard let code = referralCode else { return nil }
        return "https://flent.app/refer/\(code)"
    }

    var totalReferrals: Int {
        referralStats?.totalReferrals ?? 0
    }

    var successfulReferrals: Int {
        referralStats?.successfulReferrals ?? 0
    }

    var totalEarnings: String {
        guard let earnings = referralStats?.totalEarningsPaise else { return "₹0" }
        return formatCurrency(Double(earnings) / 100.0)
    }

    var pendingEarnings: String {
        guard let pending = referralStats?.pendingEarningsPaise else { return "₹0" }
        return formatCurrency(Double(pending) / 100.0)
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    // MARK: - Actions

    @MainActor
    func loadReferralData() async {
        state = .loading

        // Referral API not yet implemented
        // For now, show coming soon state
        try? await Task.sleep(nanoseconds: 500_000_000)

        referralCode = nil
        referralStats = nil
        referrals = []
        state = .loaded
    }

    func copyReferralCode() {
        guard let code = referralCode else { return }
        UIPasteboard.general.string = code
    }

    func copyShareableLink() {
        guard let link = shareableLink else { return }
        UIPasteboard.general.string = link
    }

    func shareReferralLink() -> URL? {
        guard let link = shareableLink else { return nil }
        return URL(string: link)
    }

    // MARK: - Private Helpers

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "₹\(Int(amount))"
    }
}

// MARK: - UIPasteboard import

import UIKit

// MARK: - Referral Stats

struct ReferralStats: Codable, Equatable {
    let totalReferrals: Int
    let successfulReferrals: Int
    let pendingReferrals: Int
    let totalEarningsPaise: Int
    let pendingEarningsPaise: Int

    enum CodingKeys: String, CodingKey {
        case totalReferrals = "total_referrals"
        case successfulReferrals = "successful_referrals"
        case pendingReferrals = "pending_referrals"
        case totalEarningsPaise = "total_earnings_paise"
        case pendingEarningsPaise = "pending_earnings_paise"
    }
}

// MARK: - Referral

struct Referral: Codable, Identifiable, Equatable {
    let id: String
    let referredUserPhone: String
    let status: String
    let earningsPaise: Int?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case referredUserPhone = "referred_user_phone"
        case status
        case earningsPaise = "earnings_paise"
        case createdAt = "created_at"
    }

    var maskedPhone: String {
        guard referredUserPhone.count >= 4 else { return "****" }
        let lastFour = referredUserPhone.suffix(4)
        return "******\(lastFour)"
    }

    var statusDisplayName: String {
        switch status {
        case "pending": return "Pending"
        case "completed": return "Completed"
        case "expired": return "Expired"
        default: return status.capitalized
        }
    }

    var earnings: String? {
        guard let paise = earningsPaise else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: Double(paise) / 100.0))
    }
}

// MARK: - Preview Helpers

extension ReferralViewModel {
    static var preview: ReferralViewModel {
        let vm = ReferralViewModel(userService: MockUserService())
        vm.state = .loaded
        return vm
    }

    static var previewWithCode: ReferralViewModel {
        let vm = ReferralViewModel(userService: MockUserService())
        vm.referralCode = "AMIT2026"
        vm.referralStats = ReferralStats(
            totalReferrals: 5,
            successfulReferrals: 3,
            pendingReferrals: 2,
            totalEarningsPaise: 150000,
            pendingEarningsPaise: 50000
        )
        vm.referrals = [
            Referral(
                id: "1",
                referredUserPhone: "+919876543210",
                status: "completed",
                earningsPaise: 50000,
                createdAt: "2026-01-15T10:00:00.000Z"
            ),
            Referral(
                id: "2",
                referredUserPhone: "+919876543211",
                status: "pending",
                earningsPaise: nil,
                createdAt: "2026-01-20T10:00:00.000Z"
            )
        ]
        vm.state = .loaded
        return vm
    }
}
