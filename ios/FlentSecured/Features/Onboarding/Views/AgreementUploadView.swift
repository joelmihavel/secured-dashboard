import SwiftUI

struct AgreementUploadView: View {
    // MARK: - Assets
    // These should ideally be moved to an Asset catalog or Constants file in a real app
    private let imgVector45 = "https://www.figma.com/api/mcp/asset/28714a31-4800-4989-9cf0-d78cad53ea01" // Paperclip watermark
    private let imgVector1 = "https://www.figma.com/api/mcp/asset/e884e3c8-e927-40f1-a915-d532346b79b2" // F Logo Background
    private let imgTrashIcon = "https://www.figma.com/api/mcp/asset/afe1a4a9-cfe0-4a1b-8851-d822782674e5" // Red trash can
    private let imgFileIcon = "https://www.figma.com/api/mcp/asset/beeaa434-ab4e-42e6-8e17-f68da1d5c767" // File icon inside card
    private let imgLogo = "https://www.figma.com/api/mcp/asset/f46b5b3b-10a9-4466-bcea-435e8d572b1a" // Small logo above title
    
            // MARK: - State
    
            @State private var isUploading = false
    
            @State private var selectedFileName: String? = "Joel_Ramesh-Agreement_Dec 2025.pdf" // Default for filled state preview
    
            @State private var errorMessage: String? = nil // Default no error
    
            
    
            var body: some View {
    
                ZStack {
    
                    // MARK: - Background
    
                    AppColors.backgroundPrimary
    
                        .ignoresSafeArea()
    
                    
    
                    // Background Watermark (F logo)
    
                    GeometryReader { proxy in
    
                        AsyncImage(url: URL(string: imgVector1)) { image in
    
                            image
    
                                .resizable()
    
                                .aspectRatio(contentMode: .fit)
    
                        } placeholder: {
    
                            Color.clear
    
                        }
    
                        .frame(width: 333.75, height: 400)
    
                        .position(x: proxy.size.width - (333.75 / 2) + 120, y: 200)
    
                        
    
                        // Paperclip Watermark
    
                        VStack {
    
                            Spacer()
    
                            HStack {
    
                                AsyncImage(url: URL(string: imgVector45)) { image in
    
                                    image.resizable().aspectRatio(contentMode: .fit)
    
                                } placeholder: {
    
                                    Color.clear
    
                                }
    
                                .frame(width: 306, height: 194.5)
    
                                .offset(x: 43.5, y: 0)
    
                            }
    
                        }
    
                    }
    
                    .ignoresSafeArea()
    
                    .allowsHitTesting(false)
    
                    
    
                    // MARK: - Content
    
                    VStack(spacing: 0) {
    
                        // Header Space
    
                        Spacer().frame(height: 60)
    
                        
    
                        ScrollView(showsIndicators: false) {
    
                            VStack(alignment: .leading, spacing: Spacing.xl) { // 48px
    
                                
    
                                // Title Section
    
                                VStack(alignment: .leading, spacing: Spacing.md) { // 16px
    
                                    // Logo/Icon
    
                                    AsyncImage(url: URL(string: imgLogo)) { image in
    
                                        image.resizable().aspectRatio(contentMode: .fit)
    
                                    } placeholder: {
    
                                        Color.clear
    
                                    }
    
                                    .frame(width: 32, height: 38.4)
    
                                    
    
                                    // Title Text
    
                                    Group {
    
                                        Text("One ")
    
                                            .foregroundColor(AppColors.neutral500)
    
                                        + Text("\n")
    
                                        + Text("More Step")
    
                                            .foregroundColor(AppColors.brand500)
    
                                    }
    
                                    .font(Typography.h1)
    
                                    .lineSpacing(-20)
    
                                    
    
                                    // Subtitle
    
                                    Text("Your rental agreement helps us confirm your details and unlock your Secured benefits.")
    
                                        .font(Typography.bodySm)
    
                                        .foregroundColor(AppColors.black300)
    
                                        .lineSpacing(8)
    
                                        .fixedSize(horizontal: false, vertical: true)
    
                                }
    
                                
    
                                // Upload Card Section
    
                                VStack(spacing: Spacing.lg) {
    
                                    if let fileName = selectedFileName {
    
                                        // MARK: - Filled State
    
                                        filledCard(fileName: fileName)
    
                                    } else {
    
                                        // MARK: - Empty State
    
                                        emptyCard()
    
                                    }
    
                                    
    
                                    // Error Message
    
                                    if let error = errorMessage {
    
                                        Text(error)
    
                                            .font(Typography.bodyMd2)
    
                                            .foregroundColor(AppColors.error)
    
                                            .multilineTextAlignment(.center)
    
                                            .padding(.horizontal, Spacing.xs)
    
                                    }
    
                                                        }
    
                                                    }
    
                                                    .padding(.horizontal, Spacing.xxxl) // 48px per Figma
    
                                                }
    
                                                
    
                                                Spacer()
    
                        
    
                                        // Bottom Button
    
                        
    
                                        PrimaryButton(
    
                        
    
                                            title: errorMessage != nil ? "Upload Again" : "Get Started",
    
                        
    
                                            isEnabled: selectedFileName != nil
    
                        
    
                                        ) {
    
                        
    
                                            // Action
    
                        
    
                                        }
    
                        
    
                                        .padding(.horizontal, Spacing.xxxl) // 48px
    
                        
    
                                        .padding(.bottom, Spacing.md)
    
                        
    
                                    }
    
                        
    
                                }
    
                        
    
                            }
    
            
    
            // MARK: - Subviews
    
            
    
            private func filledCard(fileName: String) -> some View {
    
                VStack(spacing: Spacing.md) {
    
                    // Trash Icon
    
                    HStack {
    
                        Spacer()
    
                        Button(action: {
    
                            selectedFileName = nil // Delete action
    
                            errorMessage = nil
    
                        }) {
    
                            AsyncImage(url: URL(string: imgTrashIcon)) { image in
    
                                image.resizable().aspectRatio(contentMode: .fit)
    
                            } placeholder: {
    
                                Color.red.opacity(0.1)
    
                            }
    
                            .frame(width: 54, height: 54)
    
                        }
    
                    }
    
                    .padding(.top, -Spacings.custom(-20))
    
                    .padding(.trailing, -Spacings.custom(20))
    
                    
    
                    // File Info
    
                    VStack(spacing: 12) {
    
                        ZStack {
    
                            AsyncImage(url: URL(string: imgFileIcon)) { image in
    
                                image.resizable().aspectRatio(contentMode: .fit)
    
                            } placeholder: {
    
                                Color.gray.opacity(0.3)
    
                            }
    
                            .frame(width: 16, height: 16)
    
                            .frame(width: 40, height: 40)
    
                        }
    
                        
    
                        Text(fileName)
    
                            .font(Typography.bodySm)
    
                            .foregroundColor(errorMessage != nil ? Color(hex: "d2d2d2") : AppColors.black400)
    
                            .multilineTextAlignment(.center)
    
                    }
    
                    .padding(.bottom, Spacing.lg)
    
                }
    
                .padding(Spacing.md)
    
                .frame(maxWidth: .infinity)
    
                .background(AppColors.black500)
    
                .cornerRadius(Radius.md)
    
                .overlay(
    
                    RoundedRectangle(cornerRadius: Radius.md)
    
                        .stroke(errorMessage != nil ? AppColors.error : Color.clear, lineWidth: 1)
    
                )
    
            }
    
            
    
            private func emptyCard() -> some View {
    
                Button(action: {
    
                    // Trigger file picker
    
                    selectedFileName = "New_Agreement.pdf" // Mock selection
    
                }) {
    
                    HStack(spacing: Spacing.md) {
    
                        // Icon
    
                        ZStack {
    
                            RoundedRectangle(cornerRadius: Radius.md)
    
                                .fill(AppColors.black600)
    
                                .frame(width: 56, height: 56)
    
                            
    
                            Image(systemName: "square.and.arrow.up") // Fallback icon
    
                                .foregroundColor(AppColors.neutral500)
    
                                .font(.system(size: 24))
    
                        }
    
                        
    
                        // Text
    
                        VStack(alignment: .leading, spacing: 4) {
    
                            Text("Upload Rental Agreement")
    
                                .font(Typography.bodySm)
    
                                .foregroundColor(AppColors.neutral500)
    
                            
    
                            Text("File types: PDF, DOCX, Max size: 10MB")
    
                                .font(Typography.caption)
    
                                .foregroundColor(AppColors.neutral600)
    
                        }
    
                        
    
                        Spacer()
    
                    }
    
                    .padding(Spacing.md)
    
                    .frame(maxWidth: .infinity)
    
                    .background(AppColors.black500)
    
                    .cornerRadius(Radius.md)
    
                }
    
                .buttonStyle(PlainButtonStyle())
    
            }}

// Helper for custom spacing to avoid magic numbers in main code if re-used
struct Spacings {
    static func custom(_ value: CGFloat) -> CGFloat { value }
}

#Preview {
    AgreementUploadView()
}
