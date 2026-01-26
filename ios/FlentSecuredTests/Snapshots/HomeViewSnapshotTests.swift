/// HomeViewSnapshotTests.swift
/// Flent Secured v2 - Home Screen Snapshot Tests
///
/// Visual regression tests for HomeView in all states

import XCTest
import SwiftUI
import SnapshotTesting
@testable import Flent

final class HomeViewSnapshotTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Set to true to record new snapshots, false to compare
        isRecording = false
    }

    // MARK: - Snapshot Tests

    func testHomeView_ZeroState() {
        let view = HomeView(state: .zeroState)
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "zero_state"
        )
    }

    func testHomeView_ActiveQualified() {
        let view = HomeView(state: .activeQualified)
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "active_qualified"
        )
    }

    func testHomeView_ActiveComplete() {
        let view = HomeView(state: .activeComplete)
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "active_complete"
        )
    }

    func testHomeView_LatePayment() {
        let view = HomeView(state: .latePayment)
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "late_payment"
        )
    }

    func testHomeView_PaidProcessing() {
        let view = HomeView(state: .paidThisMonth(settlementStatus: .processing))
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "paid_processing"
        )
    }

    func testHomeView_PaidComplete() {
        let view = HomeView(state: .paidThisMonth(settlementStatus: .completed))
            .environment(AppCoordinator())
            .environment(AppState())

        let hostingController = UIHostingController(rootView: view)
        hostingController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)

        assertSnapshot(
            of: hostingController,
            as: .image(on: .iPhone13Pro),
            named: "paid_complete"
        )
    }
}
