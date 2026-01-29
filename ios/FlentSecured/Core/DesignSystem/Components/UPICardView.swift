/// UPICardView.swift
/// Flent Secured v2 - UPI Payment Method Card
///
/// Figma Node: 41:4430 - UPI Card
/// Used in Payment screens to display saved UPI details
///
/// Features:
/// - Carbon fiber style background
/// - UPI branding
/// - Account details (masked)
/// - Edit capability

import SwiftUI

struct UPICardView: View {
    let upiId: String
    let bankName: String?
    let accountNumberMasked: String?
    let isSelected: Bool
    let onEdit: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            // Main Card Body
            ZStack {
                // Background
                AppColors.black500 // #202020
                
                // Pattern overlay (mocking carbon fiber with dotted or similar)
                // In real implementation, use the asset "carbon-fiber-pattern"
                // Using DottedGridPattern as fallback or gradient
                LinearGradient(
                    colors: [AppColors.black500, AppColors.black600],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                
                // Content
                VStack(alignment: .leading) {
                    // Header
                    HStack {
                        // UPI Logo (Asset)
                        Image("upi-logo-white") // Requires asset
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(height: 16)
                            .frame(width: 45) // Aspect ratio from Figma
                        
                        Spacer()
                        
                        if isSelected {
                            Text("SELECTED")
                                .font(Typography.bodySm)
                                .foregroundColor(AppColors.brand500)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(AppColors.black600)
                                .cornerRadius(200)
                        }
                    }
                    
                    Spacer()
                    
                    // Details
                    VStack(alignment: .leading, spacing: 8) {
                        if let bank = bankName, let acc = accountNumberMasked {
                            Text("\(bank) a/c - ")
                                .foregroundColor(AppColors.black400)
                            + Text(acc)
                                .foregroundColor(AppColors.brand500)
                        }
                        
                        Text(upiId)
                            .foregroundColor(AppColors.black400)
                    }
                    .font(Typography.bodyMd) // 16px
                }
                .padding(.top, 24)
                .padding(.bottom, 24) // Adjusted from Figma's large gap
                .padding(.leading, 32)
                .padding(.trailing, 16)
            }
            .frame(height: 180) // Approx height based on Figma visuals
            .clipShape(RoundedCorner(radius: 12, corners: [.topLeft, .topRight]))
            
            // Bottom Footer
            HStack {
                HStack(spacing: 4) {
                    Text("UPI")
                        .font(Typography.bodyMd2) // 14px
                        .foregroundColor(AppColors.neutral300) // #CBCBCB
                    
                    if onEdit != nil {
                        Image(systemName: "pencil")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.neutral300)
                    }
                }
                
                Spacer()
                
                // Flent Logo (Small)
                FlentLogo(size: 20)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 16)
            .background(AppColors.black600) // #1A1A1A
            .clipShape(RoundedCorner(radius: 12, corners: [.bottomLeft, .bottomRight]))
        }
        // Shadow from Figma: 0px 6px 12px -2px rgba(153,92,65,0.24) if selected?
        // Or generic shadow
    }
}

#Preview {
    ZStack {
        AppColors.black700.ignoresSafeArea()
        VStack {
            UPICardView(
                upiId: "rishabh@okicici",
                bankName: "ICICI",
                accountNumberMasked: "xxx23",
                isSelected: true,
                onEdit: {}
            )
            .padding()
            
            UPICardView(
                upiId: "john@paytm",
                bankName: nil,
                accountNumberMasked: nil,
                isSelected: false,
                onEdit: nil
            )
            .padding()
        }
    }
}
