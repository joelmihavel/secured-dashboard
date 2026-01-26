/// SupabaseManager.swift
/// Flent Secured v2 - Supabase Client Manager
///
/// Singleton wrapper for Supabase Swift SDK
/// Handles client initialization, auth state, and realtime subscriptions
///
/// Usage:
/// ```swift
/// let client = SupabaseManager.shared.client
/// let user = SupabaseManager.shared.currentUser
/// ```

import Foundation
import Supabase

// MARK: - Supabase Manager

@MainActor
final class SupabaseManager: ObservableObject {

    // MARK: - Singleton

    static let shared = SupabaseManager()

    // MARK: - Client

    let client: SupabaseClient

    // MARK: - Published State

    @Published private(set) var currentUser: User?
    @Published private(set) var isAuthenticated: Bool = false

    // MARK: - Initialization

    private init() {
        // Initialize Supabase client
        client = SupabaseClient(
            supabaseURL: Configuration.supabaseURL,
            supabaseKey: Configuration.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    storage: KeychainAuthStorage(),
                    autoRefreshToken: true
                )
            )
        )

        // Setup auth state listener
        setupAuthListener()
    }

    // MARK: - Auth State Listener

    private func setupAuthListener() {
        Task {
            for await (event, session) in client.auth.authStateChanges {
                await handleAuthStateChange(event: event, session: session)
            }
        }
    }

    private func handleAuthStateChange(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .initialSession:
            if let session = session {
                currentUser = session.user
                isAuthenticated = true
                print("[SupabaseManager] Initial session restored")
            } else {
                currentUser = nil
                isAuthenticated = false
                print("[SupabaseManager] No initial session")
            }

        case .signedIn:
            if let session = session {
                currentUser = session.user
                isAuthenticated = true
                print("[SupabaseManager] User signed in: \(session.user.id)")
            }

        case .signedOut:
            currentUser = nil
            isAuthenticated = false
            print("[SupabaseManager] User signed out")

        case .tokenRefreshed:
            if let session = session {
                currentUser = session.user
                print("[SupabaseManager] Token refreshed")
            }

        case .userUpdated:
            if let session = session {
                currentUser = session.user
                print("[SupabaseManager] User updated")
            }

        case .passwordRecovery:
            print("[SupabaseManager] Password recovery event")

        case .mfaChallengeVerified:
            print("[SupabaseManager] MFA verified")

        case .userDeleted:
            currentUser = nil
            isAuthenticated = false
            print("[SupabaseManager] User deleted")

        @unknown default:
            print("[SupabaseManager] Unknown auth event: \(event)")
        }
    }

    // MARK: - Session

    /// Get current session
    var currentSession: Session? {
        get async {
            try? await client.auth.session
        }
    }

    /// Get current access token
    var accessToken: String? {
        get async {
            try? await client.auth.session.accessToken
        }
    }

    // MARK: - Sign Out

    func signOut() async throws {
        try await client.auth.signOut()
    }

    // MARK: - Thread-Safe Accessors

    /// Check if user is authenticated (thread-safe)
    nonisolated func checkIsAuthenticated() async -> Bool {
        await isAuthenticated
    }

    /// Get current user ID (thread-safe)
    nonisolated func getCurrentUserId() async -> UUID? {
        await currentUser?.id
    }
}

// MARK: - Keychain Auth Storage

/// Custom auth storage using Keychain for secure token persistence
final class KeychainAuthStorage: AuthLocalStorage {
    private let secureStorage = SecureStorage.shared
    private let key = "supabase_auth_session"

    func store(key: String, value: Data) throws {
        try secureStorage.setData(value, forKey: self.key)
    }

    func retrieve(key: String) throws -> Data? {
        try secureStorage.getData(self.key)
    }

    func remove(key: String) throws {
        try secureStorage.remove(self.key)
    }
}

// MARK: - Realtime Extensions

extension SupabaseManager {

    /// Subscribe to payment status updates
    func subscribeToPaymentStatus(paymentId: String) -> AsyncStream<PaymentStatusUpdate> {
        AsyncStream { continuation in
            let channelName = "payment-status-\(paymentId)"

            Task {
                let channel = client.realtimeV2.channel(channelName)

                let changes = channel.postgresChange(
                    AnyAction.self,
                    schema: "public",
                    table: "payments",
                    filter: "id=eq.\(paymentId)"
                )

                await channel.subscribe()

                for await change in changes {
                    if case .update(let action) = change {
                        if let statusString = action.record["status"]?.stringValue,
                           let status = PaymentStatus(rawValue: statusString) {
                            let update = PaymentStatusUpdate(
                                paymentId: paymentId,
                                status: status,
                                updatedAt: Date()
                            )
                            continuation.yield(update)

                            // Complete stream on terminal states
                            if status.isTerminal {
                                continuation.finish()
                                await channel.unsubscribe()
                            }
                        }
                    }
                }
            }

            continuation.onTermination = { _ in
                Task {
                    await self.client.realtimeV2.channel("payment-status-\(paymentId)").unsubscribe()
                }
            }
        }
    }

    /// Subscribe to tenancy updates
    func subscribeToTenancyUpdates(tenancyId: String) -> AsyncStream<TenancyUpdate> {
        AsyncStream { continuation in
            let channelName = "tenancy-\(tenancyId)"

            Task {
                let channel = client.realtimeV2.channel(channelName)

                let changes = channel.postgresChange(
                    AnyAction.self,
                    schema: "public",
                    table: "tenancies",
                    filter: "id=eq.\(tenancyId)"
                )

                await channel.subscribe()

                for await change in changes {
                    if case .update(let action) = change {
                        let update = TenancyUpdate(
                            tenancyId: tenancyId,
                            bankVerified: action.record["bank_verified"]?.boolValue ?? false,
                            utilityVerified: action.record["utility_verified"]?.boolValue ?? false,
                            landlordApproved: action.record["landlord_approved"]?.boolValue ?? false,
                            updatedAt: Date()
                        )
                        continuation.yield(update)
                    }
                }
            }

            continuation.onTermination = { _ in
                Task {
                    await self.client.realtimeV2.channel("tenancy-\(tenancyId)").unsubscribe()
                }
            }
        }
    }
}

// MARK: - Realtime Update Types

struct PaymentStatusUpdate {
    let paymentId: String
    let status: PaymentStatus
    let updatedAt: Date
}

struct TenancyUpdate {
    let tenancyId: String
    let bankVerified: Bool
    let utilityVerified: Bool
    let landlordApproved: Bool
    let updatedAt: Date
}

// Note: PaymentStatus is defined in Core/Models/PaymentStatus.swift
