/// EmptyStateView.swift
/// Flent Secured v2 - Empty State Components
///
/// Views for empty lists and zero states

import SwiftUI

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var buttonTitle: String? = nil
    var buttonAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            // Icon
            ZStack {
                Circle()
                    .fill(AppColors.backgroundSecondary)
                    .frame(width: 100, height: 100)

                Image(systemName: icon)
                    .font(.system(size: 40))
                    .foregroundColor(AppColors.textMuted)
            }

            // Text
            VStack(spacing: Spacing.sm) {
                Text(title)
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.lg)

            // Optional Button
            if let buttonTitle = buttonTitle, let action = buttonAction {
                PrimaryButton(title: buttonTitle, action: action)
                    .padding(.horizontal, Spacing.xl)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - No Transactions

struct NoTransactionsView: View {
    var body: some View {
        EmptyStateView(
            icon: "clock.arrow.circlepath",
            title: "No transactions yet",
            message: "Your payment history will appear here once you make your first rent payment."
        )
    }
}

// MARK: - No Notifications

struct NoNotificationsView: View {
    var body: some View {
        EmptyStateView(
            icon: "bell.slash",
            title: "No notifications",
            message: "You're all caught up! New notifications will appear here."
        )
    }
}

// MARK: - No Search Results

struct NoSearchResultsView: View {
    let query: String

    var body: some View {
        EmptyStateView(
            icon: "magnifyingglass",
            title: "No results found",
            message: "We couldn't find anything matching \"\(query)\". Try a different search."
        )
    }
}

// MARK: - Network Error

struct NetworkErrorView: View {
    let retryAction: () -> Void

    var body: some View {
        EmptyStateView(
            icon: "wifi.slash",
            title: "No connection",
            message: "Please check your internet connection and try again.",
            buttonTitle: "Retry",
            buttonAction: retryAction
        )
    }
}

// MARK: - Generic Error

struct ErrorStateView: View {
    let title: String
    let message: String
    var retryAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            // Icon
            ZStack {
                Circle()
                    .fill(AppColors.error.opacity(0.1))
                    .frame(width: 100, height: 100)

                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(AppColors.error)
            }

            // Text
            VStack(spacing: Spacing.sm) {
                Text(title)
                    .font(Typography.h4)
                    .foregroundColor(AppColors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.lg)

            // Retry Button
            if let action = retryAction {
                PrimaryButton(title: "Try Again", style: .secondary, action: action)
                    .padding(.horizontal, Spacing.xl)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview

#Preview {
    VStack {
        EmptyStateView(
            icon: "doc.text",
            title: "No documents",
            message: "Upload your rental agreement to get started",
            buttonTitle: "Upload Document",
            buttonAction: {}
        )
    }
    .background(AppColors.backgroundPrimary)
}
