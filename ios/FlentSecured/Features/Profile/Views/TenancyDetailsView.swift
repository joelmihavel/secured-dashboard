/// TenancyDetailsView.swift
/// Flent Secured v2 - Tenancy Details Screen
///
/// Displays tenancy information (read-only)
/// - Property address, Monthly rent, Due day, Lease dates
///
/// Figma: Profile > Tenancy Details

import SwiftUI

struct TenancyDetailsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = TenancyDetailsViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Header with back button
                HStack {
                    Button {
                        coordinator.pop()
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(.white)
                    }

                    Spacer()
                }
                .padding(.top, Spacing.md)

                // Title - Split color
                VStack(alignment: .leading, spacing: 0) {
                    Text("Tenancy")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(.white)
                    Text("Details")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                if viewModel.isLoading {
                    Spacer()
                    ProgressView()
                        .tint(AppColors.brand500)
                        .frame(maxWidth: .infinity)
                    Spacer()
                } else if viewModel.hasTenancy {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            // Property Information Card
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("PROPERTY INFORMATION")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)
                                    .padding(.leading, Spacing.xs)

                                VStack(spacing: 0) {
                                    // Property Address
                                    TenancyDetailRow(
                                        icon: "house.fill",
                                        label: "Property Address",
                                        value: viewModel.fullAddress
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    // City & State
                                    TenancyDetailRow(
                                        icon: "mappin.circle.fill",
                                        label: "City & State",
                                        value: viewModel.cityState
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    // Pincode
                                    TenancyDetailRow(
                                        icon: "number",
                                        label: "Pincode",
                                        value: viewModel.pincode
                                    )
                                }
                                .background(AppColors.black500)
                                .cornerRadius(Radius.md)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.md)
                                        .stroke(AppColors.black400, lineWidth: 1)
                                )
                            }

                            // Rent Details Card
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("RENT DETAILS")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)
                                    .padding(.leading, Spacing.xs)

                                VStack(spacing: 0) {
                                    // Monthly Rent
                                    TenancyDetailRow(
                                        icon: "indianrupeesign.circle.fill",
                                        label: "Monthly Rent",
                                        value: viewModel.formattedRent,
                                        valueColor: AppColors.brand500
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    // Due Day
                                    TenancyDetailRow(
                                        icon: "calendar",
                                        label: "Rent Due Day",
                                        value: viewModel.dueDayText
                                    )

                                    if viewModel.hasSecurityDeposit {
                                        Divider()
                                            .background(AppColors.black400)

                                        // Security Deposit
                                        TenancyDetailRow(
                                            icon: "shield.fill",
                                            label: "Security Deposit",
                                            value: viewModel.formattedSecurityDeposit
                                        )
                                    }
                                }
                                .background(AppColors.black500)
                                .cornerRadius(Radius.md)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.md)
                                        .stroke(AppColors.black400, lineWidth: 1)
                                )
                            }

                            // Lease Period Card
                            if viewModel.hasLeaseDates {
                                VStack(alignment: .leading, spacing: Spacing.md) {
                                    Text("LEASE PERIOD")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundColor(AppColors.neutral500)
                                        .padding(.leading, Spacing.xs)

                                    VStack(spacing: 0) {
                                        // Lease Start
                                        TenancyDetailRow(
                                            icon: "calendar.badge.plus",
                                            label: "Lease Start Date",
                                            value: viewModel.leaseStartDate
                                        )

                                        Divider()
                                            .background(AppColors.black400)

                                        // Lease End
                                        TenancyDetailRow(
                                            icon: "calendar.badge.minus",
                                            label: "Lease End Date",
                                            value: viewModel.leaseEndDate
                                        )
                                    }
                                    .background(AppColors.black500)
                                    .cornerRadius(Radius.md)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Radius.md)
                                            .stroke(AppColors.black400, lineWidth: 1)
                                    )
                                }
                            }

                            // Landlord Information Card
                            if viewModel.hasLandlordInfo {
                                VStack(alignment: .leading, spacing: Spacing.md) {
                                    Text("LANDLORD INFORMATION")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundColor(AppColors.neutral500)
                                        .padding(.leading, Spacing.xs)

                                    VStack(spacing: 0) {
                                        // Landlord Name
                                        TenancyDetailRow(
                                            icon: "person.fill",
                                            label: "Landlord Name",
                                            value: viewModel.landlordName
                                        )

                                        if viewModel.landlordPhone != "-" {
                                            Divider()
                                                .background(AppColors.black400)

                                            // Landlord Phone
                                            TenancyDetailRow(
                                                icon: "phone.fill",
                                                label: "Landlord Phone",
                                                value: viewModel.landlordPhone
                                            )
                                        }
                                    }
                                    .background(AppColors.black500)
                                    .cornerRadius(Radius.md)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Radius.md)
                                            .stroke(AppColors.black400, lineWidth: 1)
                                    )
                                }
                            }

                            // Verification Status Card
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("VERIFICATION STATUS")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)
                                    .padding(.leading, Spacing.xs)

                                VStack(spacing: 0) {
                                    VerificationStatusRow(
                                        title: "Bank Account",
                                        isVerified: viewModel.bankVerified
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    VerificationStatusRow(
                                        title: "Address Proof",
                                        isVerified: viewModel.utilityVerified
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    VerificationStatusRow(
                                        title: "Landlord Approval",
                                        isVerified: viewModel.landlordApproved
                                    )
                                }
                                .background(AppColors.black500)
                                .cornerRadius(Radius.md)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.md)
                                        .stroke(AppColors.black400, lineWidth: 1)
                                )
                            }

                            // Info Note
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "info.circle")
                                    .font(.system(size: 14))
                                    .foregroundColor(AppColors.neutral500)
                                Text("Contact support to update tenancy details.")
                                    .font(Typography.caption)
                                    .foregroundColor(AppColors.neutral500)
                            }
                            .padding(.top, Spacing.xs)
                        }
                        .padding(.top, Spacing.md)
                        .padding(.bottom, Spacing.xl)
                    }
                } else {
                    // No tenancy state
                    Spacer()
                    VStack(spacing: Spacing.md) {
                        Image(systemName: "house.slash")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.textMuted)

                        Text("No tenancy found")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)

                        Text("Complete your onboarding to add tenancy details")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    Spacer()
                }
            }
            .padding(.horizontal, Spacing.screenHorizontalCompact)
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadTenancy()
        }
    }
}

// MARK: - Tenancy Detail Row

struct TenancyDetailRow: View {
    let icon: String
    let label: String
    let value: String
    var valueColor: Color = .white

    var body: some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(AppColors.brand500)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)

                Text(value)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(valueColor)
            }

            Spacer()
        }
        .padding(Spacing.md)
    }
}

// MARK: - Verification Status Row

struct VerificationStatusRow: View {
    let title: String
    let isVerified: Bool

    var body: some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: isVerified ? "checkmark.circle.fill" : "clock.fill")
                .font(.system(size: 20))
                .foregroundColor(isVerified ? AppColors.success : AppColors.warning)
                .frame(width: 24)

            Text(title)
                .font(.system(size: 16, weight: .regular))
                .foregroundColor(.white)

            Spacer()

            Text(isVerified ? "Verified" : "Pending")
                .font(Typography.caption)
                .foregroundColor(isVerified ? AppColors.success : AppColors.warning)
        }
        .padding(Spacing.md)
    }
}

// MARK: - Tenancy Details ViewModel

@Observable
final class TenancyDetailsViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var tenancy: TenancyData?

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var hasTenancy: Bool {
        tenancy != nil
    }

    var fullAddress: String {
        tenancy?.propertyAddress ?? "-"
    }

    var cityState: String {
        let city = tenancy?.propertyCity
        let state = tenancy?.propertyState
        if let city = city, let state = state {
            return "\(city), \(state)"
        }
        return city ?? state ?? "-"
    }

    var pincode: String {
        tenancy?.propertyPincode ?? "-"
    }

    var formattedRent: String {
        guard let tenancy = tenancy else { return "-" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: tenancy.monthlyRent)) ?? "\u{20B9}\(Int(tenancy.monthlyRent))"
    }

    var dueDayText: String {
        guard let tenancy = tenancy else { return "-" }
        let day = tenancy.rentDueDay
        let suffix: String
        switch day {
        case 1, 21, 31: suffix = "st"
        case 2, 22: suffix = "nd"
        case 3, 23: suffix = "rd"
        default: suffix = "th"
        }
        return "\(day)\(suffix) of every month"
    }

    var hasSecurityDeposit: Bool {
        (tenancy?.securityDepositPaise ?? 0) > 0
    }

    var formattedSecurityDeposit: String {
        guard let depositPaise = tenancy?.securityDepositPaise, depositPaise > 0 else { return "-" }
        let deposit = Double(depositPaise) / 100.0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: deposit)) ?? "\u{20B9}\(Int(deposit))"
    }

    var hasLeaseDates: Bool {
        tenancy?.leaseStartDate != nil || tenancy?.leaseEndDate != nil
    }

    var leaseStartDate: String {
        formatDateString(tenancy?.leaseStartDate)
    }

    var leaseEndDate: String {
        formatDateString(tenancy?.leaseEndDate)
    }

    var hasLandlordInfo: Bool {
        tenancy?.landlordName != nil
    }

    var landlordName: String {
        tenancy?.landlordName ?? "-"
    }

    var landlordPhone: String {
        guard let phone = tenancy?.landlordPhone else { return "-" }
        // Format phone number
        if phone.hasPrefix("+91") {
            let digits = String(phone.dropFirst(3))
            if digits.count == 10 {
                return "+91 \(digits.prefix(5)) \(digits.suffix(5))"
            }
        }
        return phone
    }

    var bankVerified: Bool {
        tenancy?.bankVerified ?? false
    }

    var utilityVerified: Bool {
        tenancy?.utilityVerified ?? false
    }

    var landlordApproved: Bool {
        tenancy?.landlordApproved ?? false
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    // MARK: - Actions

    @MainActor
    func loadTenancy() async {
        state = .loading

        do {
            tenancy = try await userService.getCurrentTenancy()
            state = .loaded
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load tenancy")
        } catch {
            state = .error("Unable to load tenancy details. Please try again.")
        }
    }

    // MARK: - Private Helpers

    private func formatDateString(_ dateString: String?) -> String {
        guard let dateString = dateString else { return "-" }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withFullDate]

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d, yyyy"

        // Try ISO format first
        if let date = isoFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        // Try yyyy-MM-dd format
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd"
        if let date = simpleFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        return dateString
    }
}

// MARK: - Preview

#Preview {
    TenancyDetailsView()
        .environment(AppCoordinator())
        .environment(AppState())
}
