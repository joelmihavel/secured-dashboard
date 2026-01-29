/// HapticManager.swift
/// Flent Secured v2 - Haptic Feedback Manager
///
/// Provides haptic feedback throughout the app for better UX

import UIKit

// MARK: - Haptic Manager

final class HapticManager {
    static let shared = HapticManager()

    private init() {}

    // MARK: - Impact Feedback

    /// Light impact - for subtle interactions like toggles
    func lightImpact() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Medium impact - for button taps
    func mediumImpact() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Heavy impact - for significant actions
    func heavyImpact() {
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Soft impact - iOS 13+ for gentle feedback
    func softImpact() {
        let generator = UIImpactFeedbackGenerator(style: .soft)
        generator.prepare()
        generator.impactOccurred()
    }

    /// Rigid impact - iOS 13+ for firm feedback
    func rigidImpact() {
        let generator = UIImpactFeedbackGenerator(style: .rigid)
        generator.prepare()
        generator.impactOccurred()
    }

    // MARK: - Notification Feedback

    /// Success feedback - payment completed, verification passed
    func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }

    /// Warning feedback - approaching deadline, incomplete setup
    func warning() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.warning)
    }

    /// Error feedback - payment failed, validation error
    func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.error)
    }

    /// Generic notification feedback
    func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }

    // MARK: - Selection Feedback

    /// Selection changed - picker, segment control
    func selectionChanged() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    // MARK: - Custom Patterns

    /// Double tap pattern for confirmation
    func confirmationPattern() {
        lightImpact()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.mediumImpact()
        }
    }

    /// Payment success celebration pattern
    func paymentSuccessPattern() {
        success()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.lightImpact()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.lightImpact()
        }
    }

    /// Error shake pattern
    func errorShakePattern() {
        error()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.lightImpact()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.lightImpact()
        }
    }
}

// MARK: - SwiftUI View Extension

import SwiftUI

extension View {
    /// Adds haptic feedback on tap
    func hapticOnTap(_ style: HapticStyle = .medium) -> some View {
        self.simultaneousGesture(
            TapGesture().onEnded { _ in
                switch style {
                case .light:
                    HapticManager.shared.lightImpact()
                case .medium:
                    HapticManager.shared.mediumImpact()
                case .heavy:
                    HapticManager.shared.heavyImpact()
                case .success:
                    HapticManager.shared.success()
                case .warning:
                    HapticManager.shared.warning()
                case .error:
                    HapticManager.shared.error()
                case .selection:
                    HapticManager.shared.selectionChanged()
                }
            }
        )
    }
}

enum HapticStyle {
    case light
    case medium
    case heavy
    case success
    case warning
    case error
    case selection
}
