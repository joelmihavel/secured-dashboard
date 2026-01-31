/// EditCreditCardView.swift
/// Flent Secured v2 - Edit Credit Card Screen (Profile Section)
///
/// Figma: 41:8612 - Edit your Credit Card
///
/// Design Specifications:
/// - Header: "Edit your" (white, 48px light) "Credit Card" (brand500, 48px light)
/// - Fields: Cardholder name, Card number, Expiry date, CVV
/// - Field labels: 14px regular, neutral500, with "edit" link
/// - Field values: 20px regular, white (CVV masked as ***)
/// - Save Changes button at bottom

import SwiftUI

struct ProfileEditCreditCardView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var cardholderName = "John Smith"
    @State private var cardNumber = "1234 5678 9012 3456"
    @State private var expiryDate = "01 / 27"
    @State private var cvv = "***"
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

                // Title - Figma: "Edit your" "Credit Card" 48px light
                VStack(alignment: .leading, spacing: 0) {
                    Text("Edit your")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(.white)
                    Text("Credit Card")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                Spacer()
                    .frame(height: Spacing.xl)

                // Cardholder name field
                PaymentEditField(
                    label: "Cardholder name",
                    value: cardholderName,
                    isEditable: true
                ) {
                    isEditing = true
                }

                // Card number field
                PaymentEditField(
                    label: "Card number",
                    value: cardNumber,
                    isEditable: true
                ) {
                    isEditing = true
                }

                // Expiry date field
                PaymentEditField(
                    label: "Expiry date",
                    value: expiryDate,
                    isEditable: true
                ) {
                    isEditing = true
                }

                // CVV field
                PaymentEditField(
                    label: "CVV",
                    value: cvv,
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

// MARK: - Preview

#Preview {
    ProfileEditCreditCardView()
        .environment(AppCoordinator())
}
