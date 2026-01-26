/// AppColors.swift
/// Flent Secured v2 - Design System Colors
///
/// Source: Figma Design File - Flent-Secured_v1.2
/// All colors extracted from Figma design tokens
///
/// Color Palette:
/// - Black scale: 700 (darkest) to 200 (lightest)
/// - Neutral scale: For light backgrounds and gray text
/// - Brand scale: Orange accent colors
/// - Semantic: Success, Error, Warning states

import SwiftUI

// MARK: - App Colors

enum AppColors {

    // MARK: - Black Scale (Dark Theme Primary)

    /// Primary dark background - #131313
    /// Figma: --colours/black/700
    static let black700 = Color(hex: "131313")

    /// Secondary background (cards, surfaces) - #1A1A1A
    /// Figma: --colours/black/600
    static let black600 = Color(hex: "1A1A1A")

    /// Disabled button background - #202020
    /// Figma: --colours/black/500
    static let black500 = Color(hex: "202020")

    /// Border/divider color - #4D4D4D
    /// Figma: --colours/black/400
    static let black400 = Color(hex: "4D4D4D")

    /// Muted text color - #797979
    /// Figma: --colours/black/300
    static let black300 = Color(hex: "797979")

    /// Secondary text color - #A6A6A6
    /// Figma: --colours/black/200
    static let black200 = Color(hex: "A6A6A6")

    // MARK: - Neutral Scale

    /// Light background - #EEEEEE
    /// Figma: --colours/neutral/100
    static let neutral100 = Color(hex: "EEEEEE")

    /// Gray text - #A9A9A9
    /// Figma: --colours/neutral/500
    static let neutral500 = Color(hex: "A9A9A9")

    /// Medium gray - #878787
    /// Figma: --colours/neutral/600
    static let neutral600 = Color(hex: "878787")

    /// Dark gray text - #444444
    /// Figma: --colours/neutral/800
    static let neutral800 = Color(hex: "444444")

    // MARK: - Brand Colors (Orange Accent)

    /// Accent light - #FFAE8A
    /// Figma: --colours/brand/400
    static let brand400 = Color(hex: "FFAE8A")

    /// Primary accent color - #FF9A6D
    /// Figma: --colours/brand/500
    static let brand500 = Color(hex: "FF9A6D")

    /// Accent dark (pressed state) - #CC7B57
    /// Figma: --colours/brand/600
    static let brand600 = Color(hex: "CC7B57")

    // MARK: - Semantic Colors

    /// Success green - #70BF73
    /// Figma: --colour/icons/success/default-2
    static let success = Color(hex: "70BF73")

    /// Error red - #EF4444
    static let error = Color(hex: "EF4444")

    /// Warning yellow - #EAB308
    static let warning = Color(hex: "EAB308")

    /// Pure white - #FFFFFF
    static let white = Color.white

    // MARK: - Semantic Aliases (For easier usage)

    /// Primary background color
    static let backgroundPrimary = black700

    /// Secondary background (cards, elevated surfaces)
    static let backgroundSecondary = black600

    /// Elevated background
    static let backgroundElevated = black500

    /// Primary text color
    static let textPrimary = white

    /// Secondary text color
    static let textSecondary = black200

    /// Muted/tertiary text color
    static let textMuted = black300

    /// Primary accent/brand color
    static let accentPrimary = brand500

    /// Light accent (hover states)
    static let accentLight = brand400

    /// Dark accent (pressed states)
    static let accentDark = brand600

    /// Border/divider color
    static let border = black400

    /// Active/focused border color
    static let borderActive = brand500

    /// Text on primary button
    static let textOnPrimary = black700

    /// Disabled state
    static let disabled = black500

    /// Disabled text
    static let textDisabled = black300
}

// MARK: - Color Extension for Hex Support

extension Color {
    /// Initialize Color from hex string
    /// - Parameter hex: Hex color string (with or without #)
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
