/// BottomSheetContainer.swift
/// Flent Secured v2 - Bottom Sheet Container Component
///
/// Reusable bottom sheet with drag handle
///
/// Figma: Components / Bottom Sheet
/// - Background: #1A1A1A (black/600)
/// - Corner radius: 24px (top corners only)
/// - Drag handle: 40x4, rd-2, #4D4D4D

import SwiftUI

struct BottomSheetContainer<Content: View>: View {
    let content: Content
    var showDragHandle: Bool = true

    init(showDragHandle: Bool = true, @ViewBuilder content: () -> Content) {
        self.showDragHandle = showDragHandle
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            // Drag handle
            if showDragHandle {
                DragHandle()
                    .padding(.top, Spacing.md)
                    .padding(.bottom, Spacing.sm)
            }

            // Content
            content
                .padding(.horizontal, Spacing.screenHorizontalCompact)
                .padding(.bottom, Spacing.xl)
        }
        .frame(maxWidth: .infinity)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
    }
}

// MARK: - Drag Handle

struct DragHandle: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(AppColors.black400)
            .frame(width: 40, height: 4)
    }
}

// MARK: - Bottom Sheet Modifier

extension View {
    func bottomSheet<Content: View>(
        isPresented: Binding<Bool>,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        self.overlay(
            Group {
                if isPresented.wrappedValue {
                    ZStack(alignment: .bottom) {
                        // Backdrop
                        Color.black.opacity(0.5)
                            .ignoresSafeArea()
                            .onTapGesture {
                                isPresented.wrappedValue = false
                            }

                        // Sheet
                        BottomSheetContainer {
                            content()
                        }
                        .transition(.move(edge: .bottom))
                    }
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isPresented.wrappedValue)
                }
            }
        )
    }
}

// MARK: - Preview

#Preview("Bottom Sheet Container") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        VStack {
            Spacer()

            BottomSheetContainer {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    // Title
                    VStack(alignment: .leading, spacing: Spacing.xxs) {
                        Text("Choose a")
                            .font(.system(size: 28, weight: .regular))
                            .foregroundColor(.white)
                        Text("Payment Method")
                            .font(.system(size: 28, weight: .regular))
                            .foregroundColor(AppColors.brand500)
                    }

                    // Cashback pill
                    Text("You'll earn ₹325 cashback on this payment")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(AppColors.black500)
                        .cornerRadius(Radius.pill)

                    // Button
                    PrimaryButton(title: "Pay ₹32,500") {
                        print("Pay tapped")
                    }
                }
            }
        }
    }
}
