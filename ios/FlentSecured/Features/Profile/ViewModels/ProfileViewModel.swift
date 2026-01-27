/// ProfileViewModel.swift
/// Flent Secured v2 - Profile ViewModel
///
/// Manages user profile data and actions
///
/// Figma: Profile screens

import Foundation
import Observation

// MARK: - Profile ViewModel

@Observable
final class ProfileViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case loggingOut
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var userProfile: UserProfileData?
    private(set) var tenancy: TenancyData?

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var isLoggingOut: Bool {
        if case .loggingOut = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var fullName: String {
        userProfile?.fullName ?? "User"
    }

    var phone: String {
        guard let phone = userProfile?.phone else { return "" }
        // Format: +91 98765 43210
        if phone.hasPrefix("+91") {
            let digits = String(phone.dropFirst(3))
            if digits.count == 10 {
                return "+91 \(digits.prefix(5)) \(digits.suffix(5))"
            }
        }
        return phone
    }

    var email: String? {
        userProfile?.email
    }

    var userStatus: String {
        userProfile?.status.displayName ?? "Unknown"
    }

    var propertyAddress: String? {
        tenancy?.fullAddress
    }

    var monthlyRent: String? {
        guard let tenancy = tenancy else { return nil }
        return formatCurrency(tenancy.monthlyRent)
    }

    var memberSince: String {
        guard let createdAt = userProfile?.createdAt else { return "" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMMM yyyy"

        if let date = isoFormatter.date(from: createdAt) {
            return "Member since \(displayFormatter.string(from: date))"
        }
        return ""
    }

    var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "Version \(version) (\(build))"
    }

    // MARK: - Payment History

    /// Number of on-time payments
    var onTimePayments: Int {
        paymentHistory.filter { $0.isOnTime }.count
    }

    /// Number of late payments
    var latePayments: Int {
        paymentHistory.filter { !$0.isOnTime }.count
    }

    /// Payment history data for chart
    var paymentHistory: [PaymentMonthData] {
        // Sample data - would be loaded from backend in real implementation
        [
            PaymentMonthData(monthLabel: "Jun", percentage: 100, isOnTime: true),
            PaymentMonthData(monthLabel: "Jul", percentage: 100, isOnTime: true),
            PaymentMonthData(monthLabel: "Aug", percentage: 80, isOnTime: true),
            PaymentMonthData(monthLabel: "Sep", percentage: 100, isOnTime: true),
            PaymentMonthData(monthLabel: "Oct", percentage: 60, isOnTime: false),
            PaymentMonthData(monthLabel: "Nov", percentage: 100, isOnTime: true),
            PaymentMonthData(monthLabel: "Dec", percentage: 100, isOnTime: true)
        ]
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol
    private let authService: AuthServiceProtocol

    // MARK: - Initialization

    init(
        userService: UserServiceProtocol = AppEnvironment.shared.userService,
        authService: AuthServiceProtocol = AppEnvironment.shared.authService
    ) {
        self.userService = userService
        self.authService = authService
    }

    // MARK: - Actions

    @MainActor
    func loadProfile() async {
        state = .loading

        do {
            let profile = try await userService.getCurrentUser()
            userProfile = profile

            // Load tenancy
            if let tenancyData = try? await userService.getCurrentTenancy() {
                tenancy = tenancyData
            }

            state = .loaded
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load profile")
        } catch {
            state = .error("Unable to load profile. Please try again.")
        }
    }

    @MainActor
    func logout() async -> Bool {
        state = .loggingOut

        do {
            try await authService.signOut()
            return true
        } catch {
            state = .error("Failed to log out. Please try again.")
            return false
        }
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

// Note: UserStatus.displayName is defined in Core/Models/UserStatus.swift

// MARK: - Preview Helpers

extension ProfileViewModel {
    static var preview: ProfileViewModel {
        let vm = ProfileViewModel(
            userService: MockUserService(),
            authService: MockAuthService()
        )
        vm.userProfile = UserProfileData(
            id: "test-user-123",
            phone: "+919876543210",
            firstName: "Amit",
            lastName: "Kumar",
            email: "amit@example.com",
            role: "tenant",
            isRoleLocked: true,
            userStatus: "complete",
            kycStatus: "verified",
            createdAt: "2025-06-01T10:00:00.000Z"
        )
        vm.state = .loaded
        return vm
    }

    static var previewLoading: ProfileViewModel {
        let vm = ProfileViewModel(
            userService: MockUserService(),
            authService: MockAuthService()
        )
        vm.state = .loading
        return vm
    }
}
