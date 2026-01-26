/// FlentSecuredTests.swift
/// Flent Secured v2 - Unit Tests

import Testing
@testable import Flent

@Suite("FlentSecured Tests")
struct FlentSecuredTests {

    @Test("App initializes correctly")
    func appInitialization() async {
        let appState = AppState()
        #expect(appState.isAuthenticated == false)
        #expect(appState.isInitialized == false)
    }

    @Test("User status transitions correctly")
    func userStatusTransitions() {
        let statuses: [UserStatus] = [.signedUp, .waitlisted, .qualified, .complete]

        for status in statuses {
            switch status {
            case .qualified, .complete:
                #expect(status.canAccessHome == true)
            default:
                #expect(status.canAccessHome == false)
            }
        }
    }

    @Test("Only COMPLETE users can use credit cards")
    func creditCardAccess() {
        #expect(UserStatus.qualified.canUseCreditCard == false)
        #expect(UserStatus.complete.canUseCreditCard == true)
    }
}
