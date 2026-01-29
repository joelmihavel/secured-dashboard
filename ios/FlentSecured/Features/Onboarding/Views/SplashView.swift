import SwiftUI

struct SplashView: View {
    // MARK: - Config
    var titleGray: String = "Earn \nEverytime "
    var titleOrange: String = "\nYou Pay \nOn Time"
    var subtitle: String = "Get 1% back on your rent when you pay through UPI, netbanking, or cards."
    var activePageIndex: Int = 0
    
    // MARK: - Body
    var body: some View {
        ZStack {
            // Background
            AppColors.backgroundPrimary
                .ignoresSafeArea()
            
            // Dotted Pattern
            DottedGridPattern()
                .opacity(0.4)
                .mask(
                    LinearGradient(
                        colors: [.black, .black.opacity(0.2), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea()
            
            // Content
            VStack(alignment: .leading, spacing: 0) {
                // Status Bar Placeholder (53pt)
                Spacer().frame(height: 53)
                
                VStack(alignment: .leading, spacing: 40) {
                    // Logo
                    FlentLogo(size: 27) // 26.7pt in Figma
                    
                    // Text Content
                    VStack(alignment: .leading, spacing: 16) {
                        // Title
                        Text(titleGray)
                            .font(Typography.h1)
                            .foregroundColor(AppColors.neutral500)
                        + Text(titleOrange)
                            .font(Typography.h1)
                            .foregroundColor(AppColors.brand500)
                        
                        // Subtitle
                        Text(subtitle)
                            .font(Typography.bodyMd2) // 14px
                            .foregroundColor(AppColors.neutral500)
                            .lineSpacing(6) // 20 - 14
                    }
                    
                    // Indicators
                    HStack(spacing: 4) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(index == activePageIndex ? AppColors.brand500 : AppColors.black400)
                                .frame(width: 8, height: 8)
                        }
                    }
                }
                .padding(.horizontal, Spacing.xxxl)
                .padding(.top, 80) // Top padding from Figma container
                
                Spacer()
            }
        }
    }
}

#Preview("Carousel 1") {
    SplashView(
        titleGray: "Earn \nEverytime ",
        titleOrange: "\nYou Pay \nOn Time",
        subtitle: "Get 1% back on your rent when you pay through UPI, netbanking, or cards.",
        activePageIndex: 1
    )
}

#Preview("Carousel 2") {
    SplashView(
        titleGray: "It Gets \nBetter ",
        titleOrange: "\nWith \nTime",
        subtitle: "Pay via Secured to unlock smarter renting benefits.",
        activePageIndex: 2
    )
}