/// NameVerificationView.swift
/// Flent Secured v2 - Name Verification Screen
///
/// States handled:
/// - .idle: Initial state
/// - .fetchingName: Fetching name from Mobile 360
/// - .nameLoaded: Name found, user confirms
/// - .saving: Saving name to profile
/// - .error: Error state
///
/// Figma: Onboarding / Name Verification screens

import SwiftUI

struct NameVerificationView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = NameVerificationViewModel()
    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case firstName
        case lastName
    }

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

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
                    Text(viewModel.nameWasFetched ? "Is this your name?" : "What's your name?")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text("This should match your bank account name")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }

                // Loading State
                if case .fetchingName = viewModel.state {
                    VStack(spacing: Spacing.md) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                            .scaleEffect(1.2)

                        Text("Fetching your name...")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.xxl)
                } else {
                    // Name Fields
                    VStack(spacing: Spacing.md) {
                        // Fetched Name Badge (if name was auto-fetched)
                        if viewModel.nameWasFetched {
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(AppColors.success)
                                    .font(.system(size: 14))

                                Text("Auto-filled from your mobile number")
                                    .font(Typography.caption)
                                    .foregroundColor(AppColors.textSecondary)
                            }
                            .padding(.bottom, Spacing.xs)
                        }

                        InputField(
                            label: "First Name",
                            text: $viewModel.firstName,
                            placeholder: "Enter first name"
                        )
                        .focused($focusedField, equals: .firstName)
                        .textContentType(.givenName)
                        .submitLabel(.next)
                        .onSubmit {
                            focusedField = .lastName
                        }

                        InputField(
                            label: "Last Name (Optional)",
                            text: $viewModel.lastName,
                            placeholder: "Enter last name"
                        )
                        .focused($focusedField, equals: .lastName)
                        .textContentType(.familyName)
                        .submitLabel(.done)
                        .onSubmit {
                            focusedField = nil
                        }
                    }

                    // Error Message
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.error)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }

                Spacer()

                // Skip Option (if name fetch failed)
                if viewModel.showSkipOption && !viewModel.isLoading {
                    Button {
                        viewModel.skipNameVerification()
                        coordinator.navigate(to: .agreementUpload)
                    } label: {
                        Text("Skip for now")
                            .font(Typography.bodySmMedium)
                            .foregroundColor(AppColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, Spacing.sm)
                }

                // Continue Button
                PrimaryButton(
                    title: viewModel.nameWasFetched ? "Confirm" : "Continue",
                    isLoading: viewModel.isLoading,
                    isEnabled: viewModel.canProceed
                ) {
                    saveName()
                }
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .onAppear {
            // Try to fetch name from identity service
            Task {
                await viewModel.fetchNameFromIdentity()

                // Focus first name field if no name was fetched
                if !viewModel.nameWasFetched {
                    focusedField = .firstName
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.state)
    }

    private func saveName() {
        focusedField = nil

        Task {
            let success = await viewModel.saveName()
            if success {
                coordinator.navigate(to: .agreementUpload)
            }
        }
    }
}

#Preview("Empty") {
    NameVerificationView()
        .environment(AppCoordinator())
}

#Preview("Name Loaded") {
    struct PreviewWrapper: View {
        var body: some View {
            NameVerificationView()
                .environment(AppCoordinator())
        }
    }
    return PreviewWrapper()
}

#Preview("Loading") {
    struct PreviewWrapper: View {
        var body: some View {
            NameVerificationView()
                .environment(AppCoordinator())
        }
    }
    return PreviewWrapper()
}
