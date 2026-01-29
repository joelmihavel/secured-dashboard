/// IconSize.swift
/// Flent Secured v2 - Design System Icon Sizes
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// Standardized icon sizes for consistent visual hierarchy
///
/// Usage:
/// ```swift
/// Image(systemName: "chevron.down")
///     .font(.system(size: IconSize.md))
/// ```

import SwiftUI

// MARK: - Icon Size

enum IconSize {

    // MARK: - Size Scale

    /// 12pt - Extra small icons (inline indicators)
    static let xs: CGFloat = 12

    /// 16pt - Small icons (secondary actions, list items)
    static let sm: CGFloat = 16

    /// 20pt - Medium icons (default, toast icons)
    static let md: CGFloat = 20

    /// 24pt - Large icons (navigation, prominent actions)
    static let lg: CGFloat = 24

    /// 32pt - Extra large icons (empty states, illustrations)
    static let xl: CGFloat = 32

    /// 44pt - Touch target size (minimum tappable area)
    static let touchTarget: CGFloat = 44

    /// 48pt - Hero icons (success/error states)
    static let hero: CGFloat = 48

    /// 64pt - Illustration icons (onboarding)
    static let illustration: CGFloat = 64

    // MARK: - Semantic Aliases

    /// Navigation bar icons
    static let navBar: CGFloat = lg

    /// Tab bar icons
    static let tabBar: CGFloat = lg

    /// Form field icons (leading/trailing)
    static let formField: CGFloat = md

    /// Button icons (inline with text)
    static let button: CGFloat = md

    /// Status indicator icons
    static let status: CGFloat = sm

    /// Chevron/arrow icons
    static let chevron: CGFloat = xs
}

// MARK: - View Extension for Icon Sizing

extension Image {
    /// Apply standard icon sizing
    func iconSize(_ size: CGFloat) -> some View {
        self.font(.system(size: size))
    }

    /// Small icon (16pt)
    func smallIcon() -> some View {
        self.iconSize(IconSize.sm)
    }

    /// Medium icon (20pt)
    func mediumIcon() -> some View {
        self.iconSize(IconSize.md)
    }

    /// Large icon (24pt)
    func largeIcon() -> some View {
        self.iconSize(IconSize.lg)
    }
}

// MARK: - Preview

#Preview("Icon Sizes") {
    VStack(spacing: 24) {
        HStack(spacing: 16) {
            ForEach([IconSize.xs, IconSize.sm, IconSize.md, IconSize.lg, IconSize.xl], id: \.self) { size in
                VStack(spacing: 4) {
                    Image(systemName: "star.fill")
                        .font(.system(size: size))
                        .foregroundColor(.green)

                    Text("\(Int(size))pt")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
        }
    }
    .padding()
    .background(Color.black)
}
