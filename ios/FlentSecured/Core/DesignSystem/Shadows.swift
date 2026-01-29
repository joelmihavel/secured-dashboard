/// Shadows.swift
/// Flent Secured v2 - Design System Shadows
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// Standardized shadow definitions for consistent elevation
///
/// Usage:
/// ```swift
/// .shadow(Shadows.toast)
/// .modifier(Shadows.elevated.modifier)
/// ```

import SwiftUI

// MARK: - Shadow Style

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat

    /// Create a ViewModifier for this shadow
    var modifier: ShadowModifier {
        ShadowModifier(style: self)
    }
}

// MARK: - Shadow Modifier

struct ShadowModifier: ViewModifier {
    let style: ShadowStyle

    func body(content: Content) -> some View {
        content.shadow(
            color: style.color,
            radius: style.radius,
            x: style.x,
            y: style.y
        )
    }
}

// MARK: - Shadows

enum Shadows {

    // MARK: - Toast Shadow

    /// Shadow for toast notifications
    /// Figma: 0, 4, 8, black 20%
    static let toast = ShadowStyle(
        color: .black.opacity(0.2),
        radius: 8,
        x: 0,
        y: 4
    )

    // MARK: - Elevated Shadow

    /// Shadow for elevated cards and surfaces
    /// Figma: 0, 2, 4, black 15%
    static let elevated = ShadowStyle(
        color: .black.opacity(0.15),
        radius: 4,
        x: 0,
        y: 2
    )

    // MARK: - Pressed Shadow

    /// Subtle shadow for pressed button states
    /// Figma: 0, 1, 2, black 10%
    static let pressed = ShadowStyle(
        color: .black.opacity(0.1),
        radius: 2,
        x: 0,
        y: 1
    )

    // MARK: - Modal Shadow

    /// Shadow for modals and bottom sheets
    /// Figma: 0, -4, 16, black 25%
    static let modal = ShadowStyle(
        color: .black.opacity(0.25),
        radius: 16,
        x: 0,
        y: -4
    )

    // MARK: - Soft Shadow

    /// Soft ambient shadow for subtle depth
    /// Figma: 0, 0, 8, black 10%
    static let soft = ShadowStyle(
        color: .black.opacity(0.1),
        radius: 8,
        x: 0,
        y: 0
    )

    // MARK: - None

    /// No shadow
    static let none = ShadowStyle(
        color: .clear,
        radius: 0,
        x: 0,
        y: 0
    )
}

// MARK: - View Extension

extension View {
    /// Apply a shadow style to a view
    func shadow(_ style: ShadowStyle) -> some View {
        self.shadow(
            color: style.color,
            radius: style.radius,
            x: style.x,
            y: style.y
        )
    }

    /// Apply toast shadow
    func toastShadow() -> some View {
        self.shadow(Shadows.toast)
    }

    /// Apply elevated shadow
    func elevatedShadow() -> some View {
        self.shadow(Shadows.elevated)
    }

    /// Apply modal shadow
    func modalShadow() -> some View {
        self.shadow(Shadows.modal)
    }
}

// MARK: - Preview

#Preview("Shadows") {
    VStack(spacing: 24) {
        RoundedRectangle(cornerRadius: 16)
            .fill(AppColors.backgroundSecondary)
            .frame(height: 80)
            .overlay(Text("No Shadow").foregroundColor(.white))

        RoundedRectangle(cornerRadius: 16)
            .fill(AppColors.backgroundSecondary)
            .frame(height: 80)
            .overlay(Text("Elevated Shadow").foregroundColor(.white))
            .elevatedShadow()

        RoundedRectangle(cornerRadius: 16)
            .fill(AppColors.backgroundSecondary)
            .frame(height: 80)
            .overlay(Text("Toast Shadow").foregroundColor(.white))
            .toastShadow()

        RoundedRectangle(cornerRadius: 16)
            .fill(AppColors.backgroundSecondary)
            .frame(height: 80)
            .overlay(Text("Modal Shadow").foregroundColor(.white))
            .modalShadow()
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
