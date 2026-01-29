/// LandlordBankAccountView.swift
/// Flent Secured v2 - Landlord Bank Account View
///
/// Figma: 41:9307 - Bank Account Section
/// Shows the landlord's bank account details where rent payments are transferred

import SwiftUI

// MARK: - Landlord Bank Account View

struct LandlordBankAccountView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var viewModel = LandlordBankAccountViewModel()

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
                            Text("Landlord")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(.white)
                            Text("Bank Account")
                                .font(.system(size: 32, weight: .light))
                                .foregroundColor(AppColors.brand500)
                        }

                        // Verification Status Card
                        verificationStatusCard

                        // Bank Details (if verified)
                        if viewModel.isVerified {
                            bankDetailsSection
                            securityNoticeCard
                        } else {
                            addBankCTASection
                        }

                        Spacer()
                    }
                    .padding(.horizontal, Spacing.screenHorizontalCompact)
                }
            }
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadBankDetails()
        }
    }

    // MARK: - Verification Status Card

    private var verificationStatusCard: some View {
        HStack(spacing: Spacing.md) {
            // Status icon
            ZStack {
                Circle()
                    .fill(viewModel.statusColor.opacity(0.15))
                    .frame(width: 48, height: 48)

                Image(systemName: viewModel.isVerified ? "checkmark.shield.fill" : "shield.fill")
                    .font(.system(size: 20))
                    .foregroundColor(viewModel.statusColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(viewModel.isVerified ? "Bank Verified" : "Verification Pending")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text(viewModel.isVerified ?
                     "Rent payments are securely transferred here" :
                     "Add bank details to enable rent payments")
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
                .stroke(viewModel.statusColor.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Bank Details Section

    private var bankDetailsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("BANK INFORMATION")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(AppColors.neutral500)
                .tracking(1.5)

            VStack(spacing: 0) {
                BankDetailRow(label: "Bank Name", value: viewModel.bankName)
                Divider().background(AppColors.black400.opacity(0.5))
                BankDetailRow(label: "Account Holder", value: viewModel.accountHolder)
                Divider().background(AppColors.black400.opacity(0.5))
                BankDetailRow(label: "Account Number", value: viewModel.maskedAccountNumber)
                Divider().background(AppColors.black400.opacity(0.5))
                BankDetailRow(label: "IFSC Code", value: viewModel.ifscCode)
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

    // MARK: - Security Notice Card

    private var securityNoticeCard: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 16))
                .foregroundColor(AppColors.success)

            Text("Bank details are encrypted and securely stored. Only the last 4 digits are shown for security.")
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.md)
        .background(AppColors.success.opacity(0.1))
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.success.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Add Bank CTA Section

    private var addBankCTASection: some View {
        VStack(spacing: Spacing.lg) {
            // Empty state
            VStack(spacing: Spacing.md) {
                ZStack {
                    Circle()
                        .fill(AppColors.black400.opacity(0.2))
                        .frame(width: 80, height: 80)

                    Image(systemName: "building.columns")
                        .font(.system(size: 32))
                        .foregroundColor(AppColors.neutral500)
                }

                Text("No bank account added")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Text("Add your landlord's bank account details to enable secure rent transfers.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xxl)

            // Add Bank CTA
            PrimaryButton(title: "Add Bank Account") {
                coordinator.navigate(to: .addBank)
            }
        }
    }
}

// MARK: - Bank Detail Row

private struct BankDetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(AppColors.neutral500)

            Spacer()

            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white)
        }
        .padding(.vertical, Spacing.sm)
    }
}

// MARK: - Landlord Bank Account ViewModel

@Observable
final class LandlordBankAccountViewModel {
    private(set) var isLoading = false
    private(set) var isVerified = false
    private(set) var bankName = ""
    private(set) var accountHolder = ""
    private(set) var accountNumber = ""
    private(set) var ifscCode = ""

    var statusColor: Color {
        isVerified ? AppColors.success : AppColors.neutral500
    }

    var maskedAccountNumber: String {
        guard accountNumber.count >= 4 else { return accountNumber }
        let lastFour = accountNumber.suffix(4)
        return "XXXX XXXX \(lastFour)"
    }

    private let userService: UserServiceProtocol

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    @MainActor
    func loadBankDetails() async {
        isLoading = true

        do {
            guard let tenancy = try await userService.getCurrentTenancy() else {
                isLoading = false
                isVerified = false
                return
            }

            isVerified = tenancy.bankVerified

            if isVerified {
                // In real implementation, load bank details from a secure endpoint
                // For now, use placeholder data
                bankName = "HDFC Bank"
                accountHolder = tenancy.landlordName ?? "Landlord"
                accountNumber = "XXXXXXXXXXXX1234"
                ifscCode = "HDFC0001234"
            }

            isLoading = false
        } catch {
            isLoading = false
            isVerified = false
        }
    }
}

// MARK: - Preview

#Preview {
    LandlordBankAccountView()
        .environment(AppCoordinator())
}
