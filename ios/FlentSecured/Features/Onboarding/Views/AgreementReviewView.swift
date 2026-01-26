/// AgreementReviewView.swift
/// Flent Secured v2 - Agreement Review Screen
///
/// States handled:
/// - .loading: Fetching extraction data
/// - .extractionPending: Still processing document
/// - .extractionComplete: Data ready for review
/// - .confirming: User confirming data
/// - .confirmed: Successfully confirmed
/// - .error: Error state
///
/// Figma: Onboarding / Agreement Review screens

import SwiftUI

struct AgreementReviewView: View {
    @Environment(AppCoordinator.self) private var coordinator

    let extractionId: String

    @State private var viewModel: AgreementReviewViewModel

    init(extractionId: String) {
        self.extractionId = extractionId
        self._viewModel = State(initialValue: AgreementReviewViewModel(extractionId: extractionId))
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
                    Text(headerTitle)
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text(viewModel.extractionStatusMessage)
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }

                // Content based on state
                contentView
            }
            .screenPadding()
            .padding(.top, Spacing.xl)
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadExtractionStatus()
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.state)
        .onChange(of: viewModel.state) { _, newState in
            if case .confirmed = newState {
                // Navigate to waitlist after confirmation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    coordinator.navigate(to: .waitlist)
                }
            }
        }
    }

    // MARK: - Header Title

    private var headerTitle: String {
        switch viewModel.state {
        case .loading, .extractionPending:
            return "Processing document"
        case .extractionComplete:
            return "Review your details"
        case .confirming:
            return "Confirming..."
        case .confirmed:
            return "All set!"
        case .error:
            return "Something went wrong"
        }
    }

    // MARK: - Content View

    @ViewBuilder
    private var contentView: some View {
        switch viewModel.state {
        case .loading, .extractionPending:
            processingView

        case .extractionComplete:
            reviewView

        case .confirming:
            reviewView

        case .confirmed:
            confirmedView

        case .error(let message):
            errorView(message: message)
        }
    }

    // MARK: - Processing View

    private var processingView: some View {
        VStack(spacing: Spacing.md) {
            Spacer()

            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                .scaleEffect(1.5)

            Text("Extracting details from your agreement...")
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)

            Text("This usually takes about a minute")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Review View

    private var reviewView: some View {
        VStack(spacing: Spacing.lg) {
            ScrollView {
                VStack(spacing: Spacing.md) {
                    // Property Section
                    ReviewSection(title: "Property") {
                        EditableReviewField(
                            label: "Address",
                            text: $viewModel.propertyAddress,
                            isRequired: true
                        )

                        HStack(spacing: Spacing.sm) {
                            EditableReviewField(
                                label: "City",
                                text: $viewModel.propertyCity,
                                isRequired: true
                            )

                            EditableReviewField(
                                label: "Pincode",
                                text: $viewModel.propertyPincode,
                                keyboardType: .numberPad
                            )
                        }
                    }

                    // Rent Section
                    ReviewSection(title: "Rent Details") {
                        HStack(spacing: Spacing.sm) {
                            EditableReviewField(
                                label: "Monthly Rent (₹)",
                                text: $viewModel.monthlyRent,
                                keyboardType: .numberPad,
                                isRequired: true
                            )

                            EditableReviewField(
                                label: "Due Day",
                                text: $viewModel.rentDueDay,
                                placeholder: "5",
                                keyboardType: .numberPad
                            )
                        }

                        EditableReviewField(
                            label: "Security Deposit (₹)",
                            text: $viewModel.securityDeposit,
                            keyboardType: .numberPad
                        )
                    }

                    // People Section
                    ReviewSection(title: "People") {
                        EditableReviewField(
                            label: "Tenant Name",
                            text: $viewModel.tenantName,
                            isRequired: true
                        )

                        EditableReviewField(
                            label: "Landlord Name",
                            text: $viewModel.landlordName,
                            isRequired: true
                        )

                        EditableReviewField(
                            label: "Landlord Phone",
                            text: $viewModel.landlordPhone,
                            keyboardType: .phonePad
                        )
                    }
                }
                .padding(.bottom, Spacing.lg)
            }

            // Error Message
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.error)
            }

            // Confirm Button
            PrimaryButton(
                title: "Confirm & Continue",
                isLoading: viewModel.isLoading,
                isEnabled: viewModel.canConfirm
            ) {
                confirmExtraction()
            }
        }
    }

    // MARK: - Confirmed View

    private var confirmedView: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(AppColors.success)

            VStack(spacing: Spacing.sm) {
                Text("Details confirmed!")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text("Taking you to the next step...")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Error View

    private func errorView(message: String) -> some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundColor(AppColors.error)

            VStack(spacing: Spacing.sm) {
                Text("Processing failed")
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)

                Text(message)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            PrimaryButton(title: "Try Again") {
                Task {
                    await viewModel.retry()
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Actions

    private func confirmExtraction() {
        Task {
            _ = await viewModel.confirmExtraction()
        }
    }
}

// MARK: - Review Section

struct ReviewSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title)
                .font(Typography.bodySmMedium)
                .foregroundColor(AppColors.textMuted)
                .padding(.horizontal, Spacing.xs)

            VStack(spacing: Spacing.sm) {
                content()
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)
        }
    }
}

// MARK: - Editable Review Field

struct EditableReviewField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default
    var isRequired: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            HStack(spacing: Spacing.xxxs) {
                Text(label)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)

                if isRequired {
                    Text("*")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.error)
                }
            }

            TextField(placeholder.isEmpty ? label : placeholder, text: $text)
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.textPrimary)
                .keyboardType(keyboardType)
                .padding(.vertical, Spacing.xs)
                .padding(.horizontal, Spacing.sm)
                .background(AppColors.backgroundPrimary)
                .cornerRadius(Radius.sm)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .stroke(
                            isRequired && text.isEmpty ? AppColors.error.opacity(0.5) : AppColors.border,
                            lineWidth: 1
                        )
                )
        }
    }
}

// MARK: - Legacy Review Field (Read-only)

struct ReviewField: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text(label)
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)

            Text(value)
                .font(Typography.bodyMd)
                .foregroundColor(AppColors.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.sm)
    }
}

#Preview("Loading") {
    AgreementReviewView(extractionId: "test-123")
        .environment(AppCoordinator())
}

#Preview("With Data") {
    AgreementReviewView(extractionId: "test-123")
        .environment(AppCoordinator())
}

#Preview("Error") {
    AgreementReviewView(extractionId: "test-123")
        .environment(AppCoordinator())
}
