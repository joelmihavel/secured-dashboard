/// EditUPIMethodView.swift
/// Flent Secured v2 - Edit UPI Method Screen (Profile Section)
///
/// Figma: 41:8450 - Edit your UPI Method
///
/// Design Specifications:
/// - Header: "Edit your" (white, 48px light) "UPI Method" (brand500, 48px light)
/// - Fields: Account holder name, UPI ID
/// - Field labels: 14px regular, neutral500, with "edit" link
/// - Field values: 20px regular, white
/// - Save Changes button at bottom

import SwiftUI

struct ProfileEditUPIView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var accountHolderName = "John Smith"
    @State private var upiId = "john@oksbi"
    @State private var isEditing = false
    @State private var isSaving = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header with back button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.white)
                        .frame(width: 24, height: 24)
                }
                .padding(.top, Spacing.md)

                // Title - Figma: "Edit your" "UPI Method" 48px light
                VStack(alignment: .leading, spacing: 0) {
                    Text("Edit your")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(.white)
                    Text("UPI Method")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                Spacer()
                    .frame(height: Spacing.xl)

                // Account holder name field
                PaymentEditField(
                    label: "Account holder name",
                    value: accountHolderName,
                    isEditable: true
                ) {
                    isEditing = true
                }

                // UPI ID field
                PaymentEditField(
                    label: "UPI ID",
                    value: upiId,
                    isEditable: true
                ) {
                    isEditing = true
                }

                Spacer()

                // Drag indicator - Figma: Small gray bar
                HStack {
                    Spacer()
                    Capsule()
                        .fill(AppColors.black400)
                        .frame(width: 32, height: 4)
                    Spacer()
                }
                .padding(.bottom, Spacing.md)

                // Save Changes Button - Figma: Dark button with gradient
                PrimaryButton(
                    title: isSaving ? "Saving..." : "Save Changes",
                    isLoading: isSaving,
                    isEnabled: !isSaving
                ) {
                    saveChanges()
                }

                Spacer()
                    .frame(height: Spacing.lg)
            }
            .padding(.horizontal, Spacing.lg)
        }
        .navigationBarHidden(true)
    }

    private func saveChanges() {
        isSaving = true
        // Simulate save
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isSaving = false
            coordinator.pop()
        }
    }
}

// MARK: - Payment Edit Field
// Figma: Label with "edit" link, large value text below

struct PaymentEditField: View {
    let label: String
    let value: String
    var isEditable: Bool = false
    var onEdit: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Label row with edit link
            HStack {
                Text(label)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Spacer()

                if isEditable, let onEdit = onEdit {
                    Button(action: onEdit) {
                        Text("edit")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }

            // Value - Figma: 20px regular, white
            Text(value)
                .font(.system(size: 20, weight: .regular))
                .foregroundColor(.white)
        }
        .padding(.bottom, Spacing.lg)
    }
}

// MARK: - Preview

#Preview {
    ProfileEditUPIView()
        .environment(AppCoordinator())
}
