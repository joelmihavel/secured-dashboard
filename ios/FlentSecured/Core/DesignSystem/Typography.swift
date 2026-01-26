/// Typography.swift
/// Flent Secured v2 - Design System Typography
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// Primary Font: Plus Jakarta Sans (Google Font)
/// Fallback: SF Pro (System)
///
/// Font Weights Available:
/// - Regular (400)
/// - Medium (500)
/// - SemiBold (600)
/// - Bold (700)
///
/// Usage:
/// ```swift
/// Text("Title").font(Typography.h1)
/// Text("Body").font(Typography.bodyMd)
/// ```

import SwiftUI
import UIKit

// MARK: - Typography

enum Typography {

    // MARK: - Font Family

    /// Primary font family name
    static let primaryFontFamily = "PlusJakartaSans"

    /// Secondary font family name
    static let secondaryFontFamily = "Inter"

    // MARK: - Headlines

    /// H1 - Hero title
    /// Figma: 48px, Regular 400, line-height 64px, letter-spacing -2px
    static let h1 = scaledFont(size: 48, weight: .regular, lineHeight: 64, tracking: -2)

    /// H2 - Large title
    /// 40px, Regular
    static let h2 = scaledFont(size: 40, weight: .regular, lineHeight: 52, tracking: -1.5)

    /// H3 - Section title
    /// 32px, Regular
    static let h3 = scaledFont(size: 32, weight: .regular, lineHeight: 44, tracking: -1)

    /// H4 - Card title
    /// Figma: 28px, Regular 400, line-height 40px, letter-spacing -1px
    static let h4 = scaledFont(size: 28, weight: .regular, lineHeight: 40, tracking: -1)

    /// H5 - Subsection title
    /// 24px, Medium
    static let h5 = scaledFont(size: 24, weight: .medium, lineHeight: 32, tracking: -0.5)

    /// H6 - Small title
    /// 20px, SemiBold
    static let h6 = scaledFont(size: 20, weight: .semibold, lineHeight: 28, tracking: 0)

    // MARK: - Body Text

    /// Body Large
    /// Figma: 20px, Regular 400, line-height 32px
    static let bodyLg = scaledFont(size: 20, weight: .regular, lineHeight: 32, tracking: 0)

    /// Body Medium
    /// Figma: 16px, SemiBold 600, line-height 24px
    static let bodyMd = scaledFont(size: 16, weight: .semibold, lineHeight: 24, tracking: 0)

    /// Body Medium (Regular variant)
    /// Figma: 14px, Regular 400, line-height 20px
    static let bodyMd2 = scaledFont(size: 14, weight: .regular, lineHeight: 20, tracking: 0)

    /// Body Medium (Medium weight)
    /// 16px, Medium 500, line-height 24px
    static let bodyMdMedium = scaledFont(size: 16, weight: .medium, lineHeight: 24, tracking: 0)

    /// Body Small
    /// Figma: 12px, Regular-Medium 400-500, line-height 20px
    static let bodySm = scaledFont(size: 12, weight: .regular, lineHeight: 20, tracking: 0)

    /// Body Small (Medium weight)
    static let bodySmMedium = scaledFont(size: 12, weight: .medium, lineHeight: 20, tracking: 0)

    // MARK: - Labels & Captions

    /// Label - For form labels, small headers
    /// 14px, SemiBold
    static let label = scaledFont(size: 14, weight: .semibold, lineHeight: 20, tracking: 0)

    /// Caption - For helper text, timestamps
    /// 12px, Regular
    static let caption = scaledFont(size: 12, weight: .regular, lineHeight: 16, tracking: 0)

    /// Overline - For category labels
    /// 10px, SemiBold, uppercase
    static let overline = scaledFont(size: 10, weight: .semibold, lineHeight: 14, tracking: 1.5)

    // MARK: - Special Purpose

    /// Button text
    /// 16px, SemiBold
    static let button = scaledFont(size: 16, weight: .semibold, lineHeight: 24, tracking: 0)

    /// Button small text
    /// 14px, SemiBold
    static let buttonSmall = scaledFont(size: 14, weight: .semibold, lineHeight: 20, tracking: 0)

    /// Button label (alias for button)
    static let buttonLabel = button

    /// Amount display (large numbers)
    /// 32px, Bold, monospaced digits
    static var amountLarge: Font {
        Font.custom(primaryFontFamily + "-Bold", size: DesignScale.scaled(32, min: 24, max: 40))
            .monospacedDigit()
    }

    /// Amount display (medium numbers)
    /// 24px, SemiBold, monospaced digits
    static var amountMedium: Font {
        Font.custom(primaryFontFamily + "-SemiBold", size: DesignScale.scaled(24, min: 18, max: 30))
            .monospacedDigit()
    }

    /// OTP input
    /// 28px, Bold
    static let otpInput = scaledFont(size: 28, weight: .bold, lineHeight: 36, tracking: 8)

    // MARK: - Private Helpers

    /// Creates a scaled font with the primary font family
    private static func scaledFont(
        size: CGFloat,
        weight: Font.Weight,
        lineHeight: CGFloat,
        tracking: CGFloat
    ) -> Font {
        let scaledSize = DesignScale.scaled(size, min: size * 0.75, max: size * 1.25)

        // Try custom font first, fall back to system
        if let _ = UIFont(name: fontName(for: weight), size: scaledSize) {
            return Font.custom(fontName(for: weight), size: scaledSize)
        } else {
            return Font.system(size: scaledSize, weight: weight)
        }
    }

    /// Maps Font.Weight to Plus Jakarta Sans font file name
    private static func fontName(for weight: Font.Weight) -> String {
        switch weight {
        case .regular:
            return "\(primaryFontFamily)-Regular"
        case .medium:
            return "\(primaryFontFamily)-Medium"
        case .semibold:
            return "\(primaryFontFamily)-SemiBold"
        case .bold:
            return "\(primaryFontFamily)-Bold"
        default:
            return "\(primaryFontFamily)-Regular"
        }
    }
}

// MARK: - Line Height Modifier

struct LineHeightModifier: ViewModifier {
    let lineHeight: CGFloat
    let fontSize: CGFloat

    func body(content: Content) -> some View {
        content
            .lineSpacing(lineHeight - fontSize)
            .padding(.vertical, (lineHeight - fontSize) / 2)
    }
}

extension View {
    /// Apply custom line height to text
    func lineHeight(_ lineHeight: CGFloat, fontSize: CGFloat) -> some View {
        self.modifier(LineHeightModifier(lineHeight: lineHeight, fontSize: fontSize))
    }
}

// MARK: - Tracking (Letter Spacing) Extension

extension Text {
    /// Apply letter spacing (tracking)
    func tracking(_ value: CGFloat) -> Text {
        self.tracking(value)
    }
}
