/// Date+Extensions.swift
/// Flent Secured v2 - Date Extensions
///
/// Date formatting and manipulation utilities

import Foundation

extension Date {
    // MARK: - Formatters (Cached for Performance)

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_IN")
        return formatter
    }()

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "en_IN")
        formatter.unitsStyle = .full
        return formatter
    }()

    // MARK: - Formatting

    /// Returns date in "Jan 26, 2026" format
    var formattedDate: String {
        Self.dateFormatter.dateFormat = "MMM d, yyyy"
        return Self.dateFormatter.string(from: self)
    }

    /// Returns date in "January 2026" format
    var monthYear: String {
        Self.dateFormatter.dateFormat = "MMMM yyyy"
        return Self.dateFormatter.string(from: self)
    }

    /// Returns date in "Jan 2026" format
    var shortMonthYear: String {
        Self.dateFormatter.dateFormat = "MMM yyyy"
        return Self.dateFormatter.string(from: self)
    }

    /// Returns date in "26 Jan" format
    var dayMonth: String {
        Self.dateFormatter.dateFormat = "d MMM"
        return Self.dateFormatter.string(from: self)
    }

    /// Returns time in "10:30 AM" format
    var formattedTime: String {
        Self.dateFormatter.dateFormat = "h:mm a"
        return Self.dateFormatter.string(from: self)
    }

    /// Returns full datetime "Jan 26, 2026 at 10:30 AM"
    var formattedDateTime: String {
        Self.dateFormatter.dateFormat = "MMM d, yyyy 'at' h:mm a"
        return Self.dateFormatter.string(from: self)
    }

    /// Returns ISO8601 string for API requests
    var iso8601String: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: self)
    }

    /// Returns rent month format "2026-01"
    var rentMonthString: String {
        Self.dateFormatter.dateFormat = "yyyy-MM"
        return Self.dateFormatter.string(from: self)
    }

    // MARK: - Relative Formatting

    /// Returns relative time like "2 days ago" or "in 3 days"
    var relativeString: String {
        Self.relativeFormatter.localizedString(for: self, relativeTo: Date())
    }

    // MARK: - Components

    var day: Int {
        Calendar.current.component(.day, from: self)
    }

    var month: Int {
        Calendar.current.component(.month, from: self)
    }

    var year: Int {
        Calendar.current.component(.year, from: self)
    }

    var monthName: String {
        Self.dateFormatter.dateFormat = "MMMM"
        return Self.dateFormatter.string(from: self)
    }

    var shortMonthName: String {
        Self.dateFormatter.dateFormat = "MMM"
        return Self.dateFormatter.string(from: self)
    }

    // MARK: - Calculations

    /// Returns the first day of the current month
    var startOfMonth: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: self)
        return calendar.date(from: components) ?? self
    }

    /// Returns the last day of the current month
    var endOfMonth: Date {
        let calendar = Calendar.current
        return calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) ?? self
    }

    /// Days until this date from today
    var daysFromToday: Int {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let target = calendar.startOfDay(for: self)
        return calendar.dateComponents([.day], from: today, to: target).day ?? 0
    }

    /// Check if date is today
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Check if date is in the past
    var isPast: Bool {
        self < Date()
    }

    /// Check if date is in the future
    var isFuture: Bool {
        self > Date()
    }

    /// Check if it's before the 7th of the month (cashback eligible)
    var isBeforeCashbackDeadline: Bool {
        day <= 7
    }

    // MARK: - Creation

    /// Create date from components
    static func from(day: Int, month: Int, year: Int) -> Date? {
        var components = DateComponents()
        components.day = day
        components.month = month
        components.year = year
        return Calendar.current.date(from: components)
    }

    /// Create date from rent month string "2026-01"
    static func fromRentMonth(_ string: String) -> Date? {
        dateFormatter.dateFormat = "yyyy-MM"
        return dateFormatter.date(from: string)
    }

    /// Create date from ISO8601 string
    static func fromISO8601(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string)
    }
}
