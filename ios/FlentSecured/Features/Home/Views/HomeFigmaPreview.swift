/// HomeFigmaPreview.swift
/// Master preview file for all Home screen Figma states
///
/// This file provides a comprehensive preview catalog mapping
/// each Figma node ID to its corresponding SwiftUI implementation
/// for pixel-perfect comparison testing.
///
/// Figma File: HZaVuwWn6B6jOjrmxZ7Kzv
///
/// SCREEN MAPPING:
/// ===============
/// EMPTY STATES (Pre-Verification) - 9 states:
/// - 41:4569  zeroState           -> HomeZeroStateFigmaView
/// - 41:3186  setupPaymentUPI     -> HomeZeroStateFigmaView (UPI focus)
/// - 41:7005  setupPayment        -> HomeZeroStateFigmaView (methods)
/// - 41:5792  emptyWithUPIPayments -> HomeActiveStateFigmaView (UPI)
/// - 41:5998  emptyWithUPIPaid    -> HomeActiveStateFigmaView (paid)
/// - 41:6204  emptyWithUPINoPayments -> HomeActiveStateFigmaView
/// - 41:6385  emptyWithCashback   -> HomeWithCashbacksFigmaView
/// - 41:6598  emptyWithCashbackPaid -> HomeWithCashbacksFigmaView (paid)
/// - 41:6811  emptyNoCashback     -> HomeActiveStateFigmaView
///
/// ACTIVE STATES (Post-Verification) - 2 main states:
/// - 41:3267  activeQualified     -> HomeActiveStateFigmaView (UPI)
/// - 41:3472  activeComplete      -> HomeActiveStateFigmaView (Card)
///
/// PAYMENT ISSUE STATES - 3 states:
/// - 41:3677  latePayment         -> HomeOverdueFigmaView (.lateByDays)
/// - 41:3885  missedPayment       -> HomeOverdueFigmaView (.missedMonthRent)
/// - 41:4093  multipleMissed      -> HomeOverdueFigmaView (.multipleOverdue)
///
/// LANDLORD INVITATION STATES - 5 substates:
/// - 41:4765  sent                -> Within zero state
/// - 41:4969  pendingUnder24hrs   -> Within zero state
/// - 41:5175  pendingOver24hrs    -> HomeLandlordPendingFigmaView
/// - 41:5381  failed              -> HomeLandlordPendingFigmaView
/// - 41:5587  declined            -> Within zero state

import SwiftUI

// MARK: - Preview Catalog

#Preview("41-4569: Zero State") {
    HomeZeroStateFigmaView(isVisualTestMode: true)
}

#Preview("41-6385: Cashbacks Tab") {
    HomeWithCashbacksFigmaView(isVisualTestMode: true)
}

#Preview("41-6598: Cashbacks + Paid") {
    HomeWithCashbacksFigmaView(isVisualTestMode: true)
        // Would need isPaid parameter
}

#Preview("41-3267: Active Qualified (UPI)") {
    HomeActiveStateFigmaView(
        isVisualTestMode: true,
        primaryPaymentMethod: .upi(
            bankName: "ICICI a/c",
            accountMasked: "xxx23",
            upiId: "rishabh@***"
        ),
        isCompleteUser: false
    )
}

#Preview("41-3472: Active Complete (Card)") {
    HomeActiveStateFigmaView(
        isVisualTestMode: true,
        primaryPaymentMethod: .card(
            brand: "VISA",
            lastFour: "2341",
            expiry: "06/26"
        ),
        isCompleteUser: true
    )
}

#Preview("41-5792: UPI + Payments") {
    HomeActiveStateFigmaView(
        isVisualTestMode: true,
        primaryPaymentMethod: .upi(
            bankName: "ICICI a/c",
            accountMasked: "xxx23",
            upiId: "rishabh@***"
        ),
        isCompleteUser: false
    )
}

#Preview("41-3677: Overdue 10 Days") {
    HomeOverdueFigmaView(
        isVisualTestMode: true,
        overdueState: .lateByDays(days: 10)
    )
}

#Preview("41-3885: Missed December") {
    HomeOverdueFigmaView(
        isVisualTestMode: true,
        overdueState: .missedMonthRent(month: "December")
    )
}

#Preview("41-4093: Multiple Overdue") {
    HomeOverdueFigmaView(
        isVisualTestMode: true,
        overdueState: .multipleOverdue
    )
}

#Preview("41-5175: Landlord Pending >24hrs") {
    HomeLandlordPendingFigmaView(
        isVisualTestMode: true,
        pendingState: .pendingOver24hrs
    )
}

#Preview("41-5381: Invite Pending") {
    HomeLandlordPendingFigmaView(
        isVisualTestMode: true,
        pendingState: .invitePending
    )
}

// MARK: - Visual Test Grid

struct HomeFigmaTestGrid: View {
    var body: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 20) {
                // Empty States
                PreviewTile(nodeId: "41-4569", title: "Zero State") {
                    HomeZeroStateFigmaView(isVisualTestMode: true)
                }

                PreviewTile(nodeId: "41-6385", title: "Cashbacks") {
                    HomeWithCashbacksFigmaView(isVisualTestMode: true)
                }

                // Active States
                PreviewTile(nodeId: "41-3267", title: "Active UPI") {
                    HomeActiveStateFigmaView(
                        isVisualTestMode: true,
                        primaryPaymentMethod: .upi(
                            bankName: "ICICI a/c",
                            accountMasked: "xxx23",
                            upiId: "rishabh@***"
                        ),
                        isCompleteUser: false
                    )
                }

                PreviewTile(nodeId: "41-3472", title: "Active Card") {
                    HomeActiveStateFigmaView(
                        isVisualTestMode: true,
                        primaryPaymentMethod: .card(
                            brand: "VISA",
                            lastFour: "2341",
                            expiry: "06/26"
                        ),
                        isCompleteUser: true
                    )
                }

                // Overdue States
                PreviewTile(nodeId: "41-3677", title: "Late 10 Days") {
                    HomeOverdueFigmaView(
                        isVisualTestMode: true,
                        overdueState: .lateByDays(days: 10)
                    )
                }

                PreviewTile(nodeId: "41-3885", title: "Missed Month") {
                    HomeOverdueFigmaView(
                        isVisualTestMode: true,
                        overdueState: .missedMonthRent(month: "December")
                    )
                }
            }
            .padding()
        }
        .background(AppColors.black700)
    }
}

// MARK: - Preview Tile Component

struct PreviewTile<Content: View>: View {
    let nodeId: String
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Label
            HStack {
                Text(nodeId)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(AppColors.brand500)

                Text(title)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
            }

            // Preview scaled down
            content()
                .frame(width: 180, height: 380)
                .scaleEffect(0.45)
                .frame(width: 81, height: 171)
                .clipped()
                .border(AppColors.black400, width: 1)
        }
    }
}

#Preview("Test Grid") {
    HomeFigmaTestGrid()
}

// MARK: - Individual Screen Comparison View
/// Use this view to compare implementation against Figma screenshot

struct HomeFigmaComparisonView: View {
    let figmaNodeId: String

    var body: some View {
        HStack(spacing: 0) {
            // Implementation
            VStack {
                Text("Implementation")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)

                implementationView
                    .frame(width: 393)
            }

            // Figma reference (would load from screenshots)
            VStack {
                Text("Figma Reference")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)

                // Placeholder for Figma screenshot
                Rectangle()
                    .fill(AppColors.black600)
                    .frame(width: 393)
                    .overlay(
                        Text("Load Figma\n\(figmaNodeId).png")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.neutral500)
                            .multilineTextAlignment(.center)
                    )
            }
        }
        .background(AppColors.black700)
    }

    @ViewBuilder
    private var implementationView: some View {
        switch figmaNodeId {
        case "41-4569":
            HomeZeroStateFigmaView(isVisualTestMode: true)
        case "41-6385":
            HomeWithCashbacksFigmaView(isVisualTestMode: true)
        case "41-3267":
            HomeActiveStateFigmaView(
                isVisualTestMode: true,
                primaryPaymentMethod: .upi(
                    bankName: "ICICI a/c",
                    accountMasked: "xxx23",
                    upiId: "rishabh@***"
                ),
                isCompleteUser: false
            )
        case "41-3472":
            HomeActiveStateFigmaView(
                isVisualTestMode: true,
                primaryPaymentMethod: .card(
                    brand: "VISA",
                    lastFour: "2341",
                    expiry: "06/26"
                ),
                isCompleteUser: true
            )
        case "41-3677":
            HomeOverdueFigmaView(
                isVisualTestMode: true,
                overdueState: .lateByDays(days: 10)
            )
        case "41-3885":
            HomeOverdueFigmaView(
                isVisualTestMode: true,
                overdueState: .missedMonthRent(month: "December")
            )
        case "41-4093":
            HomeOverdueFigmaView(
                isVisualTestMode: true,
                overdueState: .multipleOverdue
            )
        case "41-5175":
            HomeLandlordPendingFigmaView(
                isVisualTestMode: true,
                pendingState: .pendingOver24hrs
            )
        case "41-5381":
            HomeLandlordPendingFigmaView(
                isVisualTestMode: true,
                pendingState: .invitePending
            )
        case "41-5792":
            HomeActiveStateFigmaView(
                isVisualTestMode: true,
                primaryPaymentMethod: .upi(
                    bankName: "ICICI a/c",
                    accountMasked: "xxx23",
                    upiId: "rishabh@***"
                ),
                isCompleteUser: false
            )
        default:
            Text("Unknown node: \(figmaNodeId)")
                .foregroundColor(AppColors.error)
        }
    }
}

#Preview("Compare 41-6385") {
    HomeFigmaComparisonView(figmaNodeId: "41-6385")
}
