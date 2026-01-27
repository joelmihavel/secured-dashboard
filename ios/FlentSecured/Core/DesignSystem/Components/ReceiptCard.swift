/// ReceiptCard.swift
/// Flent Secured v2 - Receipt Card Component
///
/// Receipt-style card with ticket cutout edges
///
/// Figma: Components / Receipt Card
/// - Background: #1A1A1A (black/600) - DARK, not white
/// - Corner radius: 12px
/// - Ticket cutout: semicircle notches on sides

import SwiftUI

struct ReceiptCard<Content: View>: View {
    let content: Content
    var showPaperclip: Bool = true

    init(showPaperclip: Bool = true, @ViewBuilder content: () -> Content) {
        self.showPaperclip = showPaperclip
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Card background with ticket cutout
            ReceiptCardShape()
                .fill(AppColors.backgroundSecondary)

            // Paperclip decoration
            if showPaperclip {
                Image(systemName: "paperclip")
                    .font(.system(size: 24))
                    .foregroundColor(AppColors.neutral500)
                    .rotationEffect(.degrees(-45))
                    .offset(x: 20, y: -10)
            }

            // Content
            content
                .padding(Spacing.lg)
                .padding(.top, showPaperclip ? Spacing.md : 0)
        }
    }
}

// MARK: - Receipt Card Shape with Ticket Cutout

struct ReceiptCardShape: Shape {
    var notchRadius: CGFloat = 8
    var notchCount: Int = 10

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let cornerRadius: CGFloat = 12
        let notchSpacing = (rect.height - cornerRadius * 2) / CGFloat(notchCount + 1)

        // Start from top-left, after corner
        path.move(to: CGPoint(x: cornerRadius, y: 0))

        // Top edge
        path.addLine(to: CGPoint(x: rect.width - cornerRadius, y: 0))

        // Top-right corner
        path.addArc(
            center: CGPoint(x: rect.width - cornerRadius, y: cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(-90),
            endAngle: .degrees(0),
            clockwise: false
        )

        // Right edge with notches
        var y = cornerRadius + notchSpacing
        for _ in 0..<notchCount {
            // Line to notch
            path.addLine(to: CGPoint(x: rect.width, y: y - notchRadius))
            // Notch (semicircle inward)
            path.addArc(
                center: CGPoint(x: rect.width, y: y),
                radius: notchRadius,
                startAngle: .degrees(-90),
                endAngle: .degrees(90),
                clockwise: true
            )
            y += notchSpacing
        }

        path.addLine(to: CGPoint(x: rect.width, y: rect.height - cornerRadius))

        // Bottom-right corner
        path.addArc(
            center: CGPoint(x: rect.width - cornerRadius, y: rect.height - cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(0),
            endAngle: .degrees(90),
            clockwise: false
        )

        // Bottom edge
        path.addLine(to: CGPoint(x: cornerRadius, y: rect.height))

        // Bottom-left corner
        path.addArc(
            center: CGPoint(x: cornerRadius, y: rect.height - cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(90),
            endAngle: .degrees(180),
            clockwise: false
        )

        // Left edge with notches
        y = rect.height - cornerRadius - notchSpacing
        for _ in 0..<notchCount {
            // Line to notch
            path.addLine(to: CGPoint(x: 0, y: y + notchRadius))
            // Notch (semicircle inward)
            path.addArc(
                center: CGPoint(x: 0, y: y),
                radius: notchRadius,
                startAngle: .degrees(90),
                endAngle: .degrees(-90),
                clockwise: true
            )
            y -= notchSpacing
        }

        path.addLine(to: CGPoint(x: 0, y: cornerRadius))

        // Top-left corner
        path.addArc(
            center: CGPoint(x: cornerRadius, y: cornerRadius),
            radius: cornerRadius,
            startAngle: .degrees(180),
            endAngle: .degrees(270),
            clockwise: false
        )

        path.closeSubpath()
        return path
    }
}

// MARK: - Payment Status Stamp

struct PaymentStamp: View {
    enum Status {
        case paid
        case failed
        case refunded
    }

    let status: Status

    private var stampColor: Color {
        switch status {
        case .paid: return AppColors.successApproved
        case .failed: return AppColors.error
        case .refunded: return AppColors.warning
        }
    }

    private var stampText: String {
        switch status {
        case .paid: return "PAID"
        case .failed: return "FAILED"
        case .refunded: return "REFUNDED"
        }
    }

    var body: some View {
        ZStack {
            // Stamp border
            Circle()
                .stroke(stampColor, lineWidth: 2)
                .frame(width: 64, height: 64)

            // Inner circle with pattern
            Circle()
                .stroke(stampColor.opacity(0.3), lineWidth: 1)
                .frame(width: 54, height: 54)

            // Stars
            VStack(spacing: 2) {
                HStack(spacing: 4) {
                    ForEach(0..<3) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 6))
                            .foregroundColor(stampColor)
                    }
                }

                Text(stampText)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(stampColor)
            }
        }
        .rotationEffect(.degrees(-15))
    }
}

// MARK: - Receipt Row

struct ReceiptRow: View {
    let label: String
    let value: String
    var showHash: Bool = true

    var body: some View {
        HStack {
            HStack(spacing: Spacing.xs) {
                if showHash {
                    Text("#")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                }
                Text(label)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
            }

            Spacer()

            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white)
        }
    }
}

// MARK: - Preview

#Preview("Receipt Card - Success") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        ReceiptCard {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Payment")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)
                        Text("Successful")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(AppColors.brand500)
                    }

                    Spacer()

                    PaymentStamp(status: .paid)
                }

                Divider()
                    .background(AppColors.black400)

                VStack(spacing: Spacing.sm) {
                    ReceiptRow(label: "Amount paid", value: "₹ 32,175")
                    ReceiptRow(label: "Date", value: "4 Nov 2026")
                    ReceiptRow(label: "Method", value: "UPI (joel@oksbi)")
                    ReceiptRow(label: "Transaction ID", value: "SEC12345678")
                }

                // Cashback pill
                Text("₹350 cashback applied")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .frame(maxWidth: .infinity)
                    .background(AppColors.black500)
                    .cornerRadius(Radius.pill)

                ReceiptRow(label: "Payable Rent", value: "₹ 32,175")
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
    }
}

#Preview("Receipt Card - Failed") {
    ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        ReceiptCard {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Payment")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(.white)
                        Text("Failed")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(AppColors.error)
                    }

                    Spacer()

                    PaymentStamp(status: .failed)
                }

                Divider()
                    .background(AppColors.black400)

                // Error messages
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    ErrorMessageRow(text: "Something didn't go through this time.")
                    ErrorMessageRow(text: "Your money is safe and hasn't been deducted.")
                    ErrorMessageRow(text: "If your account was debited, it will be automatically reversed within 3-5 business days.")
                }
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
    }
}

// Helper for error messages
private struct ErrorMessageRow: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Image(systemName: "creditcard.fill")
                .font(.system(size: 20))
                .foregroundColor(AppColors.brand500)
            Text(text)
                .font(.system(size: 14, weight: .regular))
                .foregroundColor(AppColors.neutral300)
        }
    }
}
