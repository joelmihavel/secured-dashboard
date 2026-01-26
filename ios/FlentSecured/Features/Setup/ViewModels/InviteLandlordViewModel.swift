/// InviteLandlordViewModel.swift
/// Flent Secured v2 - Invite Landlord ViewModel
///
/// Manages landlord invitation flow
/// Handles SMS/WhatsApp invite sending
///
/// Figma: Setup / Invite Landlord

import Foundation
import Observation
import UIKit

// MARK: - Invite Landlord ViewModel

@Observable
final class InviteLandlordViewModel {

    // MARK: - State

    enum State {
        case idle
        case sending
        case sent
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var inviteResult: LandlordInviteResult?

    // MARK: - Form Fields

    var selectedChannel: InviteChannel = .sms

    // MARK: - Computed Properties

    var isSending: Bool {
        if case .sending = state { return true }
        return false
    }

    var isSent: Bool {
        if case .sent = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var canSend: Bool {
        !isSending
    }

    var inviteExpiresIn: String? {
        guard let result = inviteResult else { return nil }

        // expiresAt is a String in ISO8601 format
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let expiresDate = formatter.date(from: result.expiresAt) else {
            return nil
        }

        let relativeFormatter = RelativeDateTimeFormatter()
        relativeFormatter.unitsStyle = .full
        return relativeFormatter.localizedString(for: expiresDate, relativeTo: Date())
    }

    var inviteMessage: String? {
        inviteResult?.message
    }

    // MARK: - Dependencies

    private let tenancyId: String
    private let verificationService: VerificationServiceProtocol

    // MARK: - Initialization

    init(
        tenancyId: String,
        verificationService: VerificationServiceProtocol = AppEnvironment.shared.verificationService
    ) {
        self.tenancyId = tenancyId
        self.verificationService = verificationService
    }

    // MARK: - Actions

    /// Send landlord invite
    @MainActor
    func sendInvite() async -> Bool {
        guard canSend else { return false }

        state = .sending

        do {
            let result = try await verificationService.sendLandlordInvite(
                tenancyId: tenancyId,
                channel: selectedChannel
            )

            inviteResult = result
            state = .sent
            return true
        } catch let error as VerificationServiceError {
            state = .error(error.errorDescription ?? "Failed to send invite")
            return false
        } catch {
            state = .error("Unable to send invite. Please try again.")
            return false
        }
    }

    /// Resend invite
    @MainActor
    func resendInvite() async -> Bool {
        state = .idle
        return await sendInvite()
    }

    /// Reset form
    func reset() {
        state = .idle
        inviteResult = nil
    }

    /// Clear error
    func clearError() {
        if case .error = state {
            state = .idle
        }
    }

    /// Go back to form from sent state
    func editInvite() {
        state = .idle
    }

    /// Get shareable invite link URL
    func shareInviteLink() -> URL? {
        guard let result = inviteResult,
              let inviteLink = result.inviteLink else {
            return nil
        }
        return URL(string: inviteLink)
    }

    /// Copy invite link to clipboard
    func copyInviteLink() {
        guard let result = inviteResult,
              let inviteLink = result.inviteLink else {
            return
        }
        UIPasteboard.general.string = inviteLink
    }
}

// MARK: - Preview Helpers

extension InviteLandlordViewModel {
    static var preview: InviteLandlordViewModel {
        InviteLandlordViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
    }

    static var previewSending: InviteLandlordViewModel {
        let vm = InviteLandlordViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
        vm.state = .sending
        return vm
    }

    static var previewSent: InviteLandlordViewModel {
        let vm = InviteLandlordViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
        vm.inviteResult = LandlordInviteResult(
            inviteId: "invite-123",
            status: "sent",
            sentVia: "sms",
            expiresAt: ISO8601DateFormatter().string(from: Date().addingTimeInterval(7 * 24 * 60 * 60)),
            message: "Invite sent successfully",
            inviteLink: "https://app.flent.in/invite/abc123"
        )
        vm.state = .sent
        return vm
    }

    static var previewError: InviteLandlordViewModel {
        let vm = InviteLandlordViewModel(
            tenancyId: "test-tenancy",
            verificationService: MockVerificationService()
        )
        vm.state = .error("Failed to send invite")
        return vm
    }
}
