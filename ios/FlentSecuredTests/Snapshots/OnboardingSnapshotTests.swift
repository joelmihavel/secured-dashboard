/// OnboardingSnapshotTests.swift
/// Flent Secured v2 - Onboarding Screen Snapshot Tests
///
/// Visual regression tests for onboarding flow screens

import XCTest
import SwiftUI
import SnapshotTesting
@testable import Flent

final class OnboardingSnapshotTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Set to true to record new snapshots, false to compare
        isRecording = false
    }

    // MARK: - Phone Entry

    func testPhoneEntryView_Empty() {
        let view = PhoneEntryView()
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "empty_state"
        )
    }

    // MARK: - OTP Verification

    func testOTPVerificationView_Empty() {
        let view = OTPVerificationView(phone: "+919876543210")
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "empty_otp"
        )
    }

    // MARK: - Waitlist

    func testWaitlistView() {
        let view = WaitlistView()
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "waitlist"
        )
    }
}
