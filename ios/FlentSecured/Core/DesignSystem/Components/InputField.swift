/// InputField.swift
/// Flent Secured v2 - Input Field Component
///
/// Standard text input field with label and validation
///
/// Figma: Components / Input Field

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

    @FocusState private var isFocused: Bool

    private var hasError: Bool {
        errorMessage != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            // Label
            Text(label)
                .font(Typography.label)
                .foregroundColor(AppColors.textSecondary)

            // Input
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(Typography.bodyMd)
            .foregroundColor(isDisabled ? AppColors.textMuted : AppColors.textPrimary)
            .keyboardType(keyboardType)
            .focused($isFocused)
            .disabled(isDisabled)
            .padding(Spacing.md)
            .background(isDisabled ? AppColors.disabled : AppColors.backgroundSecondary)
            .cornerRadius(Radius.input)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.input)
                    .stroke(
                        borderColor,
                        lineWidth: isFocused ? 2 : 1
                    )
            )

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

    private var borderColor: Color {
        if hasError {
            return AppColors.error
        } else if isFocused {
            return AppColors.accentPrimary
        } else {
            return AppColors.border
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: Spacing.lg) {
        InputField(
            label: "Email",
            text: .constant(""),
            placeholder: "Enter your email"
        )

        InputField(
            label: "Password",
            text: .constant("secret"),
            isSecure: true
        )

        InputField(
            label: "Phone",
            text: .constant("9999999999"),
            errorMessage: "Invalid phone number"
        )

        InputField(
            label: "Disabled",
            text: .constant("Can't edit"),
            isDisabled: true
        )
    }
    .padding()
    .background(AppColors.backgroundPrimary)
}
