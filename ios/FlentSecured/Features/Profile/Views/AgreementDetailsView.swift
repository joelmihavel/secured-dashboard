/// AgreementDetailsView.swift
/// Flent Secured v2 - Agreement Details View
///
/// Figma: 41:9811 - Agreement View
/// Shows rental agreement details extracted during onboarding
/// Including property info, rent amount, and lease dates

import SwiftUI

// MARK: - Agreement Details View

struct AgreementDetailsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var viewModel = AgreementDetailsViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
                    .tint(AppColors.brand500)
            } else {
                ScrollView {
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

                        // Title
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Rental")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(.white)
                            Text("Agreement")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(AppColors.brand500)
                        }

                        // Agreement Status Card
                        agreementStatusCard

                        // Property Details
                        propertyDetailsSection

                        // Rent Details
                        rentDetailsSection

                        // Lease Period
                        leasePeriodSection

                        // View Document CTA
                        if viewModel.hasDocument {
                            viewDocumentCTA
                        }

                        Spacer()
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadAgreementDetails()
        }
    }

    // MARK: - Agreement Status Card

    private var agreementStatusCard: some View {
        HStack(spacing: Spacing.md) {
            // Document icon
            ZStack {
                Circle()
                    .fill(AppColors.success.opacity(0.15))
                    .frame(width: 48, height: 48)

                Image(systemName: "doc.text.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.success)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Agreement Verified")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text("Uploaded on \(viewModel.uploadDate)")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.success.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Property Details Section

    private var propertyDetailsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("PROPERTY DETAILS")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(spacing: 0) {
                AgreementDetailRow(label: "Address", value: viewModel.propertyAddress)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "City", value: viewModel.propertyCity)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "State", value: viewModel.propertyState)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "Pincode", value: viewModel.propertyPincode)
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }

    // MARK: - Rent Details Section

    private var rentDetailsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("RENT DETAILS")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(spacing: 0) {
                AgreementDetailRow(label: "Monthly Rent", value: viewModel.monthlyRent, isHighlighted: true)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "Security Deposit", value: viewModel.securityDeposit)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "Due Day", value: "\(viewModel.rentDueDay)\(ordinalSuffix(for: viewModel.rentDueDay)) of each month")
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }

    // MARK: - Lease Period Section

    private var leasePeriodSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("LEASE PERIOD")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(spacing: 0) {
                AgreementDetailRow(label: "Start Date", value: viewModel.leaseStartDate)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "End Date", value: viewModel.leaseEndDate)
                Divider().background(AppColors.black400.opacity(0.5))
                AgreementDetailRow(label: "Duration", value: viewModel.leaseDuration)
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.black400, lineWidth: 1)
            )
        }
    }

    // MARK: - View Document CTA

    private var viewDocumentCTA: some View {
        Button(action: {
            viewModel.viewDocument()
        }) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "doc.viewfinder")
                    .font(.system(size: 18))
                    .foregroundColor(AppColors.brand500)

                Text("View Original Document")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.brand500)

                Spacer()

                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.brand500)
            }
            .padding(Spacing.md)
            .background(AppColors.brand500.opacity(0.1))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.brand500.opacity(0.3), lineWidth: 1)
            )
        }
    }

    // MARK: - Helpers

    private func ordinalSuffix(for day: Int) -> String {
        switch day {
        case 1, 21, 31: return "st"
        case 2, 22: return "nd"
        case 3, 23: return "rd"
        default: return "th"
        }
    }
}

// MARK: - Agreement Detail Row

private struct AgreementDetailRow: View {
    let label: String
    let value: String
    var isHighlighted: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            Text(value)
                .font(.system(size: 14, weight: isHighlighted ? .semibold : .medium))
                .foregroundColor(isHighlighted ? AppColors.brand500 : .white)
        }
        .padding(.vertical, Spacing.sm)
    }
}

// MARK: - Agreement Details ViewModel

@Observable
final class AgreementDetailsViewModel {
    private(set) var isLoading = false
    private(set) var hasDocument = false
    private(set) var uploadDate = ""
    private(set) var propertyAddress = ""
    private(set) var propertyCity = ""
    private(set) var propertyState = ""
    private(set) var propertyPincode = ""
    private(set) var monthlyRent = ""
    private(set) var securityDeposit = ""
    private(set) var rentDueDay = 1
    private(set) var leaseStartDate = ""
    private(set) var leaseEndDate = ""
    private(set) var leaseDuration = ""
    private(set) var documentURL: URL?

    private let userService: UserServiceProtocol

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    @MainActor
    func loadAgreementDetails() async {
        isLoading = true

        do {
            guard let tenancy = try await userService.getCurrentTenancy() else {
                isLoading = false
                return
            }

            propertyAddress = tenancy.propertyAddress ?? "Not provided"
            propertyCity = tenancy.propertyCity ?? "Not provided"
            propertyState = tenancy.propertyState ?? "Not provided"
            propertyPincode = tenancy.propertyPincode ?? "Not provided"

            monthlyRent = formatCurrency(tenancy.monthlyRent)
            securityDeposit = formatCurrency(Double(tenancy.securityDepositPaise ?? 0) / 100.0)
            rentDueDay = tenancy.rentDueDay

            // Format dates
            if let startDate = tenancy.leaseStartDate {
                leaseStartDate = formatDateString(startDate)
            } else {
                leaseStartDate = "Not provided"
            }

            if let endDate = tenancy.leaseEndDate {
                leaseEndDate = formatDateString(endDate)
            } else {
                leaseEndDate = "Not provided"
            }

            // Calculate duration
            leaseDuration = calculateDuration(from: tenancy.leaseStartDate, to: tenancy.leaseEndDate)

            // Format upload date from created_at
            uploadDate = formatDateString(tenancy.createdAt)

            hasDocument = true // Assume document exists if tenancy exists

            isLoading = false
        } catch {
            isLoading = false
        }
    }

    func viewDocument() {
        // In real implementation, open the document URL
        // For now, this could trigger a document viewer sheet
        guard let url = documentURL else { return }
        UIApplication.shared.open(url)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "\u{20B9}"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "\u{20B9}\(Int(amount))"
    }

    private func formatDateString(_ dateString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d, yyyy"

        if let date = isoFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        // Try simple date format
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd"
        if let date = simpleFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        return dateString
    }

    private func calculateDuration(from startDate: String?, to endDate: String?) -> String {
        guard let start = startDate, let end = endDate else {
            return "Not specified"
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        guard let startDate = formatter.date(from: start),
              let endDate = formatter.date(from: end) else {
            return "Not specified"
        }

        let calendar = Calendar.current
        let components = calendar.dateComponents([.month], from: startDate, to: endDate)

        if let months = components.month {
            if months == 12 {
                return "1 year"
            } else if months > 12 {
                let years = months / 12
                let remainingMonths = months % 12
                if remainingMonths == 0 {
                    return "\(years) years"
                } else {
                    return "\(years) year\(years > 1 ? "s" : "") \(remainingMonths) month\(remainingMonths > 1 ? "s" : "")"
                }
            } else {
                return "\(months) month\(months > 1 ? "s" : "")"
            }
        }

        return "Not specified"
    }
}

// MARK: - Preview

#Preview {
    AgreementDetailsView()
        .environment(AppCoordinator())
}
