/// AddPaymentMethodView.swift
/// Flent Secured v2 - Add Payment Method Views
///
/// Figma Nodes:
/// - 41:8369 - Add UPI Payment
/// - 41:8529 - Add Credit/Debit Card (tokenization flow)
/// - 41:9224 - Add Net Banking (bank selection)
///
/// Features:
/// - Bottom sheet presentation with drag handle
/// - Form inputs for payment method details
/// - Real-time validation and card type detection
/// - Security badge for card entry
/// - Bank search and selection

import SwiftUI

// MARK: - Add UPI View

/// Add UPI payment method sheet
/// Figma: node-id=41:8369
/// Specifications:
/// - Background: #1A1A1A (black/600)
/// - Corner radius: 24px top corners
/// - Title: 20px semibold white
/// - Label: 14px medium neutral/500
/// - Input: 16px regular white on #202020 background
/// - Placeholder: #797979 (black/300)
/// - Button: Full width primary CTA
struct AddUPIView: View {
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isInputFocused: Bool
    @State private var upiId: String = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @State private var isValid = false
    @State private var showSuccess = false

    let onComplete: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Drag handle - Figma: 40x4, rd-2, #4D4D4D
            DragHandle()
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.lg)
                .frame(maxWidth: .infinity)

            // Title - Figma: 20px semibold white
            Text("Add UPI ID")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.white)
                .padding(.bottom, Spacing.lg)

            // UPI ID Input Section
            VStack(alignment: .leading, spacing: Spacing.xs) {
                // Label - Figma: 14px medium neutral/500
                Text("UPI ID")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.neutral500)

                // Input field - Figma: 16px on #202020, rd-8
                HStack(spacing: Spacing.sm) {
                    TextField("", text: $upiId)
                        .placeholder(when: upiId.isEmpty) {
                            Text("yourname@upi")
                                .foregroundColor(AppColors.black300)
                        }
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($isInputFocused)
                        .onChange(of: upiId) { _, newValue in
                            validateUPIId(newValue)
                        }

                    // Validation indicator
                    if !upiId.isEmpty {
                        if isValid {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(AppColors.success)
                                .transition(.scale.combined(with: .opacity))
                        } else if errorMessage != nil {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(AppColors.error)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                }
                .padding(Spacing.md)
                .background(AppColors.black500)
                .cornerRadius(Radius.input)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.input)
                        .stroke(
                            inputBorderColor,
                            lineWidth: inputBorderWidth
                        )
                )
                .animation(.easeInOut(duration: 0.2), value: isValid)
                .animation(.easeInOut(duration: 0.2), value: errorMessage)

                // Error message
                if let error = errorMessage {
                    HStack(spacing: Spacing.xxs) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 12))
                        Text(error)
                            .font(.system(size: 12, weight: .regular))
                    }
                    .foregroundColor(AppColors.error)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .animation(.easeInOut(duration: 0.2), value: errorMessage != nil)

            Spacer()
                .frame(height: Spacing.lg)

            // UPI Apps Info - Figma: Info card with icon
            HStack(alignment: .top, spacing: Spacing.sm) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.brand500)

                Text("Enter your UPI ID linked to any UPI app like Google Pay, PhonePe, or Paytm")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(AppColors.neutral500)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(Spacing.md)
            .background(AppColors.brand500.opacity(0.1))
            .cornerRadius(Radius.sm)

            Spacer()

            // Verify & Add Button - Full width primary CTA
            PrimaryButton(
                title: "Verify & Add",
                isLoading: isVerifying,
                isEnabled: isValid && !upiId.isEmpty
            ) {
                verifyAndAdd()
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.bottom, Spacing.xl)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
        .onAppear {
            // Auto-focus input after sheet animation
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isInputFocused = true
            }
        }
    }

    // MARK: - Computed Properties

    private var inputBorderColor: Color {
        if errorMessage != nil {
            return AppColors.error
        } else if isValid {
            return AppColors.success
        } else if isInputFocused {
            return AppColors.brand500
        } else {
            return AppColors.black400
        }
    }

    private var inputBorderWidth: CGFloat {
        (isInputFocused || isValid || errorMessage != nil) ? 2 : 1
    }

    // MARK: - Validation

    private func validateUPIId(_ value: String) {
        errorMessage = nil

        guard !value.isEmpty else {
            isValid = false
            return
        }

        // Must contain @
        if !value.contains("@") {
            errorMessage = "Enter a valid UPI ID (e.g., name@upi)"
            isValid = false
            return
        }

        // Check for valid VPA format: [a-zA-Z0-9._-]+@[a-zA-Z]+
        let pattern = "^[a-zA-Z0-9.\\-_]+@[a-zA-Z]+$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(value.startIndex..., in: value)

        isValid = regex?.firstMatch(in: value, options: [], range: range) != nil
        if !isValid && value.contains("@") {
            errorMessage = "Invalid UPI ID format"
        }
    }

    private func verifyAndAdd() {
        guard isValid else { return }
        isVerifying = true
        HapticManager.shared.mediumImpact()

        // Simulate verification delay (real implementation would call VPA verification API)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            isVerifying = false
            HapticManager.shared.success()
            onComplete(upiId)
            dismiss()
        }
    }
}

// MARK: - Add Credit Card View

/// Add Credit/Debit Card sheet with tokenization
/// Figma: node-id=41:8529
/// Specifications:
/// - Card number: 16 digits with space formatting
/// - Expiry: MM/YY format
/// - CVV: 3-4 digits (secure)
/// - Card type detection: Visa, Mastercard, Amex, RuPay
/// - Security badge: Green lock icon with message
struct AddCreditCardView: View {
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: CardField?

    @State private var cardNumber: String = ""
    @State private var expiryDate: String = ""
    @State private var cvv: String = ""
    @State private var cardholderName: String = ""
    @State private var isAdding = false
    @State private var errorMessage: String?
    @State private var detectedCardType: CardType = .unknown

    enum CardField: Hashable {
        case number, expiry, cvv, name
    }

    let onComplete: () -> Void

    private var isValid: Bool {
        let cleanedNumber = cardNumber.replacingOccurrences(of: " ", with: "")
        return cleanedNumber.count >= 15 &&
               cleanedNumber.count <= 16 &&
               expiryDate.count == 5 &&
               cvv.count >= 3 &&
               !cardholderName.trimmingCharacters(in: .whitespaces).isEmpty &&
               isLuhnValid(cleanedNumber) &&
               isExpiryValid(expiryDate)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Drag handle
                DragHandle()
                    .padding(.top, Spacing.md)
                    .padding(.bottom, Spacing.lg)
                    .frame(maxWidth: .infinity)

                // Title - Figma: 20px semibold white
                Text("Add Card")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.bottom, Spacing.lg)

                // Card Number Input
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Card Number")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.neutral500)

                    HStack(spacing: Spacing.sm) {
                        TextField("", text: $cardNumber)
                            .placeholder(when: cardNumber.isEmpty) {
                                Text("1234 5678 9012 3456")
                                    .foregroundColor(AppColors.black300)
                            }
                            .font(.system(size: 16, design: .monospaced))
                            .foregroundColor(.white)
                            .keyboardType(.numberPad)
                            .focused($focusedField, equals: .number)
                            .onChange(of: cardNumber) { _, newValue in
                                cardNumber = formatCardNumber(newValue)
                                detectCardType(cardNumber)
                                // Auto-advance to expiry
                                if cardNumber.count == 19 {
                                    focusedField = .expiry
                                }
                            }

                        // Card type icon
                        cardTypeIcon
                    }
                    .padding(Spacing.md)
                    .background(AppColors.black500)
                    .cornerRadius(Radius.input)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.input)
                            .stroke(
                                focusedField == .number ? AppColors.brand500 : AppColors.black400,
                                lineWidth: focusedField == .number ? 2 : 1
                            )
                    )
                }
                .padding(.bottom, Spacing.md)

                // Expiry and CVV Row
                HStack(spacing: Spacing.md) {
                    // Expiry Date
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text("Expiry")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppColors.neutral500)

                        TextField("", text: $expiryDate)
                            .placeholder(when: expiryDate.isEmpty) {
                                Text("MM/YY")
                                    .foregroundColor(AppColors.black300)
                            }
                            .font(.system(size: 16, design: .monospaced))
                            .foregroundColor(.white)
                            .keyboardType(.numberPad)
                            .focused($focusedField, equals: .expiry)
                            .padding(Spacing.md)
                            .background(AppColors.black500)
                            .cornerRadius(Radius.input)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.input)
                                    .stroke(
                                        focusedField == .expiry ? AppColors.brand500 : AppColors.black400,
                                        lineWidth: focusedField == .expiry ? 2 : 1
                                    )
                            )
                            .onChange(of: expiryDate) { _, newValue in
                                expiryDate = formatExpiryDate(newValue)
                                if expiryDate.count == 5 {
                                    focusedField = .cvv
                                }
                            }
                    }

                    // CVV
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text("CVV")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppColors.neutral500)

                        SecureField("", text: $cvv)
                            .placeholder(when: cvv.isEmpty) {
                                Text(detectedCardType == .amex ? "1234" : "123")
                                    .foregroundColor(AppColors.black300)
                            }
                            .font(.system(size: 16, design: .monospaced))
                            .foregroundColor(.white)
                            .keyboardType(.numberPad)
                            .focused($focusedField, equals: .cvv)
                            .padding(Spacing.md)
                            .background(AppColors.black500)
                            .cornerRadius(Radius.input)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.input)
                                    .stroke(
                                        focusedField == .cvv ? AppColors.brand500 : AppColors.black400,
                                        lineWidth: focusedField == .cvv ? 2 : 1
                                    )
                            )
                            .onChange(of: cvv) { _, newValue in
                                let maxLength = detectedCardType == .amex ? 4 : 3
                                cvv = String(newValue.prefix(maxLength))
                                if cvv.count == maxLength {
                                    focusedField = .name
                                }
                            }
                    }
                }
                .padding(.bottom, Spacing.md)

                // Cardholder Name
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Cardholder Name")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.neutral500)

                    TextField("", text: $cardholderName)
                        .placeholder(when: cardholderName.isEmpty) {
                            Text("Name on card")
                                .foregroundColor(AppColors.black300)
                        }
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                        .textInputAutocapitalization(.words)
                        .focused($focusedField, equals: .name)
                        .padding(Spacing.md)
                        .background(AppColors.black500)
                        .cornerRadius(Radius.input)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.input)
                                .stroke(
                                    focusedField == .name ? AppColors.brand500 : AppColors.black400,
                                    lineWidth: focusedField == .name ? 2 : 1
                                )
                        )
                }
                .padding(.bottom, Spacing.lg)

                // Security Badge - Figma: Green background with lock icon
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 18))
                        .foregroundColor(AppColors.success)

                    Text("Your card details are encrypted and secure")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(AppColors.neutral500)
                }
                .padding(Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppColors.success.opacity(0.1))
                .cornerRadius(Radius.sm)
                .padding(.bottom, Spacing.md)

                // Error message
                if let error = errorMessage {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.error)
                        Text(error)
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.error)
                    }
                    .padding(.bottom, Spacing.md)
                }

                Spacer()
                    .frame(height: Spacing.lg)

                // Add Button
                PrimaryButton(
                    title: "Add Card",
                    isLoading: isAdding,
                    isEnabled: isValid
                ) {
                    addCard()
                }
            }
            .padding(.horizontal, Spacing.screenHorizontalCompact)
            .padding(.bottom, Spacing.xl)
        }
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                focusedField = .number
            }
        }
    }

    // MARK: - Card Type Icon

    @ViewBuilder
    private var cardTypeIcon: some View {
        Group {
            switch detectedCardType {
            case .visa:
                Text("VISA")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(hex: "1A1F71"))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.white)
                    .cornerRadius(3)
            case .mastercard:
                HStack(spacing: -6) {
                    Circle()
                        .fill(Color(hex: "EB001B"))
                        .frame(width: 18, height: 18)
                    Circle()
                        .fill(Color(hex: "F79E1B"))
                        .frame(width: 18, height: 18)
                }
            case .amex:
                Text("AMEX")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color(hex: "006FCF"))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 3)
                    .background(Color.white)
                    .cornerRadius(3)
            case .rupay:
                Text("RuPay")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color(hex: "097B3A"))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 3)
                    .background(Color.white)
                    .cornerRadius(3)
            case .unknown:
                Image(systemName: "creditcard")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.neutral500)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: detectedCardType)
    }

    // MARK: - Card Formatting

    private func formatCardNumber(_ value: String) -> String {
        let cleaned = value.replacingOccurrences(of: " ", with: "").filter { $0.isNumber }
        let limited = String(cleaned.prefix(16))
        var formatted = ""
        for (index, char) in limited.enumerated() {
            if index > 0 && index % 4 == 0 {
                formatted += " "
            }
            formatted += String(char)
        }
        return formatted
    }

    private func formatExpiryDate(_ value: String) -> String {
        let cleaned = value.replacingOccurrences(of: "/", with: "").filter { $0.isNumber }
        let limited = String(cleaned.prefix(4))
        if limited.count > 2 {
            return String(limited.prefix(2)) + "/" + String(limited.suffix(limited.count - 2))
        }
        return limited
    }

    // MARK: - Card Type Detection

    private func detectCardType(_ number: String) {
        let cleaned = number.replacingOccurrences(of: " ", with: "")
        guard !cleaned.isEmpty else {
            detectedCardType = .unknown
            return
        }

        let firstDigit = String(cleaned.prefix(1))
        let firstTwo = String(cleaned.prefix(2))
        let firstFour = String(cleaned.prefix(4))

        // Visa: Starts with 4
        if firstDigit == "4" {
            detectedCardType = .visa
        }
        // Mastercard: Starts with 51-55 or 2221-2720
        else if let twoDigits = Int(firstTwo), (51...55).contains(twoDigits) {
            detectedCardType = .mastercard
        } else if let fourDigits = Int(firstFour), (2221...2720).contains(fourDigits) {
            detectedCardType = .mastercard
        }
        // Amex: Starts with 34, 37
        else if firstTwo == "34" || firstTwo == "37" {
            detectedCardType = .amex
        }
        // RuPay: Starts with 60, 65, 81, 82
        else if ["60", "65", "81", "82"].contains(firstTwo) {
            detectedCardType = .rupay
        }
        else {
            detectedCardType = .unknown
        }
    }

    // MARK: - Validation

    private func isLuhnValid(_ number: String) -> Bool {
        var sum = 0
        let reversedCharacters = number.reversed().map { String($0) }
        for (index, element) in reversedCharacters.enumerated() {
            guard let digit = Int(element) else { return false }
            if index % 2 == 1 {
                let doubled = digit * 2
                sum += doubled > 9 ? doubled - 9 : doubled
            } else {
                sum += digit
            }
        }
        return sum % 10 == 0
    }

    private func isExpiryValid(_ expiry: String) -> Bool {
        let components = expiry.split(separator: "/")
        guard components.count == 2,
              let month = Int(components[0]),
              let year = Int(components[1]) else {
            return false
        }

        guard (1...12).contains(month) else { return false }

        let currentYear = Calendar.current.component(.year, from: Date()) % 100
        let currentMonth = Calendar.current.component(.month, from: Date())

        if year < currentYear {
            return false
        } else if year == currentYear && month < currentMonth {
            return false
        }
        return true
    }

    private func addCard() {
        guard isValid else { return }
        isAdding = true
        HapticManager.shared.mediumImpact()

        // Simulate card tokenization (real implementation would use PayU SDK)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            isAdding = false
            HapticManager.shared.success()
            onComplete()
            dismiss()
        }
    }
}

// MARK: - Card Type Enum

enum CardType: Equatable {
    case visa
    case mastercard
    case amex
    case rupay
    case unknown
}

// MARK: - Add Net Banking View

/// Add Net Banking sheet with bank selection
/// Figma: node-id=41:9224
/// Specifications:
/// - Search bar with magnifying glass
/// - Popular banks grid/list
/// - Bank selection with radio buttons
/// - Alphabetical bank list for search results
struct AddNetBankingView: View {
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isSearchFocused: Bool

    @State private var selectedBank: Bank?
    @State private var searchText: String = ""

    let onComplete: (Bank) -> Void

    var filteredBanks: [Bank] {
        if searchText.isEmpty {
            return Bank.popularBanks
        }
        return Bank.allBanks.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Drag handle
            DragHandle()
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.lg)
                .frame(maxWidth: .infinity)

            // Title - Figma: 20px semibold white
            Text("Select Bank")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.white)
                .padding(.bottom, Spacing.lg)

            // Search Bar - Figma: Search input with icon
            HStack(spacing: Spacing.sm) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.neutral500)

                TextField("", text: $searchText)
                    .placeholder(when: searchText.isEmpty) {
                        Text("Search banks")
                            .foregroundColor(AppColors.black300)
                    }
                    .font(.system(size: 16))
                    .foregroundColor(.white)
                    .focused($isSearchFocused)

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                        HapticManager.shared.lightImpact()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }
            .padding(Spacing.md)
            .background(AppColors.black500)
            .cornerRadius(Radius.input)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.input)
                    .stroke(
                        isSearchFocused ? AppColors.brand500 : AppColors.black400,
                        lineWidth: isSearchFocused ? 2 : 1
                    )
            )
            .padding(.bottom, Spacing.lg)

            // Section Label
            if searchText.isEmpty {
                Text("Popular Banks")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.neutral500)
                    .padding(.bottom, Spacing.sm)
            } else if filteredBanks.isEmpty {
                // No results state
                VStack(spacing: Spacing.md) {
                    Image(systemName: "building.2.crop.circle")
                        .font(.system(size: 48))
                        .foregroundColor(AppColors.neutral500)

                    Text("No banks found")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(AppColors.neutral500)

                    Text("Try a different search term")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(AppColors.black300)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.xxl)
            }

            // Banks List
            ScrollView {
                LazyVStack(spacing: Spacing.xs) {
                    ForEach(filteredBanks) { bank in
                        BankRow(
                            bank: bank,
                            isSelected: selectedBank?.id == bank.id
                        ) {
                            HapticManager.shared.lightImpact()
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedBank = bank
                            }
                        }
                    }
                }
            }

            Spacer()
                .frame(height: Spacing.lg)

            // Continue Button
            PrimaryButton(
                title: "Continue",
                isEnabled: selectedBank != nil
            ) {
                if let bank = selectedBank {
                    HapticManager.shared.mediumImpact()
                    onComplete(bank)
                    dismiss()
                }
            }
        }
        .padding(.horizontal, Spacing.screenHorizontalCompact)
        .padding(.bottom, Spacing.xl)
        .background(AppColors.backgroundSecondary)
        .clipShape(RoundedCorner(radius: Radius.xl, corners: [.topLeft, .topRight]))
    }
}

// MARK: - Bank Row

/// Bank selection row with radio button
/// Figma: Radio button design with bank icon and name
struct BankRow: View {
    let bank: Bank
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.md) {
                // Bank Icon - Figma: 44x44 rounded square with shortcode
                ZStack {
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .fill(isSelected ? AppColors.brand500.opacity(0.2) : AppColors.black500)
                        .frame(width: 44, height: 44)

                    Text(bank.shortCode)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(isSelected ? AppColors.brand500 : AppColors.neutral500)
                }

                // Bank Name
                Text(bank.name)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)

                Spacer()

                // Radio button - Figma: 24x24, 2px stroke
                ZStack {
                    Circle()
                        .stroke(
                            isSelected ? AppColors.brand500 : AppColors.black400,
                            lineWidth: 2
                        )
                        .frame(width: 24, height: 24)

                    if isSelected {
                        Circle()
                            .fill(AppColors.brand500)
                            .frame(width: 14, height: 14)
                    }
                }
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(isSelected ? AppColors.brand500.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(
                        isSelected ? AppColors.brand500 : AppColors.black400,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Bank Model

struct Bank: Identifiable, Equatable {
    let id: String
    let name: String
    let shortCode: String
    let payuCode: String

    static let popularBanks: [Bank] = [
        Bank(id: "hdfc", name: "HDFC Bank", shortCode: "HDFC", payuCode: "HDFB"),
        Bank(id: "icici", name: "ICICI Bank", shortCode: "ICICI", payuCode: "ICIB"),
        Bank(id: "sbi", name: "State Bank of India", shortCode: "SBI", payuCode: "SBIB"),
        Bank(id: "axis", name: "Axis Bank", shortCode: "AXIS", payuCode: "UTIB"),
        Bank(id: "kotak", name: "Kotak Mahindra Bank", shortCode: "KMB", payuCode: "KKBK"),
        Bank(id: "yes", name: "Yes Bank", shortCode: "YES", payuCode: "YESB"),
        Bank(id: "idfc", name: "IDFC First Bank", shortCode: "IDFC", payuCode: "IDFB"),
        Bank(id: "bob", name: "Bank of Baroda", shortCode: "BOB", payuCode: "BARB"),
    ]

    static let allBanks: [Bank] = popularBanks + [
        Bank(id: "pnb", name: "Punjab National Bank", shortCode: "PNB", payuCode: "PUNB"),
        Bank(id: "canara", name: "Canara Bank", shortCode: "CB", payuCode: "CNRB"),
        Bank(id: "union", name: "Union Bank of India", shortCode: "UBI", payuCode: "UBIN"),
        Bank(id: "indian", name: "Indian Bank", shortCode: "IB", payuCode: "IDIB"),
        Bank(id: "indusind", name: "IndusInd Bank", shortCode: "IIB", payuCode: "INDB"),
        Bank(id: "federal", name: "Federal Bank", shortCode: "FB", payuCode: "FDRL"),
        Bank(id: "rbl", name: "RBL Bank", shortCode: "RBL", payuCode: "RATN"),
        Bank(id: "south", name: "South Indian Bank", shortCode: "SIB", payuCode: "SIBL"),
        Bank(id: "bandhan", name: "Bandhan Bank", shortCode: "BDB", payuCode: "BDBL"),
        Bank(id: "karnataka", name: "Karnataka Bank", shortCode: "KB", payuCode: "KARB"),
        Bank(id: "city", name: "City Union Bank", shortCode: "CUB", payuCode: "CIUB"),
        Bank(id: "dcb", name: "DCB Bank", shortCode: "DCB", payuCode: "DCBL"),
    ]
}

// MARK: - Placeholder Modifier

extension View {
    @ViewBuilder
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

// NOTE: RoundedCorner is defined in View+Extensions.swift

// MARK: - Previews

#Preview("Add UPI") {
    ZStack {
        Color.black.ignoresSafeArea()
        VStack {
            Spacer()
            AddUPIView { upiId in
                print("Added UPI: \(upiId)")
            }
            .frame(height: 400)
        }
    }
}

#Preview("Add Credit Card") {
    ZStack {
        Color.black.ignoresSafeArea()
        VStack {
            Spacer()
            AddCreditCardView {
                print("Card added")
            }
            .frame(height: 650)
        }
    }
}

#Preview("Add Net Banking") {
    ZStack {
        Color.black.ignoresSafeArea()
        VStack {
            Spacer()
            AddNetBankingView { bank in
                print("Selected bank: \(bank.name)")
            }
            .frame(height: 600)
        }
    }
}
