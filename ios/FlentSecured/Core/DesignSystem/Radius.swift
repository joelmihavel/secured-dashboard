/// Radius.swift
/// Flent Secured v2 - Design System Corner Radius
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// All radius values extracted from Figma design tokens
///
/// Usage:
/// ```swift
/// .clipShape(RoundedRectangle(cornerRadius: Radius.md))
/// .cornerRadius(Radius.lg)
/// ```

import SwiftUI

// MARK: - Radius

enum Radius {

    // MARK: - Base Scale (from Figma --radius tokens)

    /// 0pt - No rounding (sharp corners)
    static let none: CGFloat = 0

    /// 4pt - Subtle rounding
    static let xs: CGFloat = 4

    /// 8pt - Small rounding (input fields, small cards)
    /// Figma: --radius/rd-8
    static let sm: CGFloat = 8

    /// 12pt - Medium rounding (buttons, cards)
    /// Figma: --radius/rd-12
    static let md: CGFloat = 12

    /// 16pt - Large rounding
    static let lg: CGFloat = 16

    /// 24pt - Extra large rounding
    static let xl: CGFloat = 24

    /// 40pt - Pills and tags
    /// Figma: --radius/rd-40
    static let xxl: CGFloat = 40

    /// 200pt - Pill shape (fully rounded)
    /// Figma: --radius/rd-200
    static let pill: CGFloat = 200

    /// Full circle (uses half of the smaller dimension)
    static let full: CGFloat = .infinity

    // MARK: - Semantic Aliases

    /// Button corner radius
    static let button: CGFloat = md

    /// Card corner radius
    static let card: CGFloat = md

    /// Input field corner radius
    static let input: CGFloat = sm

    /// Sheet/modal corner radius
    static let sheet: CGFloat = xl

    /// Avatar/profile picture (circular)
    static let avatar: CGFloat = full

    /// Chip/tag corner radius (pill shape)
    static let chip: CGFloat = pill
}

// MARK: - Rounded Rectangle Convenience

extension RoundedRectangle {
    /// Card-style rounded rectangle
    static var card: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.card)
    }

    /// Button-style rounded rectangle
    static var button: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.button)
    }

    /// Input field rounded rectangle
    static var input: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.input)
    }

    /// Pill-shaped rounded rectangle
    static var pill: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.pill)
    }
}
