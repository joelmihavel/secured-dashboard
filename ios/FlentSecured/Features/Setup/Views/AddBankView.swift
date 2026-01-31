/// AddBankView.swift
/// Flent Secured v2 - Add Bank Account Screen
///
/// Verifies landlord's bank account via Cashfree Penny Drop
///
/// Figma: Setup / Add Bank screens

import SwiftUI

struct AddBankView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: AddBankViewModel
    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case accountHolderName
        case accountNumber
        case confirmAccountNumber
        case ifscCode
    }

    init() {
        // Initialize with tenancy ID from AppState
        // In real app, get from AppState.currentTenancy?.id
        self._viewModel = State(initialValue: AddBankViewModel(tenancyId: ""))
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.xl) {
                    // Back Button
                    Button {
                        coordinator.pop()
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(AppColors.textPrimary)
                    }

                    // Header - Figma: node_1-33737
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        // Logo
                        Image("flent-logo")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 26.7, height: 32)

                        // Title - H1 style
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Add your")
                                .foregroundColor(AppColors.neutral500)
                            Text("Landlord's")
                                .foregroundColor(AppColors.neutral500)
                            Text("Bank Details")
                                .foregroundColor(AppColors.brand500)
                        }
                        .font(Typography.h1)
                        .tracking(-2)
                        .lineSpacing(16)
                    }

                    // Verified State
                    if viewModel.isVerified, let result = viewModel.verificationResult {
                        verifiedContent(result: result)
                    } else {
                        // Form
                        formContent
                    }
                }
                .screenPadding()
                .padding(.top, Spacing.xl)
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            // Update tenancy ID from AppState
            if let tenancyId = appState.currentTenancy?.id {
                viewModel = AddBankViewModel(tenancyId: tenancyId)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.state)
    }

    // MARK: - Form Content

    private var formContent: some View {
        VStack(spacing: Spacing.md) {
            InputField(
                label: "Account Holder Name",
                text: $viewModel.accountHolderName,
                placeholder: "As per bank records"
            )
            .focused($focusedField, equals: .accountHolderName)
            .textContentType(.name)
            .textInputAutocapitalization(.words)
            .submitLabel(.next)
            .onSubmit { focusedField = .accountNumber }

            InputField(
                label: "Account Number",
                text: $viewModel.accountNumber,
                placeholder: "Enter account number",
                keyboardType: .numberPad
            )
            .focused($focusedField, equals: .accountNumber)
            .onChange(of: viewModel.accountNumber) { _, newValue in
                viewModel.accountNumber = String(newValue.filter { $0.isNumber }.prefix(18))
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                InputField(
                    label: "Confirm Account Number",
                    text: $viewModel.confirmAccountNumber,
                    placeholder: "Re-enter account number",
                    keyboardType: .numberPad
                )
                .focused($focusedField, equals: .confirmAccountNumber)
                .onChange(of: viewModel.confirmAccountNumber) { _, newValue in
                    viewModel.confirmAccountNumber = String(newValue.filter { $0.isNumber }.prefix(18))
                }

                if let error = viewModel.accountNumberMismatchError {
                    Text(error)
                        .font(Typography.caption)
                        .foregroundColor(AppColors.error)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                InputField(
                    label: "IFSC Code",
                    text: $viewModel.ifscCode,
                    placeholder: "e.g., HDFC0001234"
                )
                .focused($focusedField, equals: .ifscCode)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .onChange(of: viewModel.ifscCode) { _, newValue in
                    viewModel.ifscCode = String(newValue.uppercased().prefix(11))
                }

                if let error = viewModel.ifscError {
                    Text(error)
                        .font(Typography.caption)
                        .foregroundColor(AppColors.error)
                }
            }

            // Error Message
            if let error = viewModel.errorMessage {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(AppColors.error)
                    Text(error)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.error)
                }
                .padding(Spacing.sm)
                .background(AppColors.error.opacity(0.1))
                .cornerRadius(Radius.sm)
            }

            Spacer()
                .frame(height: Spacing.xl)

            // Verify Button
            PrimaryButton(
                title: "Verify Account",
                isLoading: viewModel.isVerifying,
                isEnabled: viewModel.canVerify
            ) {
                verifyAccount()
            }

            // Security Note
            HStack(spacing: Spacing.xs) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.textMuted)

                Text("Bank details are encrypted and secure")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    // MARK: - Verified Content

    private func verifiedContent(result: BankVerificationResult) -> some View {
        VStack(spacing: Spacing.xl) {
            Spacer()
                .frame(height: Spacing.xl)

            // Success Icon
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.success)

            VStack(spacing: Spacing.sm) {
                Text("Account Verified")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                if let verifiedName = result.verifiedName {
                    Text(verifiedName)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            // Account Details Card
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack {
                    Text("Account")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                    Spacer()
                    Text(viewModel.maskedAccountNumber)
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.textPrimary)
                }

                HStack {
                    Text("IFSC")
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textMuted)
                    Spacer()
                    Text(viewModel.ifscCode)
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.textPrimary)
                }

                if let bankName = result.bankName {
                    HStack {
                        Text("Bank")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                        Spacer()
                        Text(bankName)
                            .font(Typography.bodySmMedium)
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)

            Spacer()

            PrimaryButton(title: "Continue") {
                coordinator.pop()
            }
        }
    }

    // MARK: - Actions

    private func verifyAccount() {
        focusedField = nil

        Task {
            let success = await viewModel.verifyAccount()
            if success {
                // Auto-navigate after short delay
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                coordinator.pop()
            }
        }
    }
}

#Preview {
    AddBankView()
        .environment(AppCoordinator())
        .environment(AppState())
}
