import SwiftUI

struct SignUpView: View {
    // MARK: - State
    @State private var phoneNumber = ""
    @State private var name = ""
    @State private var isConsentGiven = false
    
    // Error States
    @State private var phoneError: String? = nil
    @State private var nameError: String? = nil
    
    // MARK: - Computed Properties
    private var isFormValid: Bool {
        !phoneNumber.isEmpty && !name.isEmpty && isConsentGiven && phoneError == nil && nameError == nil
    }
    
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
            
            VStack(alignment: .leading, spacing: 0) {
                // Header Space
                Spacer().frame(height: 53)
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 40) {
                        // Logo
                        FlentLogo(size: 27)
                        
                        // Title
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Let’s get to \n")
                                .font(Typography.h1)
                                .foregroundColor(AppColors.neutral500)
                            + Text("know you")
                                .font(Typography.h1)
                                .foregroundColor(AppColors.brand500)
                        }
                        .lineSpacing(-20) // Adjust line height visually
                        
                        // Inputs
                        VStack(spacing: 32) {
                            PhoneInputField(
                                label: "Phone",
                                text: $phoneNumber,
                                placeholder: "Enter Number",
                                countryCode: "+91",
                                topErrorMessage: phoneError
                            )
                            .onChange(of: phoneNumber) { _, _ in
                                phoneError = nil // Clear error on edit
                            }
                            
                            InputField(
                                label: "Name",
                                text: $name,
                                placeholder: "e.g. John Appleseed",
                                errorMessage: nameError
                            )
                            .onChange(of: name) { _, _ in
                                nameError = nil
                            }
                        }
                        .padding(.top, 24)
                        
                        Spacer()
                            .frame(height: 100) // Spacer to push button down if needed
                    }
                    .padding(.horizontal, Spacing.xxxl)
                    .padding(.top, 80)
                }
                
                // Bottom Section
                VStack(spacing: 24) {
                    PrimaryButton(title: "Get Started", isEnabled: isFormValid) {
                        // Validation logic would go here
                        if phoneNumber.count < 10 {
                            phoneError = "Enter valid number"
                        }
                    }
                    
                    // Consent Toggle
                    HStack(alignment: .top, spacing: 16) {
                        CustomToggle(isOn: $isConsentGiven)
                            .frame(width: 46, height: 24)
                            .padding(.top, 4) // Align with text top
                        
                        Text("I consent to a identity verification via to help verify my profile and other privacy policy and TnC.")
                            .font(Typography.caption)
                            .foregroundColor(AppColors.neutral600)
                            .lineSpacing(4)
                    }
                }
                .padding(.horizontal, Spacing.xxxl)
                .padding(.bottom, 24)
            }
        }
    }
}

// MARK: - Custom Toggle
struct CustomToggle: View {
    @Binding var isOn: Bool
    
    var body: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.2)) {
                isOn.toggle()
            }
        }) {
            ZStack(alignment: isOn ? .trailing : .leading) {
                // Track
                Capsule()
                    .fill(isOn ? AppColors.brand500 : AppColors.black500)
                
                // Thumb
                Circle()
                    .fill(AppColors.neutral200)
                    .padding(2)
                    .shadow(color: .black.opacity(0.2), radius: 1)
            }
        }
    }
}

#Preview {
    SignUpView()
}
