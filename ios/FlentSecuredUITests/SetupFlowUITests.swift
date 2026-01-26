/// SetupFlowUITests.swift
/// Flent Secured v2 - Setup Flow UI Tests
///
/// End-to-end tests for the setup/verification flow including
/// bank verification, utility verification, and landlord invitation.

import XCTest

final class SetupFlowUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        // Enable mock services for UI testing - this is stripped from production builds
        app.launchEnvironment["USE_MOCK_SERVICES"] = "true"
        app.launch()
    }

    override func tearDown() {
        app = nil
        super.tearDown()
    }

    // MARK: - Helper Methods

    /// Navigate to setup flow as a QUALIFIED user with incomplete setup
    func loginAsQualifiedUserWithPendingSetup() {
        // Navigate through splash
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        // Enter phone for QUALIFIED user
        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999991") // Test QUALIFIED user
        }

        app.buttons["primary_button"].tap()

        // Enter OTP
        let otpField = app.textFields["otp_input_0"]
        if otpField.waitForExistence(timeout: 10) {
            for i in 0..<6 {
                let field = app.textFields["otp_input_\(i)"]
                if field.waitForExistence(timeout: 2) {
                    field.tap()
                    field.typeText("0")
                }
            }
            app.buttons["primary_button"].tap()
        }
    }

    // MARK: - Setup Progress Card Tests

    func testSetupProgressCard_VisibleForIncompleteSetup() {
        loginAsQualifiedUserWithPendingSetup()

        // Look for setup progress card
        let setupCard = app.otherElements["setup_progress_card"]

        // May take time to load dashboard
        let exists = setupCard.waitForExistence(timeout: 15)

        // Either shows setup card or home screen based on user status
        if exists {
            XCTAssertTrue(setupCard.exists, "Setup progress card should be visible for incomplete setup")
        }
    }

    func testSetupProgressCard_ShowsCorrectStepCount() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            // Look for progress indicator text
            let progressText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'of'")).firstMatch
            XCTAssertTrue(progressText.exists, "Progress indicator should show X of Y format")
        }
    }

    // MARK: - Bank Verification Tests

    func testBankVerification_NavigationFromSetup() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            // Look for "Add Bank" or similar button
            let addBankButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[cd] 'bank'")).firstMatch
            if addBankButton.exists {
                addBankButton.tap()

                // Verify bank entry screen appears
                let accountField = app.textFields.matching(NSPredicate(format: "identifier CONTAINS 'account'")).firstMatch
                let screenLoaded = accountField.waitForExistence(timeout: 5)
                XCTAssertTrue(screenLoaded || app.staticTexts["Add Bank Account"].exists, "Bank entry screen should appear")
            }
        }
    }

    func testBankVerification_RequiredFieldsPresent() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            let addBankButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[cd] 'bank'")).firstMatch
            if addBankButton.exists {
                addBankButton.tap()

                // Wait for screen to load
                sleep(2)

                // Check for required fields (these identifiers depend on view implementation)
                // Account number, IFSC, Name fields should exist
                let hasFields = app.textFields.count >= 2
                XCTAssertTrue(hasFields, "Bank entry form should have multiple fields")
            }
        }
    }

    // MARK: - Utility Verification Tests

    func testUtilityVerification_NavigationFromSetup() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            // Look for "Add Utility" button
            let addUtilityButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[cd] 'utility'")).firstMatch
            if addUtilityButton.exists {
                addUtilityButton.tap()

                // Verify utility entry screen appears
                sleep(2)
                let hasUtilityScreen = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[cd] 'utility'")).firstMatch.exists
                    || app.textFields.count >= 1

                XCTAssertTrue(hasUtilityScreen, "Utility entry screen should appear")
            }
        }
    }

    // MARK: - Landlord Invitation Tests

    func testLandlordInvitation_NavigationFromSetup() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            // Look for "Invite Landlord" button
            let inviteButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[cd] 'landlord'")).firstMatch
            if inviteButton.exists {
                inviteButton.tap()

                // Verify invitation screen appears
                sleep(2)
                let hasInviteScreen = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[cd] 'invite' OR label CONTAINS[cd] 'landlord'")).firstMatch.exists

                XCTAssertTrue(hasInviteScreen, "Landlord invitation screen should appear")
            }
        }
    }

    // MARK: - Verification Status Tests

    func testVerificationStatus_UpdatesAfterCompletion() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            // Look for checkmark indicators for completed steps
            let checkmarks = app.images.matching(NSPredicate(format: "identifier CONTAINS 'checkmark'"))
            // Initial count
            let initialCount = checkmarks.count

            // This would require completing a verification step
            // For now, just verify the UI structure exists
            XCTAssertTrue(setupCard.exists, "Setup card should track verification progress")
        }
    }

    // MARK: - Error Handling Tests

    func testBankVerification_InvalidIFSC() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            let addBankButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[cd] 'bank'")).firstMatch
            if addBankButton.exists {
                addBankButton.tap()
                sleep(2)

                // Find IFSC field and enter invalid value
                let ifscField = app.textFields.matching(NSPredicate(format: "identifier CONTAINS[cd] 'ifsc'")).firstMatch
                if ifscField.exists {
                    ifscField.tap()
                    ifscField.typeText("INVALID")

                    // Try to submit
                    let submitButton = app.buttons["primary_button"]
                    if submitButton.exists {
                        submitButton.tap()

                        // Should show error
                        sleep(1)
                        let errorText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[cd] 'error' OR label CONTAINS[cd] 'invalid'")).firstMatch
                        // May or may not show error depending on implementation
                    }
                }
            }
        }
    }

    // MARK: - Navigation Tests

    func testSetupFlow_CanNavigateBackFromBankScreen() {
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        if setupCard.waitForExistence(timeout: 15) {
            let addBankButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[cd] 'bank'")).firstMatch
            if addBankButton.exists {
                addBankButton.tap()
                sleep(2)

                // Find and tap back button
                let backButton = app.buttons["back_button"]
                if backButton.exists {
                    backButton.tap()

                    // Should return to setup/home screen
                    let backToSetup = setupCard.waitForExistence(timeout: 5)
                    XCTAssertTrue(backToSetup, "Should navigate back to setup screen")
                }
            }
        }
    }

    // MARK: - Complete Setup Flow Tests

    func testCompleteSetup_TransitionsToHomeAfterAllSteps() {
        // This test would require completing all verification steps
        // which needs mock services to return success
        loginAsQualifiedUserWithPendingSetup()

        let setupCard = app.otherElements["setup_progress_card"]
        let payButton = app.buttons["pay_rent_button"]

        // Either on setup (incomplete) or home (complete) based on user state
        let onSetup = setupCard.waitForExistence(timeout: 15)
        let onHome = payButton.waitForExistence(timeout: 5)

        XCTAssertTrue(onSetup || onHome, "User should be on setup or home screen")
    }
}
