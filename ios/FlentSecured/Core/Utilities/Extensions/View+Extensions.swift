/// View+Extensions.swift
/// Flent Secured v2 - SwiftUI View Extensions
///
/// Common view modifiers and extensions

import SwiftUI
import UIKit

// Note: screenPadding() is defined in Core/DesignSystem/Spacing.swift

// MARK: - Conditional Modifiers

extension View {
    /// Applies modifier only if condition is true
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Applies modifier only if value is not nil
    @ViewBuilder
    func ifLet<Value, Content: View>(_ value: Value?, transform: (Self, Value) -> Content) -> some View {
        if let value = value {
            transform(self, value)
        } else {
            self
        }
    }
}

// MARK: - Loading Overlay

extension View {
    /// Shows loading overlay when loading is true
    func loadingOverlay(_ isLoading: Bool) -> some View {
        self.overlay {
            if isLoading {
                ZStack {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()

                    ProgressView()
                        .tint(AppColors.accentPrimary)
                        .scaleEffect(1.5)
                        .padding(Spacing.lg)
                        .background(AppColors.backgroundSecondary)
                        .cornerRadius(Radius.card)
                }
            }
        }
    }
}

// MARK: - Shake Effect

extension View {
    /// Applies shake animation for errors
    func shake(trigger: Bool) -> some View {
        self.modifier(ShakeModifier(trigger: trigger))
    }
}

struct ShakeModifier: ViewModifier {
    let trigger: Bool
    @State private var shakeOffset: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .offset(x: shakeOffset)
            .onChange(of: trigger) { _, newValue in
                if newValue {
                    withAnimation(.default) {
                        shakeOffset = 10
                    }
                    withAnimation(.default.delay(0.1)) {
                        shakeOffset = -8
                    }
                    withAnimation(.default.delay(0.2)) {
                        shakeOffset = 6
                    }
                    withAnimation(.default.delay(0.3)) {
                        shakeOffset = -4
                    }
                    withAnimation(.default.delay(0.4)) {
                        shakeOffset = 0
                    }
                }
            }
    }
}

// MARK: - Keyboard Dismissal

extension View {
    /// Dismisses keyboard when tapping outside
    func dismissKeyboardOnTap() -> some View {
        self.onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
    }
}

// MARK: - Safe Area

extension View {
    /// Reads safe area insets
    func readSafeArea(_ safeArea: Binding<EdgeInsets>) -> some View {
        self.background(
            GeometryReader { geometry in
                Color.clear
                    .onAppear {
                        safeArea.wrappedValue = geometry.safeAreaInsets
                    }
            }
        )
    }
}

// MARK: - Redacted Shimmer

extension View {
    /// Shows shimmer loading placeholder
    func shimmer(when isLoading: Bool) -> some View {
        self
            .redacted(reason: isLoading ? .placeholder : [])
            .if(isLoading) { view in
                view.modifier(ShimmerModifier())
            }
    }
}

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    LinearGradient(
                        gradient: Gradient(colors: [
                            .clear,
                            Color.white.opacity(0.3),
                            .clear
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 2)
                    .offset(x: -geometry.size.width + phase * geometry.size.width * 2)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - Corner Radius

extension View {
    /// Applies corner radius to specific corners
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
