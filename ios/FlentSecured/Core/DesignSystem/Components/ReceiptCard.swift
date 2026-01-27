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

/// Payment status stamp for receipt cards
/// Figma: node-id=1:35238 (PAID), node-id=1:35361 (FAILED)
/// - Size: 64x64
/// - Rotation: -15 degrees
/// - PAID: green (#06C270) with checkmark and stars
/// - FAILED: red (#FF8080) with X and stars
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

    private var stampIcon: String {
        switch status {
        case .paid: return "checkmark"
        case .failed: return "xmark"
        case .refunded: return "arrow.uturn.backward"
        }
    }

    var body: some View {
        ZStack {
            // Outer stamp border with dashed pattern
            Circle()
                .stroke(stampColor, style: StrokeStyle(lineWidth: 2, dash: [4, 2]))
                .frame(width: 64, height: 64)

            // Inner circle
            Circle()
                .stroke(stampColor.opacity(0.5), lineWidth: 1)
                .frame(width: 54, height: 54)

            // Content
            VStack(spacing: 2) {
                // Stars row
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 5))
                            .foregroundColor(stampColor)
                    }
                }

                // Status icon
                Image(systemName: stampIcon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(stampColor)

                // Status text
                Text(stampText)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(stampColor)
                    .tracking(1)

                // Bottom stars row
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: 5))
                            .foregroundColor(stampColor)
                    }
                }
            }
        }
        .rotationEffect(.degrees(-15))
    }
}

// MARK: - Receipt Row

/// Transaction detail row for receipt cards
/// Figma: node-id=1:35238
/// - Label: # prefix (orange) + label text (neutral)
/// - Value: white text, right aligned
/// - Highlighted: larger font for total/payable rows
struct ReceiptRow: View {
    let label: String
    let value: String
    var showHash: Bool = true
    var isHighlighted: Bool = false

    var body: some View {
        HStack {
            HStack(spacing: Spacing.xs) {
                if showHash {
                    Text("#")
                        .font(.system(size: isHighlighted ? 16 : 14, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                }
                Text(label)
                    .font(.system(size: isHighlighted ? 16 : 14, weight: isHighlighted ? .medium : .regular))
                    .foregroundColor(isHighlighted ? .white : AppColors.neutral500)
            }

            Spacer()

            Text(value)
                .font(.system(size: isHighlighted ? 16 : 14, weight: isHighlighted ? .semibold : .medium))
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
