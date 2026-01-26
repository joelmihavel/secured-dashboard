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
        guard await supabase.checkIsAuthenticated() else {
            throw UserServiceError.notAuthenticated
        }

        guard let userId = await supabase.getCurrentUserId() else {
            throw UserServiceError.notAuthenticated
        }

        do {
            let user: UserProfileData = try await supabase.client
                .from("users")
                .select()
                .eq("id", value: userId.uuidString)
                .single()
                .execute()
                .value

            return user
        } catch {
            throw mapError(error)
        }
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
