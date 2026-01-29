/// AddMoreCardView.swift
/// Flent Secured v2 - Add New Payment Method Card
///
/// Figma Node: 41:4559 - Add More Card
/// Used in Payment screens to add new payment methods
///
/// Features:
/// - Carbon fiber style background (same as UPI card)
/// - Dashed/styled typography for "Setup"
/// - "+ NEW PAYMENT" footer

import SwiftUI

struct AddMoreCardView: View {
    let action: () -> Void

    var body: some View {
        Button(action: {
            HapticManager.shared.lightImpact()
            action()
        }) {
            VStack(spacing: 0) {
                // Main Card Body
                ZStack {
                    // Background
                    AppColors.black500 // #202020
                    
                    // Pattern overlay
                    LinearGradient(
                        colors: [AppColors.black500, AppColors.black600],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    
                    // Content
                    VStack(alignment: .leading, spacing: 4) {
                        Text("+")
                            .font(Typography.bodyLg) // 20px
                            .foregroundColor(AppColors.brand500)
                        
                        Text("Setup")
                            .font(Typography.bodyLg) // 20px
                            .foregroundColor(AppColors.brand500)
                        
                        Text("your payment\nmethod to start")
                            .font(Typography.bodyLg) // 20px
                            .foregroundColor(AppColors.neutral300) // #CBCBCB
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 40)
                }
                .frame(height: 180)
                .clipShape(RoundedCorner(radius: 12, corners: [.topLeft, .topRight]))
                
                // Bottom Footer
                HStack {
                    Text("+ NEW PAYMENT")
                        .font(Typography.bodyMd2) // 14px
                        .foregroundColor(AppColors.brand500)
                    
                    Spacer()
                    
                    // Flent Logo (Small)
                    FlentLogo(size: 20)
                }
                .padding(.horizontal, 32)
                .padding(.vertical, 16)
                .background(AppColors.black600) // #1A1A1A
                .clipShape(RoundedCorner(radius: 12, corners: [.bottomLeft, .bottomRight]))
            }
        }
        .buttonStyle(PressableButtonStyle())
    }
}

#Preview {
    ZStack {
        AppColors.black700.ignoresSafeArea()
        AddMoreCardView(action: {})
            .padding()
    }
}
