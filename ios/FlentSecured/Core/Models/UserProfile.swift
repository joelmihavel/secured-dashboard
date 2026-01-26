/// UserProfile.swift
/// Flent Secured v2 - User Profile Model
///
/// Represents the authenticated user's profile data

import Foundation

// MARK: - User Profile

struct UserProfile: Equatable, Codable {
    let id: String
    var firstName: String?
    var lastName: String?
    var phone: String
    var email: String?
    var status: UserStatus
    var kycStatus: String?
    var createdAt: Date

    var fullName: String {
        [firstName, lastName]
            .compactMap { $0 }
            .joined(separator: " ")
    }

    /// Initials for avatar display
    var initials: String {
        let first = firstName?.first.map(String.init) ?? ""
        let last = lastName?.first.map(String.init) ?? ""
        return (first + last).uppercased()
    }
}
