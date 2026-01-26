/// SecureStorage.swift
/// Flent Secured v2 - Secure Keychain Storage
///
/// Wraps KeychainAccess for secure storage of sensitive data
/// Used for session tokens, user credentials, etc.
///
/// SECURITY: All sensitive data is stored in Keychain, not UserDefaults

import Foundation
import KeychainAccess

// MARK: - Secure Storage

final class SecureStorage {

    // MARK: - Singleton

    static let shared = SecureStorage()

    // MARK: - Keychain

    private let keychain: Keychain

    // MARK: - Keys

    private enum Keys {
        static let userId = "flent_user_id"
        static let accessToken = "flent_access_token"
        static let refreshToken = "flent_refresh_token"
        static let sessionExpiry = "flent_session_expiry"
    }

    // MARK: - Initialization

    private init() {
        keychain = Keychain(service: "app.flent.secured")
            .accessibility(.afterFirstUnlockThisDeviceOnly)
    }

    // MARK: - Session Management

    /// Session data structure
    struct Session {
        let userId: String
        let accessToken: String
        let refreshToken: String?
        let expiresAt: Date?
    }

    /// Save session to Keychain
    func saveSession(userId: String, accessToken: String, refreshToken: String? = nil, expiresAt: Date? = nil) {
        do {
            try keychain.set(userId, key: Keys.userId)
            try keychain.set(accessToken, key: Keys.accessToken)

            if let refreshToken = refreshToken {
                try keychain.set(refreshToken, key: Keys.refreshToken)
            }

            if let expiresAt = expiresAt {
                let timestamp = String(expiresAt.timeIntervalSince1970)
                try keychain.set(timestamp, key: Keys.sessionExpiry)
            }
        } catch {
            print("SecureStorage: Failed to save session - \(error)")
        }
    }

    /// Get stored session
    func getSession() -> Session? {
        do {
            guard let userId = try keychain.get(Keys.userId),
                  let accessToken = try keychain.get(Keys.accessToken) else {
                return nil
            }

            let refreshToken = try keychain.get(Keys.refreshToken)

            var expiresAt: Date?
            if let timestampString = try keychain.get(Keys.sessionExpiry),
               let timestamp = Double(timestampString) {
                expiresAt = Date(timeIntervalSince1970: timestamp)
            }

            return Session(
                userId: userId,
                accessToken: accessToken,
                refreshToken: refreshToken,
                expiresAt: expiresAt
            )
        } catch {
            print("SecureStorage: Failed to get session - \(error)")
            return nil
        }
    }

    /// Clear session from Keychain
    func clearSession() {
        do {
            try keychain.remove(Keys.userId)
            try keychain.remove(Keys.accessToken)
            try keychain.remove(Keys.refreshToken)
            try keychain.remove(Keys.sessionExpiry)
        } catch {
            print("SecureStorage: Failed to clear session - \(error)")
        }
    }

    /// Check if session is valid (not expired)
    func isSessionValid() -> Bool {
        guard let session = getSession() else { return false }

        if let expiresAt = session.expiresAt {
            return expiresAt > Date()
        }

        // If no expiry set, assume valid
        return true
    }

    /// Save user ID only (when OTP is verified but no full session yet)
    func saveUserId(_ userId: String) {
        do {
            try keychain.set(userId, key: Keys.userId)
        } catch {
            print("SecureStorage: Failed to save user ID - \(error)")
        }
    }

    /// Get stored user ID
    func getUserId() -> String? {
        do {
            return try keychain.get(Keys.userId)
        } catch {
            print("SecureStorage: Failed to get user ID - \(error)")
            return nil
        }
    }

    // MARK: - Generic Secure Storage

    /// Store a string value securely
    func set(_ value: String, forKey key: String) throws {
        try keychain.set(value, key: key)
    }

    /// Retrieve a string value
    func get(_ key: String) throws -> String? {
        try keychain.get(key)
    }

    /// Store data securely
    func setData(_ data: Data, forKey key: String) throws {
        try keychain.set(data, key: key)
    }

    /// Retrieve data
    func getData(_ key: String) throws -> Data? {
        try keychain.getData(key)
    }

    /// Remove a value
    func remove(_ key: String) throws {
        try keychain.remove(key)
    }

    /// Store with biometric protection
    func setWithBiometric(_ value: String, forKey key: String) throws {
        try keychain
            .accessibility(.whenPasscodeSetThisDeviceOnly, authenticationPolicy: .biometryAny)
            .set(value, key: key)
    }

    /// Retrieve with biometric authentication
    func getWithBiometric(_ key: String) throws -> String? {
        try keychain
            .accessibility(.whenPasscodeSetThisDeviceOnly, authenticationPolicy: .biometryAny)
            .get(key)
    }
}
