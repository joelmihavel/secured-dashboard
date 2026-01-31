/// ScreenLauncherView.swift
/// Flent Secured v2 - DEBUG-only Screen Launcher
///
/// Provides a UI to navigate to any screen in the app for parity testing.
/// Only compiled in DEBUG builds.

#if DEBUG

import SwiftUI

// MARK: - Screen Launcher Item

/// Represents a launchable screen with its configuration
struct ScreenLauncherItem: Identifiable {
    let id = UUID()
    let name: String
    let route: Route
    let presentation: PresentationMode
    let nodeId: String?  // Figma node ID for parity tracking
    let category: ScreenCategory

    enum PresentationMode {
        case push
        case sheet
        case fullScreenCover
    }

    enum ScreenCategory: String, CaseIterable {
        case splash = "Splash & Auth"
        case onboarding = "Onboarding"
        case setup = "Setup"
        case home = "Home States"
        case payment = "Payment"
        case transactions = "Transactions"
        case profile = "Profile"
    }
}

// MARK: - Screen Launcher View Model

@Observable
final class ScreenLauncherViewModel {

    var selectedCategory: ScreenLauncherItem.ScreenCategory = .splash
    var searchText = ""
    var showRouteEvidence = false
    var lastLaunchedScreen: ScreenLauncherItem?

    /// All available screens organized by category
    let screens: [ScreenLauncherItem] = {
        var items: [ScreenLauncherItem] = []

        // MARK: - Splash & Auth
        items.append(contentsOf: [
            ScreenLauncherItem(
                name: "Splash Carousel",
                route: .splash,
                presentation: .push,
                nodeId: "1-28055",
                category: .splash
            ),
            ScreenLauncherItem(
                name: "Phone Entry (Signup)",
                route: .phoneEntry(authIntent: .signup),
                presentation: .push,
                nodeId: "1-28071",
                category: .splash
            ),
            ScreenLauncherItem(
                name: "Phone Entry (Login)",
                route: .phoneEntry(authIntent: .login),
                presentation: .push,
                nodeId: "1-28071",
                category: .splash
            ),
            ScreenLauncherItem(
                name: "OTP Verification",
                route: .otpVerification(phone: "+91 98765 43210", name: "Test User"),
                presentation: .push,
                nodeId: "1-31175",
                category: .splash
            ),
        ])

        // MARK: - Onboarding
        items.append(contentsOf: [
            ScreenLauncherItem(
                name: "Name Verification",
                route: .nameVerification,
                presentation: .push,
                nodeId: "1-30448",
                category: .onboarding
            ),
            ScreenLauncherItem(
                name: "Agreement Upload",
                route: .agreementUpload,
                presentation: .push,
                nodeId: "1-29914",
                category: .onboarding
            ),
            ScreenLauncherItem(
                name: "Agreement Review",
                route: .agreementReview(extractionId: "mock-extraction-123"),
                presentation: .push,
                nodeId: "1-30448",
                category: .onboarding
            ),
            ScreenLauncherItem(
                name: "Waitlist",
                route: .waitlist,
                presentation: .push,
                nodeId: "1-29914",
                category: .onboarding
            ),
            ScreenLauncherItem(
                name: "Post Approval Step 1",
                route: .postApprovalStep1,
                presentation: .push,
                nodeId: "1-30001",
                category: .onboarding
            ),
            ScreenLauncherItem(
                name: "Post Approval Step 2",
                route: .postApprovalStep2,
                presentation: .push,
                nodeId: "1-30090",
                category: .onboarding
            ),
        ])

        // MARK: - Setup
        items.append(contentsOf: [
            ScreenLauncherItem(
                name: "Pending Steps",
                route: .pendingSteps,
                presentation: .push,
                nodeId: "1-30178",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Add Bank",
                route: .addBank,
                presentation: .push,
                nodeId: "41-10712",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Add Utility (Address Proof)",
                route: .addUtility,
                presentation: .push,
                nodeId: "41-10859",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Invite Landlord",
                route: .inviteLandlord,
                presentation: .push,
                nodeId: "41-11006",
                category: .setup
            ),
            // Setup Flow States
            ScreenLauncherItem(
                name: "Setup Flow - Step 1 Bank",
                route: .setupFlow(state: .step1BankDetails),
                presentation: .push,
                nodeId: "41-10712",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Setup Flow - Step 2 Address",
                route: .setupFlow(state: .step2AddressProof),
                presentation: .push,
                nodeId: "41-10859",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Setup Flow - Step 3 Invite",
                route: .setupFlow(state: .step3InviteLandlord),
                presentation: .push,
                nodeId: "41-11006",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Setup Flow - Waiting Landlord",
                route: .setupFlow(state: .waitingForLandlord(daysSinceSent: 2, canResend: true)),
                presentation: .push,
                nodeId: "41-4969",
                category: .setup
            ),
            ScreenLauncherItem(
                name: "Setup Flow - Landlord Declined",
                route: .setupFlow(state: .landlordDeclined),
                presentation: .push,
                nodeId: "41-5587",
                category: .setup
            ),
        ])

        // MARK: - Home States
        items.append(contentsOf: [
            // Figma Implementation (for parity testing)
            ScreenLauncherItem(
                name: "Home - Zero State (FIGMA)",
                route: .homeZeroStateFigma,
                presentation: .push,
                nodeId: "41-4569",
                category: .home
            ),
            // Empty States
            ScreenLauncherItem(
                name: "Home - Zero State",
                route: .home(state: .zeroState),
                presentation: .push,
                nodeId: "41-4569",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Setup Payment (UPI)",
                route: .home(state: .setupPaymentUPI),
                presentation: .push,
                nodeId: "41-3186",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Payment Method Selection (Sheet)",
                route: .paymentMethodSelectionSheet,
                presentation: .sheet,
                nodeId: "41-7005",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Home - Empty with UPI Payments",
                route: .home(state: .emptyWithUPIPayments),
                presentation: .push,
                nodeId: "41-5792",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Empty with UPI Paid",
                route: .home(state: .emptyWithUPIPaid),
                presentation: .push,
                nodeId: "41-5998",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Empty with UPI No Payments",
                route: .home(state: .emptyWithUPINoPayments),
                presentation: .push,
                nodeId: "41-6204",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Empty with Cashback",
                route: .home(state: .emptyWithCashback),
                presentation: .push,
                nodeId: "41-6385",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Empty with Cashback Paid",
                route: .home(state: .emptyWithCashbackPaid),
                presentation: .push,
                nodeId: "41-6598",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Empty No Cashback",
                route: .home(state: .emptyNoCashback),
                presentation: .push,
                nodeId: "41-6811",
                category: .home
            ),
            // Active States
            ScreenLauncherItem(
                name: "Home - Active Qualified",
                route: .home(state: .activeQualified),
                presentation: .push,
                nodeId: "41-3267",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Active Complete",
                route: .home(state: .activeComplete),
                presentation: .push,
                nodeId: "41-3472",
                category: .home
            ),
            // Payment Issue States
            ScreenLauncherItem(
                name: "Home - Late Payment",
                route: .home(state: .latePayment),
                presentation: .push,
                nodeId: "41-3677",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Missed Payment",
                route: .home(state: .missedPayment),
                presentation: .push,
                nodeId: "41-3885",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Multiple Missed Payments",
                route: .home(state: .multipleMissedPayments(months: 2, totalAmount: 50000)),
                presentation: .push,
                nodeId: "41-4093",
                category: .home
            ),
            // Paid State
            ScreenLauncherItem(
                name: "Home - Paid This Month (Pending)",
                route: .home(state: .paidThisMonth(settlementStatus: .pending)),
                presentation: .push,
                nodeId: "41-7246",
                category: .home
            ),
            ScreenLauncherItem(
                name: "Home - Paid This Month (Completed)",
                route: .home(state: .paidThisMonth(settlementStatus: .completed)),
                presentation: .push,
                nodeId: "41-7460",
                category: .home
            ),
        ])

        // MARK: - Payment
        items.append(contentsOf: [
            ScreenLauncherItem(
                name: "Payment",
                route: .payment,
                presentation: .push,
                nodeId: "1-30820",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Transaction",
                route: .paymentTransaction(tenancyId: "mock-tenancy-123", rentAmountPaise: 2500000),
                presentation: .push,
                nodeId: "1-31073",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Methods",
                route: .paymentMethods,
                presentation: .sheet,
                nodeId: "1-31175",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Summary",
                route: .paymentSummary(paymentId: "mock-payment-123"),
                presentation: .push,
                nodeId: "1-31277",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Processing",
                route: .paymentProcessing(paymentId: "mock-payment-123"),
                presentation: .fullScreenCover,
                nodeId: "1-31380",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Result (Success)",
                route: .paymentResult(paymentId: "mock-payment-123", success: true),
                presentation: .fullScreenCover,
                nodeId: "1-31485",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Result (Failure)",
                route: .paymentResult(paymentId: "mock-payment-123", success: false),
                presentation: .fullScreenCover,
                nodeId: "1-31590",
                category: .payment
            ),
            ScreenLauncherItem(
                name: "Payment Result (Refunded)",
                route: .paymentResult(paymentId: "mock-payment-123", success: false, refunded: true),
                presentation: .fullScreenCover,
                nodeId: "1-31671",
                category: .payment
            ),
        ])

        // MARK: - Transactions
        items.append(contentsOf: [
            ScreenLauncherItem(
                name: "Transactions List",
                route: .transactions,
                presentation: .push,
                nodeId: "1-33737",
                category: .transactions
            ),
            ScreenLauncherItem(
                name: "Transaction Detail",
                route: .transactionDetail(id: "mock-txn-123"),
                presentation: .sheet,
                nodeId: "1-34150",
                category: .transactions
            ),
        ])

        // MARK: - Profile
        items.append(contentsOf: [
            ScreenLauncherItem(
                name: "Profile",
                route: .profile,
                presentation: .push,
                nodeId: "1-34236",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Personal Details",
                route: .personalDetails,
                presentation: .push,
                nodeId: "1-34343",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Tenancy Details",
                route: .tenancyDetails,
                presentation: .push,
                nodeId: "41-8367",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Payment History",
                route: .paymentHistory,
                presentation: .push,
                nodeId: "41-8529",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Help & FAQ",
                route: .helpFAQ,
                presentation: .push,
                nodeId: "41-8693",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Settings",
                route: .settings,
                presentation: .push,
                nodeId: "41-8760",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Referral",
                route: .referral,
                presentation: .push,
                nodeId: "41-8880",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Linked Landlord",
                route: .linkedLandlord,
                presentation: .push,
                nodeId: "41-9004",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Landlord Bank Account",
                route: .landlordBankAccount,
                presentation: .push,
                nodeId: "41-9114",
                category: .profile
            ),
            ScreenLauncherItem(
                name: "Agreement Details",
                route: .agreementDetails,
                presentation: .push,
                nodeId: "41-9224",
                category: .profile
            ),
        ])

        return items
    }()

    var filteredScreens: [ScreenLauncherItem] {
        let categoryScreens = screens.filter { $0.category == selectedCategory }
        if searchText.isEmpty {
            return categoryScreens
        }
        return categoryScreens.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    func logRouteEvidence(for item: ScreenLauncherItem) {
        lastLaunchedScreen = item

        // Create evidence JSON
        let evidence: [String: Any] = [
            "screen": item.nodeId ?? item.route.id,
            "opened_via": "ScreenLauncher",
            "route_identifier": item.route.id,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "notes": "Launched via DEBUG ScreenLauncher with mock data"
        ]

        // Log to console for debugging
        if let data = try? JSONSerialization.data(withJSONObject: evidence, options: .prettyPrinted),
           let jsonString = String(data: data, encoding: .utf8) {
            print("=== ROUTE EVIDENCE ===")
            print(jsonString)
            print("======================")
        }

        // In a real implementation, this would write to:
        // Screens/{nodeId}/parity/route_evidence.json
    }
}

// MARK: - Screen Launcher View

struct ScreenLauncherView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @State private var viewModel = ScreenLauncherViewModel()

    /// Binding to control visibility from parent (for overlay mode)
    @Binding var isVisible: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Category Picker
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(ScreenLauncherItem.ScreenCategory.allCases, id: \.self) { category in
                            CategoryPill(
                                title: category.rawValue,
                                isSelected: viewModel.selectedCategory == category
                            ) {
                                viewModel.selectedCategory = category
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 12)

                Divider()

                // Screen List
                List(viewModel.filteredScreens) { item in
                    ScreenLauncherRow(item: item) {
                        launchScreen(item)
                    }
                }
                .listStyle(.plain)
            }
            .searchable(text: $viewModel.searchText, prompt: "Search screens...")
            .navigationTitle("Screen Launcher")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        coordinator.dismiss()
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func launchScreen(_ item: ScreenLauncherItem) {
        viewModel.logRouteEvidence(for: item)

        // Hide the launcher for push navigation so user can see the screen
        if item.presentation == .push {
            withAnimation {
                isVisible = false
            }
        }

        switch item.presentation {
        case .push:
            coordinator.navigate(to: item.route)
        case .sheet:
            coordinator.present(sheet: item.route)
        case .fullScreenCover:
            coordinator.presentFullScreen(item.route)
        }
    }
}

// MARK: - Category Pill

struct CategoryPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .black : .white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isSelected ? Color.green : Color.white.opacity(0.1))
                )
        }
    }
}

// MARK: - Screen Launcher Row

struct ScreenLauncherRow: View {
    let item: ScreenLauncherItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name)
                        .font(.body)
                        .foregroundColor(.white)

                    HStack(spacing: 8) {
                        // Node ID
                        if let nodeId = item.nodeId {
                            Text(nodeId)
                                .font(.caption2)
                                .foregroundColor(.gray)
                        }

                        // Presentation mode badge
                        Text(presentationBadge)
                            .font(.caption2)
                            .foregroundColor(presentationColor)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .stroke(presentationColor, lineWidth: 1)
                            )
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.gray)
                    .font(.caption)
            }
            .padding(.vertical, 4)
        }
    }

    private var presentationBadge: String {
        switch item.presentation {
        case .push: return "Push"
        case .sheet: return "Sheet"
        case .fullScreenCover: return "Cover"
        }
    }

    private var presentationColor: Color {
        switch item.presentation {
        case .push: return .blue
        case .sheet: return .orange
        case .fullScreenCover: return .purple
        }
    }
}

// MARK: - Preview

#Preview {
    ScreenLauncherView(isVisible: .constant(true))
        .environment(AppCoordinator())
}

#endif
