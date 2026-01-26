/// Toast.swift
/// Flent Secured v2 - Toast/Snackbar Component
///
/// Displays temporary messages at the bottom of the screen

import SwiftUI

// MARK: - Toast Type

enum ToastType {
    case success
    case error
    case warning
    case info

    var iconName: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .info: return "info.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .success: return AppColors.success
        case .error: return AppColors.error
        case .warning: return AppColors.warning
        case .info: return AppColors.accentPrimary
        }
    }
}

// MARK: - Toast View

struct ToastView: View {
    let type: ToastType
    let message: String
    var action: (() -> Void)? = nil
    var actionTitle: String? = nil

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: type.iconName)
                .foregroundColor(type.color)
                .font(.system(size: 20))

            Text(message)
                .font(Typography.bodySm)
                .foregroundColor(AppColors.textPrimary)
                .lineLimit(2)

            Spacer()

            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.accentPrimary)
                }
            }
        }
        .padding(Spacing.md)
        .background(AppColors.backgroundSecondary)
        .cornerRadius(Radius.card)
        .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
        .padding(.horizontal, Spacing.md)
    }
}

// MARK: - Toast Modifier

struct ToastModifier: ViewModifier {
    @Binding var isPresented: Bool
    let type: ToastType
    let message: String
    var duration: TimeInterval = 3
    var action: (() -> Void)? = nil
    var actionTitle: String? = nil

    func body(content: Content) -> some View {
        ZStack(alignment: .bottom) {
            content

            if isPresented {
                ToastView(
                    type: type,
                    message: message,
                    action: action,
                    actionTitle: actionTitle
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .padding(.bottom, Spacing.xl)
                .onAppear {
                    // Auto-dismiss
                    DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
                        withAnimation {
                            isPresented = false
                        }
                    }
                }
            }
        }
        .animation(.spring(response: 0.3), value: isPresented)
    }
}

extension View {
    func toast(
        isPresented: Binding<Bool>,
        type: ToastType,
        message: String,
        duration: TimeInterval = 3,
        action: (() -> Void)? = nil,
        actionTitle: String? = nil
    ) -> some View {
        modifier(ToastModifier(
            isPresented: isPresented,
            type: type,
            message: message,
            duration: duration,
            action: action,
            actionTitle: actionTitle
        ))
    }

    func successToast(isPresented: Binding<Bool>, message: String) -> some View {
        toast(isPresented: isPresented, type: .success, message: message)
    }

    func errorToast(isPresented: Binding<Bool>, message: String, retryAction: (() -> Void)? = nil) -> some View {
        toast(
            isPresented: isPresented,
            type: .error,
            message: message,
            action: retryAction,
            actionTitle: retryAction != nil ? "Retry" : nil
        )
    }
}

// MARK: - Toast Manager

@Observable
final class ToastManager {
    static let shared = ToastManager()

    private(set) var isPresented: Bool = false
    private(set) var type: ToastType = .info
    private(set) var message: String = ""

    private init() {}

    func show(_ type: ToastType, message: String) {
        self.type = type
        self.message = message
        withAnimation {
            isPresented = true
        }
    }

    func showSuccess(_ message: String) {
        show(.success, message: message)
        HapticManager.shared.success()
    }

    func showError(_ message: String) {
        show(.error, message: message)
        HapticManager.shared.error()
    }

    func showWarning(_ message: String) {
        show(.warning, message: message)
        HapticManager.shared.warning()
    }

    func showInfo(_ message: String) {
        show(.info, message: message)
    }

    func dismiss() {
        withAnimation {
            isPresented = false
        }
    }
}

// MARK: - Preview

#Preview {
    VStack {
        Spacer()

        ToastView(type: .success, message: "Payment successful!")

        ToastView(
            type: .error,
            message: "Payment failed. Please try again.",
            action: {},
            actionTitle: "Retry"
        )

        ToastView(type: .warning, message: "Pay by 7th to earn cashback")

        ToastView(type: .info, message: "Your receipt is ready")
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
