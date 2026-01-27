/// InputField.swift
/// Flent Secured v2 - Input Field Component
///
/// Underline-style text input field with label
///
/// Figma: Components / Input Field
/// - Label: 12px Medium, neutral/500
/// - Input: 20px Regular, white
/// - Underline: 1px neutral/300 (or brand/500 when focused)
/// - Optional "edit" link on right

import SwiftUI

struct InputField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default
    var isSecure: Bool = false
    var errorMessage: String?
    var helperText: String?
    var isDisabled: Bool = false
    var showEditLink: Bool = false
    var onEditTapped: (() -> Void)?

    @FocusState private var isFocused: Bool

    private var hasError: Bool {
        errorMessage != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            // Label row with optional edit link
            HStack {
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)

                Spacer()

                if showEditLink {
                    Button(action: {
                        onEditTapped?()
                    }) {
                        Text("edit")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }

            // Input field
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(.system(size: 20, weight: .regular))
            .foregroundColor(isDisabled ? AppColors.textMuted : AppColors.textPrimary)
            .keyboardType(keyboardType)
            .focused($isFocused)
            .disabled(isDisabled)
            .padding(.vertical, Spacing.xs)

            // Underline
            Rectangle()
                .fill(underlineColor)
                .frame(height: isFocused ? 2 : 1)

            // Helper/Error Text
            if let error = errorMessage {
                Text(error)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.error)
            } else if let helper = helperText {
                Text(helper)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
        }
    }

    private var underlineColor: Color {
        if hasError {
            return AppColors.error
        } else if isFocused {
            return AppColors.accentPrimary
        } else {
            return AppColors.neutral300
        }
    }
}

// MARK: - Phone Input Field (with country code)

struct PhoneInputField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = "Enter Number"
    var countryCode: String = "+91"
    var errorMessage: String?
    var showEditLink: Bool = false
    var onEditTapped: (() -> Void)?

    @FocusState private var isFocused: Bool

    private var hasError: Bool {
        errorMessage != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            // Label row
            HStack {
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.neutral500)

                Spacer()

                if showEditLink {
                    Button(action: {
                        onEditTapped?()
                    }) {
                        Text("edit")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }

            // Input row with country code
            HStack(spacing: Spacing.xs) {
                // Country code dropdown
                HStack(spacing: 4) {
                    Text(countryCode)
                        .font(.system(size: 20, weight: .regular))
                        .foregroundColor(AppColors.textPrimary)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.neutral500)
                }

                // Phone number input
                TextField(placeholder, text: $text)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundColor(AppColors.textPrimary)
                    .keyboardType(.phonePad)
                    .focused($isFocused)
            }
            .padding(.vertical, Spacing.xs)

            // Underline
            Rectangle()
                .fill(underlineColor)
                .frame(height: isFocused ? 2 : 1)

            // Error Text
            if let error = errorMessage {
                Text(error)
                    .font(Typography.caption)
                    .foregroundColor(AppColors.error)
            }
        }
    }

    private var underlineColor: Color {
        if hasError {
            return AppColors.error
        } else if isFocused {
            return AppColors.accentPrimary
        } else {
            return AppColors.neutral300
        }
    }
}

// MARK: - Preview

#Preview("Underline Input Fields") {
    VStack(spacing: Spacing.lg) {
        InputField(
            label: "Account Holder Name",
            text: .constant(""),
            placeholder: "e.g. John Smith",
            showEditLink: true
        )

        InputField(
            label: "IFSC Code",
            text: .constant("SBIN0002125"),
            showEditLink: true
        )

        InputField(
            label: "Email",
            text: .constant(""),
            placeholder: "Enter your email",
            errorMessage: "Invalid email address"
        )

        PhoneInputField(
            label: "Phone",
            text: .constant(""),
            showEditLink: true
        )
    }
    .padding(.horizontal, Spacing.screenHorizontal)
    .background(AppColors.backgroundPrimary)
}
