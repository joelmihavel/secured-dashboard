/// UserService.swift
/// Flent Secured v2 - User Service Implementation
///
/// Implements UserServiceProtocol using Supabase
/// Fetches user data, dashboard, and tenancy information

import Foundation
import Supabase

// MARK: - User Service

final class UserService: UserServiceProtocol {

    // MARK: - Properties

    private let supabase: SupabaseManager

    // MARK: - Initialization

    init(supabase: SupabaseManager = .shared) {
        self.supabase = supabase
    }

    // MARK: - UserServiceProtocol

    func getCurrentUser() async throws -> UserProfileData {
        let isAuth = await supabase.checkIsAuthenticated()
        print("[UserService] getCurrentUser - isAuthenticated: \(isAuth)")

        guard isAuth else {
            print("[UserService] getCurrentUser - NOT AUTHENTICATED, throwing error")
            throw UserServiceError.notAuthenticated
        }

        guard let userId = await supabase.getCurrentUserId() else {
            print("[UserService] getCurrentUser - No userId available")
            throw UserServiceError.notAuthenticated
        }

        print("[UserService] getCurrentUser - userId: \(userId.uuidString)")

        // Check if we have a valid session with access token - access client directly
        if let session = try? await supabase.client.auth.session {
            print("[UserService] getCurrentUser - session exists, accessToken prefix: \(String(session.accessToken.prefix(20)))...")
            print("[UserService] getCurrentUser - session user id: \(session.user.id)")
        } else {
            print("[UserService] getCurrentUser - WARNING: No session available!")
        }

        do {
            // Try to get existing user
            print("[UserService] getCurrentUser - Querying users table for id: \(userId.uuidString)")
            let users: [UserProfileData] = try await supabase.client
                .from("users")
                .select()
                .eq("id", value: userId.uuidString)
                .limit(1)
                .execute()
                .value

            print("[UserService] getCurrentUser - Query returned \(users.count) users")

            if let user = users.first {
                print("[UserService] getCurrentUser - Found user: \(user.id)")
                return user
            }

            // User doesn't exist in public.users table - create one
            // This happens when user signs up via Supabase Auth directly
            print("[UserService] getCurrentUser - User not found, attempting to create")
            let phone = await supabase.currentUser?.phone
            let newUser = try await createUserRecord(userId: userId, phone: phone)
            return newUser
        } catch {
            print("[UserService] getCurrentUser - ERROR: \(error)")
            throw mapError(error)
        }
    }

    /// Create user record in public.users table
    private func createUserRecord(userId: UUID, phone: String?) async throws -> UserProfileData {
        // Sanitize phone (remove +91 prefix for storage)
        let sanitizedPhone = phone?.hasPrefix("+91") == true
            ? String(phone!.dropFirst(3))
            : phone

        struct NewUserInsert: Encodable {
            let id: String
            let phone: String?
            let user_status: String
        }

        let newUser = NewUserInsert(
            id: userId.uuidString,
            phone: sanitizedPhone,
            user_status: "signed_up"
        )

        let users: [UserProfileData] = try await supabase.client
            .from("users")
            .insert(newUser)
            .select()
            .execute()
            .value

        guard let user = users.first else {
            throw UserServiceError.serverError("Failed to create user record")
        }

        print("[UserService] Created new user record: \(userId)")
        return user
    }

    func updateProfile(firstName: String?, lastName: String?) async throws -> UserProfileData {
        guard await supabase.checkIsAuthenticated() else {
            throw UserServiceError.notAuthenticated
        }

        guard let userId = await supabase.getCurrentUserId() else {
            throw UserServiceError.notAuthenticated
        }

        var updates: [String: String] = [:]
        if let firstName = firstName {
            updates["first_name"] = firstName
        }
        if let lastName = lastName {
            updates["last_name"] = lastName
        }

        do {
            let user: UserProfileData = try await supabase.client
                .from("users")
                .update(updates)
                .eq("id", value: userId.uuidString)
                .select()
                .single()
                .execute()
                .value

            return user
        } catch {
            throw mapError(error)
        }
    }

    func getDashboardData() async throws -> DashboardData {
        guard await supabase.checkIsAuthenticated() else {
            throw UserServiceError.notAuthenticated
        }

        do {
            // Call dashboard-data Edge Function
            let response: DashboardResponse = try await supabase.client.functions.invoke(
                "dashboard-data",
                options: FunctionInvokeOptions()
            )

            guard response.success, let data = response.data else {
                throw UserServiceError.serverError(response.error ?? "Failed to load dashboard")
            }

            return data
        } catch let error as UserServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    func getCurrentTenancy() async throws -> TenancyData? {
        guard await supabase.checkIsAuthenticated() else {
            throw UserServiceError.notAuthenticated
        }

        guard let userId = await supabase.getCurrentUserId() else {
            throw UserServiceError.notAuthenticated
        }

        do {
            let tenancies: [TenancyData] = try await supabase.client
                .from("tenancies")
                .select()
                .eq("user_id", value: userId.uuidString)
                .order("created_at", ascending: false)
                .limit(1)
                .execute()
                .value

            return tenancies.first
        } catch {
            throw mapError(error)
        }
    }

    func getWaitlistStatus() async throws -> WaitlistStatusData {
        guard await supabase.checkIsAuthenticated() else {
            throw UserServiceError.notAuthenticated
        }

        do {
            let response: WaitlistResponse = try await supabase.client.functions.invoke(
                "get-waitlist-status",
                options: FunctionInvokeOptions()
            )

            guard response.success, let data = response.data else {
                throw UserServiceError.serverError(response.error ?? "Failed to get waitlist status")
            }

            return data
        } catch let error as UserServiceError {
            throw error
        } catch {
            throw mapError(error)
        }
    }

    // MARK: - Private Helpers

    private func mapError(_ error: Error) -> UserServiceError {
        if let postgrestError = error as? PostgrestError {
            return .serverError(postgrestError.message)
        }

        if let functionError = error as? FunctionsError {
            switch functionError {
            case .httpError(_, let data):
                if let response = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                    return .serverError(response.error ?? "Unknown error")
                }
                return .serverError("Server error")
            case .relayError:
                return .networkError(error)
            }
        }

        return .networkError(error)
    }
}

// MARK: - Response Types

private struct DashboardResponse: Decodable {
    let success: Bool
    let data: DashboardData?
    let error: String?
}

private struct WaitlistResponse: Decodable {
    let success: Bool
    let data: WaitlistStatusData?
    let error: String?
}

private struct ErrorResponse: Decodable {
    let success: Bool
    let error: String?
}
