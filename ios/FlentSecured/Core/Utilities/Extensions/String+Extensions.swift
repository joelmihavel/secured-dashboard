/// String+Extensions.swift
/// Flent Secured v2 - String Extensions
///
/// String validation, formatting, and manipulation utilities

import Foundation

extension String {
    // MARK: - Validation

    /// Validates Indian phone number (10 digits)
    var isValidIndianPhone: Bool {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        return cleaned.count == 10 && cleaned.first != "0"
    }

    /// Validates email format
    var isValidEmail: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let predicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return predicate.evaluate(with: self)
    }

    /// Validates IFSC code (4 letters + 0 + 6 alphanumeric)
    var isValidIFSC: Bool {
        let ifscRegex = "^[A-Z]{4}0[A-Z0-9]{6}$"
        let predicate = NSPredicate(format: "SELF MATCHES %@", ifscRegex)
        return predicate.evaluate(with: self.uppercased())
    }

    /// Validates bank account number (9-18 digits)
    var isValidBankAccount: Bool {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        return cleaned.count >= 9 && cleaned.count <= 18
    }

    /// Validates OTP (6 digits)
    var isValidOTP: Bool {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        return cleaned.count == 6
    }

    /// Validates PAN card number
    var isValidPAN: Bool {
        let panRegex = "^[A-Z]{5}[0-9]{4}[A-Z]$"
        let predicate = NSPredicate(format: "SELF MATCHES %@", panRegex)
        return predicate.evaluate(with: self.uppercased())
    }

    // MARK: - Formatting

    /// Formats phone number as "98765 43210"
    var formattedPhone: String {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        guard cleaned.count == 10 else { return self }
        let index = cleaned.index(cleaned.startIndex, offsetBy: 5)
        return "\(cleaned[..<index]) \(cleaned[index...])"
    }

    /// Formats phone with country code "+91 98765 43210"
    var formattedPhoneWithCode: String {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        guard cleaned.count == 10 else { return self }
        let index = cleaned.index(cleaned.startIndex, offsetBy: 5)
        return "+91 \(cleaned[..<index]) \(cleaned[index...])"
    }

    /// Masks phone number "******3210"
    var maskedPhone: String {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        guard cleaned.count >= 4 else { return "****" }
        let lastFour = cleaned.suffix(4)
        return "******\(lastFour)"
    }

    /// Masks bank account "XXXXX0123"
    var maskedBankAccount: String {
        let cleaned = self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
        guard cleaned.count >= 4 else { return "****" }
        let lastFour = cleaned.suffix(4)
        return "XXXXX\(lastFour)"
    }

    /// Formats IFSC code (uppercase)
    var formattedIFSC: String {
        self.uppercased()
    }

    // MARK: - Trimming

    /// Trims whitespace and newlines
    var trimmed: String {
        self.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Removes all whitespace
    var withoutSpaces: String {
        self.replacingOccurrences(of: " ", with: "")
    }

    /// Only digits
    var digitsOnly: String {
        self.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
    }

    // MARK: - Utilities

    /// Check if string is empty after trimming
    var isBlank: Bool {
        self.trimmed.isEmpty
    }

    /// Check if string is not empty after trimming
    var isNotBlank: Bool {
        !isBlank
    }

    /// Returns nil if blank, otherwise returns trimmed string
    var nilIfBlank: String? {
        isBlank ? nil : trimmed
    }

    /// Capitalizes first letter only
    var capitalizedFirst: String {
        guard let first = self.first else { return self }
        return first.uppercased() + self.dropFirst()
    }

    /// Converts camelCase to Title Case
    var camelCaseToTitleCase: String {
        self.replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression)
            .capitalized
    }

    // MARK: - Localization

    /// Returns localized string
    var localized: String {
        NSLocalizedString(self, comment: "")
    }

    /// Returns localized string with arguments
    func localized(with arguments: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: arguments)
    }
}

// MARK: - Optional String Extensions

extension Optional where Wrapped == String {
    /// Returns true if nil or blank
    var isNilOrBlank: Bool {
        self?.isBlank ?? true
    }

    /// Returns true if not nil and not blank
    var isNotNilOrBlank: Bool {
        !isNilOrBlank
    }

    /// Returns empty string if nil
    var orEmpty: String {
        self ?? ""
    }
}
