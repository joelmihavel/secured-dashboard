/// Spacing.swift
/// Flent Secured v2 - Design System Spacing
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// All spacing values extracted from Figma design tokens
///
/// Usage:
/// ```swift
/// .padding(Spacing.md)           // 16pt default padding
/// .padding(.horizontal, Spacing.lg)  // 24pt horizontal
/// VStack(spacing: Spacing.sm) { }    // 12pt between items
/// ```

import SwiftUI

// MARK: - Spacing

enum Spacing {

    // MARK: - Base Scale (from Figma --spacing tokens)

    /// 0pt - No spacing
    static let zero: CGFloat = 0

    /// 2pt - Tiny spacing (very tight elements)
    static let xxxs: CGFloat = 2

    /// 4pt - Micro spacing (icons, tight elements)
    /// Figma: --spacing/sp-4
    static let xxs: CGFloat = 4

    /// 8pt - Small spacing (between related elements)
    /// Figma: --spacing/sp-8
    static let xs: CGFloat = 8

    /// 12pt - Compact spacing
    static let sm: CGFloat = 12

    /// 16pt - Default spacing (most common)
    /// Figma: --spacing/sp-16
    static let md: CGFloat = 16

    /// 24pt - Large spacing (section padding)
    /// Figma: --spacing/sp-24
    static let lg: CGFloat = 24

    /// 32pt - Extra large spacing
    /// Figma: --spacing/sp-32
    static let xl: CGFloat = 32

    /// 40pt - Section spacing
    /// Figma: --spacing/sp-40
    static let xxl: CGFloat = 40

    /// 48pt - Large section spacing
    /// Figma: --spacing/sp-48
    static let xxxl: CGFloat = 48

    /// 64pt - Page-level spacing
    /// Figma: --scale/64
    static let huge: CGFloat = 64

    // MARK: - Semantic Aliases

    /// Screen horizontal padding (typically 16-24pt)
    static let screenHorizontal: CGFloat = lg

    /// Screen top padding
    static let screenTop: CGFloat = md

    /// Screen bottom padding (safe area aware)
    static let screenBottom: CGFloat = xl

    /// Card internal padding
    static let cardPadding: CGFloat = md

    /// Stack spacing (items in a list)
    static let stackSpacing: CGFloat = sm

    /// Button internal padding
    static let buttonPadding: CGFloat = md

    /// Input field padding
    static let inputPadding: CGFloat = md

    /// Section spacing (between major sections)
    static let sectionSpacing: CGFloat = xxl

    /// Icon-to-text spacing
    static let iconSpacing: CGFloat = xs
}

// MARK: - View Extensions for Consistent Spacing

extension View {
    /// Apply screen-level horizontal padding
    func screenPadding() -> some View {
        self.padding(.horizontal, Spacing.screenHorizontal)
    }

    /// Apply card-level padding
    func cardPadding() -> some View {
        self.padding(Spacing.cardPadding)
    }
}
