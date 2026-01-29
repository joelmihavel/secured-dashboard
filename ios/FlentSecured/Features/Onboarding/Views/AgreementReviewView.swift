/// AgreementReviewView.swift
/// Flent Secured v2 - Agreement Review Screen
///
/// Figma Node ID: 1:31380 - Agreement verify
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: H1/Regular 400 (48px, tracking -2px)
///   - "Review your" - Gray (#A9A9A9)
///   - "details" - Brand (#FF9A6D)
/// - Horizontal padding: 48pt (sp-48)
///
/// States handled:
/// - .loading: Fetching extraction data
/// - .extractionPending: Still processing document (AI reading)
/// - .extractionComplete: Data ready for review with edit capability
/// - .confirming: User confirming data
/// - .confirmed: Successfully confirmed
/// - .error: Error state
///
/// Features:
/// - AI extraction progress display
/// - Editable fields for correction
/// - Validation with required field indicators
/// - Smooth confirmation animation

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

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Back Button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.white)
                }

                // Header - Figma: H1/Regular 400 with two-color format
                VStack(alignment: .leading, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(headerFirstLine)
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.neutral500) // #A9A9A9
                            .tracking(-2)
                            .lineSpacing(16)
                        Text(headerSecondLine)
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.brand500) // #FF9A6D
                            .tracking(-2)
                            .lineSpacing(16)
                    }

                    Text(viewModel.extractionStatusMessage)
                        .font(Typography.bodyMd2) // 14px Regular
                        .foregroundColor(AppColors.black200) // #A6A6A6
                        .lineSpacing(6)
                }

                // Content based on state
                contentView
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
            .padding(.top, Spacing.xxl) // 40pt top
        }
        .navigationBarHidden(true)
        .onAppear {
            print("[AgreementReviewView] View appeared with extractionId: \(extractionId)")
        }
        .task {
            print("[AgreementReviewView] Starting loadExtractionStatus task")
            await viewModel.loadExtractionStatus()
            print("[AgreementReviewView] loadExtractionStatus completed, state: \(viewModel.state)")
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

    // MARK: - Header Properties

    private var headerFirstLine: String {
        switch viewModel.state {
        case .loading, .extractionPending:
            return "Processing"
        case .extractionComplete, .confirming:
            return "Review your"
        case .confirmed:
            return "All"
        case .error:
            return "Something"
        }
    }

    private var headerSecondLine: String {
        switch viewModel.state {
        case .loading, .extractionPending:
            return "document"
        case .extractionComplete, .confirming:
            return "details"
        case .confirmed:
            return "set!"
        case .error:
            return "went wrong"
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
        VStack(spacing: Spacing.xl) {
            Spacer()

            // AI Processing Animation
            AIProcessingAnimation()
                .frame(width: 120, height: 120)

            VStack(spacing: Spacing.sm) {
                Text("AI is reading your agreement")
                    .font(Typography.h5)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text("Extracting tenant, landlord, property,\nand rent details...")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }

            // Extraction Progress Steps
            VStack(alignment: .leading, spacing: Spacing.sm) {
                extractionStepRow(title: "Scanning document", isComplete: true, isActive: false)
                extractionStepRow(title: "Identifying parties", isComplete: false, isActive: true)
                extractionStepRow(title: "Extracting rent details", isComplete: false, isActive: false)
                extractionStepRow(title: "Verifying information", isComplete: false, isActive: false)
            }
            .padding(Spacing.md)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)

            Text("This usually takes about a minute")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func extractionStepRow(title: String, isComplete: Bool, isActive: Bool) -> some View {
        HStack(spacing: Spacing.sm) {
            if isComplete {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.success)
            } else if isActive {
                ProgressView()
                    .scaleEffect(0.7)
                    .frame(width: 16, height: 16)
            } else {
                Circle()
                    .stroke(AppColors.border, lineWidth: 1.5)
                    .frame(width: 16, height: 16)
            }

            Text(title)
                .font(Typography.bodySm)
                .foregroundColor(isComplete || isActive ? AppColors.textPrimary : AppColors.textMuted)

            Spacer()
        }
    }

    // MARK: - Review View

    private var reviewView: some View {
        VStack(spacing: Spacing.lg) {
            // AI Extraction Badge
            ExtractionSummaryBadge(
                fieldCount: 9,
                extractedCount: countExtractedFields()
            )

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

    // MARK: - Helpers

    private func countExtractedFields() -> Int {
        var count = 0
        if !viewModel.propertyAddress.isEmpty { count += 1 }
        if !viewModel.propertyCity.isEmpty { count += 1 }
        if !viewModel.propertyPincode.isEmpty { count += 1 }
        if !viewModel.monthlyRent.isEmpty { count += 1 }
        if !viewModel.securityDeposit.isEmpty { count += 1 }
        if !viewModel.rentDueDay.isEmpty { count += 1 }
        if !viewModel.tenantName.isEmpty { count += 1 }
        if !viewModel.landlordName.isEmpty { count += 1 }
        if !viewModel.landlordPhone.isEmpty { count += 1 }
        return count
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

// MARK: - AI Processing Animation

struct AIProcessingAnimation: View {
    @State private var rotation: Double = 0
    @State private var scale: CGFloat = 1.0
    @State private var opacity: Double = 0.5

    var body: some View {
        ZStack {
            // Outer pulsing ring
            Circle()
                .stroke(AppColors.accentPrimary.opacity(opacity), lineWidth: 3)
                .frame(width: 100, height: 100)
                .scaleEffect(scale)

            // Inner rotating ring
            Circle()
                .trim(from: 0, to: 0.7)
                .stroke(
                    LinearGradient(
                        colors: [AppColors.accentPrimary, AppColors.accentPrimary.opacity(0.1)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .frame(width: 80, height: 80)
                .rotationEffect(.degrees(rotation))

            // Center icon
            Image(systemName: "sparkles")
                .font(.system(size: 32))
                .foregroundColor(AppColors.accentPrimary)
                .symbolEffect(.variableColor.iterative)
        }
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                rotation = 360
            }
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                scale = 1.1
                opacity = 0.2
            }
        }
    }
}

// MARK: - Extraction Summary Badge

struct ExtractionSummaryBadge: View {
    let fieldCount: Int
    let extractedCount: Int

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "sparkles")
                .font(.system(size: 12))
                .foregroundColor(AppColors.accentPrimary)

            Text("\(extractedCount)/\(fieldCount) fields extracted by AI")
                .font(Typography.caption)
                .foregroundColor(AppColors.textSecondary)

            Spacer()

            Text("Edit below if needed")
                .font(Typography.caption)
                .foregroundColor(AppColors.accentPrimary)
        }
        .padding(Spacing.sm)
        .background(AppColors.accentPrimary.opacity(0.05))
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
