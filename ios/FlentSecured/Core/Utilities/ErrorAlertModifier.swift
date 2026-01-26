/// ErrorAlertModifier.swift
/// Flent Secured v2 - Error Alert View Modifier
///
/// SwiftUI view modifier for displaying error alerts consistently

import SwiftUI

// MARK: - Error Alert Modifier

struct ErrorAlertModifier: ViewModifier {
    @Environment(AppState.self) private var appState

    func body(content: Content) -> some View {
        @Bindable var appState = appState

        content
            .alert(
                appState.errorAlert?.title ?? "Error",
                isPresented: $appState.showError,
                presenting: appState.errorAlert
            ) { alert in
                if let primary = alert.primaryAction {
                    Button(primary.title, role: buttonRole(for: primary.style)) {
                        primary.action()
                        appState.dismissError()
                    }
                }
                if let secondary = alert.secondaryAction {
                    Button(secondary.title, role: buttonRole(for: secondary.style)) {
                        secondary.action()
                        appState.dismissError()
                    }
                }
                if alert.primaryAction == nil && alert.secondaryAction == nil {
                    Button("OK") {
                        appState.dismissError()
                    }
                }
            } message: { alert in
                Text(alert.message)
            }
    }

    private func buttonRole(for style: ErrorAlert.AlertAction.ActionStyle) -> ButtonRole? {
        switch style {
        case .default:
            return nil
        case .cancel:
            return .cancel
        case .destructive:
            return .destructive
        }
    }
}

// MARK: - View Extension

extension View {
    /// Adds error alert handling to any view
    func withErrorAlerts() -> some View {
        modifier(ErrorAlertModifier())
    }
}

// MARK: - Error Banner View

/// A banner-style error view for inline errors
struct ErrorBanner: View {
    let error: AppError
    let dismissAction: () -> Void
    let retryAction: (() -> Void)?

    init(
        error: AppError,
        dismissAction: @escaping () -> Void,
        retryAction: (() -> Void)? = nil
    ) {
        self.error = error
        self.dismissAction = dismissAction
        self.retryAction = retryAction
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(AppColors.error)
                .font(.system(size: 16))

            VStack(alignment: .leading, spacing: 2) {
                Text(error.errorDescription ?? "Error")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textPrimary)

                if let suggestion = error.recoverySuggestion {
                    Text(suggestion)
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textSecondary)
                }
            }

            Spacer()

            if error.isRetryable, let retry = retryAction {
                Button {
                    retry()
                } label: {
                    Text("Retry")
                        .font(Typography.label)
                        .foregroundColor(AppColors.accentPrimary)
                }
            }

            Button {
                dismissAction()
            } label: {
                Image(systemName: "xmark")
                    .foregroundColor(AppColors.textSecondary)
                    .font(.system(size: 12, weight: .medium))
            }
        }
        .padding(Spacing.md)
        .background(AppColors.error.opacity(0.1))
        .cornerRadius(Radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.sm)
                .stroke(AppColors.error.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Loading Overlay with Error

/// A loading overlay that can also show errors
struct LoadingOverlay: View {
    let isLoading: Bool
    let error: AppError?
    let retryAction: (() -> Void)?

    var body: some View {
        ZStack {
            if isLoading {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                    .scaleEffect(1.5)
                    .padding(Spacing.xl)
                    .background(AppColors.backgroundSecondary)
                    .cornerRadius(Radius.md)
            }

            if let error = error, !isLoading {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                VStack(spacing: Spacing.lg) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(AppColors.error)

                    VStack(spacing: Spacing.xs) {
                        Text(error.errorDescription ?? "Error")
                            .font(Typography.h4)
                            .foregroundColor(AppColors.textPrimary)

                        Text(error.userMessage)
                            .font(Typography.bodyMd2)
                            .foregroundColor(AppColors.textSecondary)
                            .multilineTextAlignment(.center)
                    }

                    if error.isRetryable, let retry = retryAction {
                        PrimaryButton(title: "Try Again") {
                            retry()
                        }
                        .frame(width: 200)
                    }
                }
                .padding(Spacing.xl)
                .background(AppColors.backgroundSecondary)
                .cornerRadius(Radius.lg)
                .padding(Spacing.xl)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isLoading)
        .animation(.easeInOut(duration: 0.2), value: error)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: Spacing.lg) {
        ErrorBanner(
            error: .noInternet,
            dismissAction: {},
            retryAction: {}
        )

        ErrorBanner(
            error: .paymentFailed(reason: "Card declined"),
            dismissAction: {}
        )

        LoadingOverlay(
            isLoading: false,
            error: .serverUnavailable,
            retryAction: {}
        )
    }
    .padding()
    .background(AppColors.backgroundPrimary)
    .environment(AppState())
}
