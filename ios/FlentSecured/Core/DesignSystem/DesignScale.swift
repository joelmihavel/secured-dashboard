/// DesignScale.swift
/// Flent Secured v2 - Responsive Design Scaling
///
/// Reference device: iPhone 14 Pro (393pt width)
/// All Figma measurements are based on this width
///
/// This utility provides:
/// - Proportional scaling for different screen sizes
/// - Min/max bounds to prevent extreme scaling
/// - Dynamic Type support via @ScaledMetric
///
/// Usage:
/// ```swift
/// // Proportional scaling
/// .frame(width: DesignScale.scaled(350))
///
/// // Bounded scaling
/// .font(.system(size: DesignScale.scaled(16, min: 14, max: 20)))
///
/// // In views with @ScaledMetric
/// @ScaledMetric(relativeTo: .body) var iconSize: CGFloat = 24
/// ```

import SwiftUI
import UIKit

// MARK: - Design Scale

enum DesignScale {

    // MARK: - Reference Values

    /// Reference design width (iPhone 14 Pro)
    /// All Figma measurements are based on this width
    static let referenceWidth: CGFloat = 393

    /// Reference design height (iPhone 14 Pro)
    static let referenceHeight: CGFloat = 852

    /// Current screen width
    static var screenWidth: CGFloat {
        UIScreen.main.bounds.width
    }

    /// Current screen height
    static var screenHeight: CGFloat {
        UIScreen.main.bounds.height
    }

    /// Width scale factor
    static var widthScale: CGFloat {
        screenWidth / referenceWidth
    }

    /// Height scale factor
    static var heightScale: CGFloat {
        screenHeight / referenceHeight
    }

    // MARK: - Scaling Functions

    /// Scale a value proportionally to screen width
    /// - Parameter value: The design value (from Figma)
    /// - Returns: Scaled value for current screen
    static func scaled(_ value: CGFloat) -> CGFloat {
        value * widthScale
    }

    /// Scale a value with minimum and maximum bounds
    /// - Parameters:
    ///   - value: The design value (from Figma)
    ///   - min: Minimum allowed value
    ///   - max: Maximum allowed value
    /// - Returns: Scaled value clamped to bounds
    static func scaled(_ value: CGFloat, min minValue: CGFloat, max maxValue: CGFloat) -> CGFloat {
        Swift.min(Swift.max(scaled(value), minValue), maxValue)
    }

    /// Scale a value based on height (for vertical measurements)
    /// - Parameter value: The design value
    /// - Returns: Scaled value for current screen height
    static func scaledHeight(_ value: CGFloat) -> CGFloat {
        value * heightScale
    }

    /// Scale a value based on height with bounds
    static func scaledHeight(_ value: CGFloat, min minValue: CGFloat, max maxValue: CGFloat) -> CGFloat {
        Swift.min(Swift.max(scaledHeight(value), minValue), maxValue)
    }

    // MARK: - Device Detection

    /// Check if current device is SE/mini (small screen)
    static var isSmallDevice: Bool {
        screenWidth < 375
    }

    /// Check if current device is Pro Max/Plus (large screen)
    static var isLargeDevice: Bool {
        screenWidth > 400
    }

    /// Check if current device matches reference design
    static var isReferenceDevice: Bool {
        abs(screenWidth - referenceWidth) < 5
    }
}

// MARK: - Scaled Dimension Property Wrapper

/// Property wrapper for values that scale with screen width
@propertyWrapper
struct ScaledWidth: DynamicProperty {
    private let baseValue: CGFloat

    var wrappedValue: CGFloat {
        DesignScale.scaled(baseValue)
    }

    init(wrappedValue: CGFloat) {
        self.baseValue = wrappedValue
    }
}

/// Property wrapper for values that scale with screen height
@propertyWrapper
struct ScaledHeight: DynamicProperty {
    private let baseValue: CGFloat

    var wrappedValue: CGFloat {
        DesignScale.scaledHeight(baseValue)
    }

    init(wrappedValue: CGFloat) {
        self.baseValue = wrappedValue
    }
}

// MARK: - View Extensions

extension View {
    /// Apply scaled frame width
    func scaledWidth(_ width: CGFloat) -> some View {
        self.frame(width: DesignScale.scaled(width))
    }

    /// Apply scaled frame height
    func scaledHeight(_ height: CGFloat) -> some View {
        self.frame(height: DesignScale.scaledHeight(height))
    }

    /// Apply scaled frame with both dimensions
    func scaledFrame(width: CGFloat, height: CGFloat) -> some View {
        self.frame(
            width: DesignScale.scaled(width),
            height: DesignScale.scaledHeight(height)
        )
    }

    /// Apply scaled padding
    func scaledPadding(_ edges: Edge.Set = .all, _ length: CGFloat) -> some View {
        self.padding(edges, DesignScale.scaled(length))
    }
}

// MARK: - Font Extension

extension Font {
    /// Create a scaled system font
    static func scaledSystem(
        size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default
    ) -> Font {
        let scaledSize = DesignScale.scaled(size, min: size * 0.8, max: size * 1.3)
        return .system(size: scaledSize, weight: weight, design: design)
    }
}
