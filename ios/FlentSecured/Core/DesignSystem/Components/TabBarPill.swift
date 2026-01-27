/// TabBarPill.swift
/// Flent Secured v2 - Tab Bar Pill Component
///
/// Segmented tab selector with pill-style selection
///
/// Figma: Components / Tab Bar
/// - Container: transparent
/// - Selected: #202020 bg, white text, rd-40
/// - Unselected: transparent bg, gray text

import SwiftUI

struct TabBarPill<Tab: Hashable>: View {
    @Binding var selectedTab: Tab
    let tabs: [(Tab, String)]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.0) { tab, title in
                TabItem(
                    title: title,
                    isSelected: selectedTab == tab
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }
            }
        }
        .padding(4)
        .background(Color.clear)
    }
}

// MARK: - Tab Item

private struct TabItem: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(isSelected ? .white : AppColors.neutral500)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(
                    isSelected ?
                    AnyView(
                        Capsule()
                            .fill(AppColors.black500)
                    ) :
                    AnyView(Color.clear)
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Simple Two-Tab Version

struct HomeTabBar: View {
    @Binding var selectedTab: HomeTab

    enum HomeTab: String, CaseIterable {
        case home = "Home"
        case transactions = "Transactions"
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(HomeTab.allCases, id: \.self) { tab in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }) {
                    Text(tab.rawValue)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(selectedTab == tab ? .white : AppColors.neutral500)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(
                            selectedTab == tab ?
                            AnyView(
                                Capsule()
                                    .fill(AppColors.black500)
                            ) :
                            AnyView(Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
    }
}

// MARK: - Preview

#Preview("Tab Bar Pill") {
    VStack(spacing: Spacing.xl) {
        // Home tab bar
        HomeTabBar(selectedTab: .constant(.home))

        HomeTabBar(selectedTab: .constant(.transactions))

        // Generic tab bar
        TabBarPill(
            selectedTab: .constant(0),
            tabs: [(0, "First"), (1, "Second"), (2, "Third")]
        )
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
