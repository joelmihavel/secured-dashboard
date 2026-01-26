/// PaymentViewSnapshotTests.swift
/// Flent Secured v2 - Payment Screen Snapshot Tests
///
/// Visual regression tests for payment flow screens

import XCTest
import SwiftUI
import SnapshotTesting
@testable import Flent

final class PaymentViewSnapshotTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Set to true to record new snapshots, false to compare
        isRecording = false
    }

    // MARK: - Payment Methods View

    func testPaymentMethodsView_CompleteUser() {
        let view = PaymentMethodsView(
            tenancyId: "test-tenancy",
            rentAmountPaise: 2500000, // ₹25,000
            userStatus: .complete
        )
        .environment(AppCoordinator())
        .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "complete_user_all_methods"
        )
    }

    func testPaymentMethodsView_QualifiedUser_RestrictedMethods() {
        let view = PaymentMethodsView(
            tenancyId: "test-tenancy",
            rentAmountPaise: 2500000,
            userStatus: .qualified
        )
        .environment(AppCoordinator())
        .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "qualified_user_restricted"
        )
    }

    // MARK: - Payment Result Views

    func testPaymentSuccessView() {
        let view = PaymentResultView(
            paymentId: "test-payment",
            success: true
        )
        .environment(AppCoordinator())
        .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "payment_success"
        )
    }

    func testPaymentFailureView() {
        let view = PaymentResultView(
            paymentId: "test-payment",
            success: false
        )
        .environment(AppCoordinator())
        .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "payment_failure"
        )
    }
}
