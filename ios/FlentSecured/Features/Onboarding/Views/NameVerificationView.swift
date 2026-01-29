/// NameVerificationView.swift
/// Flent Secured v2 - Name Verification Screen
///
/// Figma Node IDs:
/// - 1:30718 - Agreement --verify name (name confirmation)
/// - 1:30992 - Agreement --modify name (name editing)
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: H1/Regular 400 (48px, tracking -2px)
///   - "Verify your" / "What's your" - Gray (#A9A9A9)
///   - "name" - Brand (#FF9A6D)
/// - Subtitle: 14px Regular, #A6A6A6, line-height 20px
/// - Name card: #262626 background, success border when verified
/// - Verified badge: Success color with checkmark
/// - Edit button: "This isn't my name" link style, brand color
/// - Horizontal padding: 48pt (sp-48)
///
/// States handled:
/// - .idle: Initial state
/// - .fetchingName: Fetching name from Mobile 360
/// - .nameLoaded: Name found, user confirms
/// - .editing: User is modifying name
/// - .saving: Saving name to profile
/// - .error: Error state

import SwiftUI

struct NameVerificationView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = NameVerificationViewModel()
    @State private var isEditing = false
    @FocusState private var focusedField: Field?

    enum Field: Hashable {
        case firstName
        case lastName
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
                        .foregroundColor(AppColors.textPrimary)
                }

                // Header - Figma: H1/Regular 400 with two-color format
                VStack(alignment: .leading, spacing: Spacing.md) {
                    // Two-line headline
                    VStack(alignment: .leading, spacing: 0) {
                        Text(headerFirstLine)
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.neutral500) // #A9A9A9
                            .tracking(-2)
                            .lineSpacing(16)
                        Text("name")
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.brand500) // #FF9A6D
                            .tracking(-2)
                            .lineSpacing(16)
                    }

                    Text(headerSubtitle)
                        .font(Typography.bodyMd2) // 14px Regular
                        .foregroundColor(AppColors.black200) // #A6A6A6
                        .lineSpacing(6)
                }

                // Content based on state
                if case .fetchingName = viewModel.state {
                    fetchingContent
                } else if viewModel.nameWasFetched && !isEditing {
                    nameConfirmationContent
                } else {
                    nameInputContent
                }

                Spacer()

                // Error Message
                if let error = viewModel.errorMessage {
                    errorBanner(message: error)
                }

                // Action Buttons
                actionButtons
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
            .padding(.top, Spacing.xxl) // 40pt top
        }
        .navigationBarHidden(true)
        .onAppear {
            // Pre-fill with name entered during phone entry (if available)
            viewModel.prefillWithPendingName(appState.pendingUserName)

            Task {
                await viewModel.fetchNameFromIdentity()

                if !viewModel.nameWasFetched {
                    isEditing = true
                    focusedField = .firstName
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.state)
        .animation(.easeInOut(duration: 0.2), value: isEditing)
    }

    // MARK: - Header Properties

    private var headerFirstLine: String {
        if viewModel.nameWasFetched && !isEditing {
            return "Verify your"
        }
        return "What's your"
    }

    private var headerSubtitle: String {
        if viewModel.nameWasFetched && !isEditing {
            return "This should match your bank account name"
        }
        return "Enter your name as it appears on your ID"
    }

    // MARK: - Fetching Content

    private var fetchingContent: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()
                .frame(height: Spacing.xxl)

            // Loading animation
            ZStack {
                Circle()
                    .fill(AppColors.backgroundSecondary)
                    .frame(width: 100, height: 100)

                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                    .scaleEffect(1.5)
            }

            VStack(spacing: Spacing.xs) {
                Text("Looking up your details...")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Text("This usually takes a few seconds")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textSecondary)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Name Confirmation Content (Figma: 1:30718)

    private var nameConfirmationContent: some View {
        VStack(spacing: Spacing.lg) {
            // Name Card
            VStack(spacing: Spacing.md) {
                // Verified badge
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.success)

                    Text("Verified from your mobile number")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.success)

                    Spacer()
                }

                // Name display
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text("Full Name")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textMuted)

                    Text(viewModel.fullName.isEmpty ? viewModel.fetchedFullName : viewModel.fullName)
                        .font(.system(size: 24, weight: .medium))
                        .foregroundColor(AppColors.textPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(Spacing.lg)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.success.opacity(0.3), lineWidth: 1)
            )

            // Edit option
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isEditing = true
                    focusedField = .firstName
                }
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "pencil")
                        .font(.system(size: 14))

                    Text("This isn't my name")
                        .font(Typography.bodySmMedium)
                }
                .foregroundColor(AppColors.accentPrimary)
            }
        }
    }

    // MARK: - Name Input Content (Figma: 1:30992)

    private var nameInputContent: some View {
        VStack(spacing: Spacing.md) {
            // Cancel editing button (if switching from confirmation)
            if viewModel.nameWasFetched && isEditing {
                HStack {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            // Reset to fetched values
                            let components = viewModel.fetchedFullName.components(separatedBy: " ")
                            viewModel.firstName = components.first ?? ""
                            viewModel.lastName = components.dropFirst().joined(separator: " ")
                            isEditing = false
                        }
                    } label: {
                        HStack(spacing: Spacing.xxs) {
                            Image(systemName: "xmark")
                                .font(.system(size: 12))
                            Text("Cancel")
                                .font(Typography.bodySm)
                        }
                        .foregroundColor(AppColors.textSecondary)
                    }

                    Spacer()
                }
                .padding(.bottom, Spacing.xs)
            }

            // First Name
            InputField(
                label: "First Name",
                text: $viewModel.firstName,
                placeholder: "Enter your first name"
            )
            .focused($focusedField, equals: .firstName)
            .textContentType(.givenName)
            .textInputAutocapitalization(.words)
            .submitLabel(.next)
            .onSubmit {
                focusedField = .lastName
            }

            // Last Name
            InputField(
                label: "Last Name",
                text: $viewModel.lastName,
                placeholder: "Enter your last name (optional)"
            )
            .focused($focusedField, equals: .lastName)
            .textContentType(.familyName)
            .textInputAutocapitalization(.words)
            .submitLabel(.done)
            .onSubmit {
                focusedField = nil
            }

            // Name matching hint
            HStack(alignment: .top, spacing: Spacing.xs) {
                Image(systemName: "info.circle")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textMuted)

                Text("Your name should match your bank account for seamless payments")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(.top, Spacing.xs)
        }
    }

    // MARK: - Error Banner

    private func errorBanner(message: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 16))
                .foregroundColor(AppColors.error)

            Text(message)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.error)

            Spacer()
        }
        .padding(Spacing.md)
        .background(AppColors.error.opacity(0.1))
        .cornerRadius(Radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
        )
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: Spacing.md) {
            // Skip option (only if fetching failed or in editing mode)
            if viewModel.showSkipOption && !viewModel.isLoading && !viewModel.nameWasFetched {
                Button {
                    viewModel.skipNameVerification()
                    coordinator.navigate(to: .agreementUpload)
                } label: {
                    Text("Skip for now")
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            // Main CTA
            PrimaryButton(
                title: buttonTitle,
                isLoading: viewModel.isLoading,
                isEnabled: viewModel.canProceed
            ) {
                saveName()
            }
        }
    }

    private var buttonTitle: String {
        if viewModel.nameWasFetched && !isEditing {
            return "Confirm & Continue"
        }
        return "Continue"
    }

    // MARK: - Actions

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

// MARK: - Previews

#Preview("Empty") {
    NameVerificationView()
        .environment(AppCoordinator())
}

#Preview("Name Loaded") {
    NameVerificationView()
        .environment(AppCoordinator())
}

#Preview("Editing Mode") {
    NameVerificationView()
        .environment(AppCoordinator())
}

#Preview("Loading") {
    NameVerificationView()
        .environment(AppCoordinator())
}

#Preview("Error") {
    NameVerificationView()
        .environment(AppCoordinator())
}
