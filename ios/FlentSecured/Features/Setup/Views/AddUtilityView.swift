/// AddUtilityView.swift
/// Flent Secured v2 - Add Utility Bill Screen
///
/// Verifies property ownership via utility bill
///
/// Figma: Setup / Add Utility screens

import SwiftUI

struct AddUtilityView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel: AddUtilityViewModel
    @FocusState private var isConsumerNumberFocused: Bool

    init() {
        self._viewModel = State(initialValue: AddUtilityViewModel(tenancyId: ""))
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

                    // Header
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Verify utility bill")
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)

                        Text("This confirms your landlord owns the property")
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)
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
        .task {
            // Update tenancy ID from AppState
            if let tenancyId = appState.currentTenancy?.id {
                viewModel = AddUtilityViewModel(tenancyId: tenancyId)
            }
            await viewModel.loadOperators()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.state)
    }

    // MARK: - Form Content

    private var formContent: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            // Operator Selection
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Select electricity provider")
                    .font(Typography.label)
                    .foregroundColor(AppColors.textSecondary)

                if viewModel.isLoadingOperators {
                    HStack {
                        ProgressView()
                            .tint(AppColors.accentPrimary)
                        Text("Loading operators...")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                    }
                    .padding(.vertical, Spacing.md)
                } else {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: Spacing.sm) {
                        ForEach(viewModel.operators, id: \.operatorCode) { op in
                            OperatorCard(
                                operator: op,
                                isSelected: viewModel.selectedOperator?.operatorCode == op.operatorCode
                            ) {
                                viewModel.selectOperator(op)
                            }
                        }
                    }
                }
            }

            // Consumer Number
            InputField(
                label: "Consumer Number",
                text: $viewModel.consumerNumber,
                placeholder: "Enter your consumer number"
            )
            .focused($isConsumerNumberFocused)

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
                title: "Verify Bill",
                isLoading: viewModel.isVerifying,
                isEnabled: viewModel.canVerify
            ) {
                verifyUtility()
            }

            // Info Note
            HStack(alignment: .top, spacing: Spacing.xs) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)

                Text("We fetch your latest bill to verify landlord ownership. No payment will be made.")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    // MARK: - Verified Content

    private func verifiedContent(result: UtilityVerificationResult) -> some View {
        VStack(spacing: Spacing.xl) {
            Spacer()
                .frame(height: Spacing.xl)

            // Success Icon
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.success)

            VStack(spacing: Spacing.sm) {
                Text("Utility Verified")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                if let consumerName = result.consumerName {
                    Text(consumerName)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            // Verification Details Card
            VStack(alignment: .leading, spacing: Spacing.sm) {
                if result.nameVerified {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(AppColors.success)
                        Text("Name verified")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textPrimary)
                        Spacer()
                    }
                }

                if result.addressVerified {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(AppColors.success)
                        Text("Address verified")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textPrimary)
                        Spacer()
                    }
                }

                if let matchScore = result.nameMatchScore {
                    HStack {
                        Text("Match confidence")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textMuted)
                        Spacer()
                        Text("\(matchScore)%")
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

    private func verifyUtility() {
        isConsumerNumberFocused = false

        Task {
            let success = await viewModel.verifyUtility()
            if success {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                coordinator.pop()
            }
        }
    }
}

// MARK: - Operator Card

struct OperatorCard: View {
    let `operator`: UtilityOperator
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Spacing.xs) {
                Text(`operator`.operatorName)
                    .font(Typography.bodySmMedium)
                    .foregroundColor(isSelected ? AppColors.accentPrimary : AppColors.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

                Text(`operator`.state)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 70)
            .padding(Spacing.md)
            .background(isSelected ? AppColors.accentPrimary.opacity(0.1) : AppColors.backgroundSecondary)
            .cornerRadius(Radius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(
                        isSelected ? AppColors.accentPrimary : AppColors.border,
                        lineWidth: isSelected ? 2 : 1
                    )
            )
        }
    }
}

#Preview {
    AddUtilityView()
        .environment(AppCoordinator())
        .environment(AppState())
}
