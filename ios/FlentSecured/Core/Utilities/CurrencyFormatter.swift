/// CurrencyFormatter.swift
/// Flent Secured v2 - Currency Formatting Utilities
///
/// Handles Indian Rupee formatting throughout the app

import Foundation

// MARK: - Currency Formatter

struct CurrencyFormatter {
    static let shared = CurrencyFormatter()

    private let formatter: NumberFormatter

    private init() {
        formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.currencyCode = "INR"
        formatter.locale = Locale(identifier: "en_IN")
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
    }

    // MARK: - Formatting

    /// Formats paise to rupees string "₹25,000"
    func format(paise: Int) -> String {
        let rupees = Double(paise) / 100.0
        return formatter.string(from: NSNumber(value: rupees)) ?? "₹\(Int(rupees))"
    }

    /// Formats rupees to string "₹25,000"
    func format(rupees: Double) -> String {
        formatter.string(from: NSNumber(value: rupees)) ?? "₹\(Int(rupees))"
    }

    /// Formats rupees to string "₹25,000"
    func format(rupees: Int) -> String {
        formatter.string(from: NSNumber(value: rupees)) ?? "₹\(rupees)"
    }

    /// Formats with decimal places for fees "₹250.50"
    func formatWithDecimals(paise: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "₹"
        formatter.locale = Locale(identifier: "en_IN")
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2

        let rupees = Double(paise) / 100.0
        return formatter.string(from: NSNumber(value: rupees)) ?? "₹\(rupees)"
    }

    /// Formats compact for large amounts "₹2.5L"
    func formatCompact(rupees: Int) -> String {
        if rupees >= 10_000_000 {
            let crores = Double(rupees) / 10_000_000.0
            return "₹\(String(format: "%.1f", crores))Cr"
        } else if rupees >= 100_000 {
            let lakhs = Double(rupees) / 100_000.0
            return "₹\(String(format: "%.1f", lakhs))L"
        } else if rupees >= 1000 {
            let thousands = Double(rupees) / 1000.0
            return "₹\(String(format: "%.1f", thousands))K"
        } else {
            return format(rupees: rupees)
        }
    }

    // MARK: - Parsing

    /// Parses currency string to paise
    func parseToPaise(_ string: String) -> Int? {
        let cleaned = string
            .replacingOccurrences(of: "₹", with: "")
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: " ", with: "")
            .trimmingCharacters(in: .whitespaces)

        guard let rupees = Double(cleaned) else { return nil }
        return Int(rupees * 100)
    }

    /// Parses currency string to rupees
    func parseToRupees(_ string: String) -> Int? {
        guard let paise = parseToPaise(string) else { return nil }
        return paise / 100
    }
}

// MARK: - Extensions

extension Int {
    /// Converts paise to formatted rupees string
    var formattedCurrency: String {
        CurrencyFormatter.shared.format(paise: self)
    }

    /// Converts rupees to formatted string
    var formattedRupees: String {
        CurrencyFormatter.shared.format(rupees: self)
    }
}

extension Double {
    /// Formats as currency
    var formattedCurrency: String {
        CurrencyFormatter.shared.format(rupees: self)
    }
}

// MARK: - Amount Display

struct AmountDisplay {
    let paise: Int

    var rupees: Int {
        paise / 100
    }

    var formatted: String {
        CurrencyFormatter.shared.format(paise: paise)
    }

    var formattedWithDecimals: String {
        CurrencyFormatter.shared.formatWithDecimals(paise: paise)
    }

    var compact: String {
        CurrencyFormatter.shared.formatCompact(rupees: rupees)
    }

    // Factory methods
    static func fromRupees(_ rupees: Int) -> AmountDisplay {
        AmountDisplay(paise: rupees * 100)
    }

    static func fromPaise(_ paise: Int) -> AmountDisplay {
        AmountDisplay(paise: paise)
    }
}
