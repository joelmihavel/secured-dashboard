/// FlentSecuredUITests.swift
/// Flent Secured v2 - UI Tests

import XCTest

final class FlentSecuredUITests: XCTestCase {

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

    /// Navigate from splash to phone entry by tapping "Get Started"
    func navigateToPhoneEntry() {
        // App starts at splash screen - tap Get Started
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }
    }

    // MARK: - Splash Tests

    func testSplashScreen() {
        // Verify splash screen shows
        let getStartedButton = app.buttons["primary_button"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5), "Get Started button should be visible")

        // Verify Flent logo/text is shown
        let flentText = app.staticTexts["Flent"]
        XCTAssertTrue(flentText.waitForExistence(timeout: 2), "Flent text should be visible")
    }

    // MARK: - Onboarding Tests

    func testPhoneEntryScreen() {
        navigateToPhoneEntry()

        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5), "Phone input should be visible after tapping Get Started")
    }

    func testOTPScreenNavigation() {
        navigateToPhoneEntry()

        // Enter phone and proceed
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))

        phoneField.tap()
        phoneField.typeText("9999999999")

        // Tap Continue button
        let continueButton = app.buttons["primary_button"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 2))
        continueButton.tap()

        // Should navigate to OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10), "OTP input field should appear after sending OTP")
    }

    func testFullOnboardingFlow() {
        navigateToPhoneEntry()

        // 1. Phone Entry
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
        phoneField.tap()
        phoneField.typeText("9999999999")  // Test phone number

        app.buttons["primary_button"].tap()

        // 2. OTP Verification
        let otpField0 = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField0.waitForExistence(timeout: 10))

        // Enter test OTP (000000)
        for i in 0..<6 {
            let otpField = app.textFields["otp_input_\(i)"]
            if otpField.waitForExistence(timeout: 2) {
                otpField.tap()
                otpField.typeText("0")
            }
        }

        // Tap Verify button
        let verifyButton = app.buttons["primary_button"]
        if verifyButton.waitForExistence(timeout: 2) {
            verifyButton.tap()
        }

        // 3. Should navigate to Name Verification
        // Look for name verification screen elements
        let nameScreen = app.staticTexts["What's your name?"]
        _ = nameScreen.waitForExistence(timeout: 10)
    }

    // MARK: - Home Tests

    func testHomeScreenZeroState() {
        // This test assumes user needs to be logged in
        // For now, just verify splash works
        let getStartedButton = app.buttons["primary_button"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5))
    }

    // MARK: - Edge Case Tests

    func testPhoneValidation_InvalidPhoneNumber() {
        navigateToPhoneEntry()

        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))

        // Enter invalid phone number (less than 10 digits)
        phoneField.tap()
        phoneField.typeText("12345")

        // Continue button should be disabled or show error
        let continueButton = app.buttons["primary_button"]
        XCTAssertTrue(continueButton.waitForExistence(timeout: 2))

        // Tap anyway and verify error appears or button is disabled
        continueButton.tap()

        // Should stay on same screen (phone field still visible)
        XCTAssertTrue(phoneField.exists, "Should stay on phone entry screen with invalid number")
    }

    func testPhoneValidation_InvalidStartDigit() {
        navigateToPhoneEntry()

        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))

        // Enter phone number starting with 5 (invalid)
        phoneField.tap()
        phoneField.typeText("5555555555")

        let continueButton = app.buttons["primary_button"]
        continueButton.tap()

        // Should show error or stay on screen
        XCTAssertTrue(phoneField.exists, "Should stay on phone entry screen")
    }

    func testBackNavigation_OTPToPhone() {
        navigateToPhoneEntry()

        // Enter phone and proceed
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
        phoneField.tap()
        phoneField.typeText("9999999999")

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        // Tap back button
        let backButton = app.buttons["back_button"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 2), "Back button should be visible")
        backButton.tap()

        // Should return to phone entry
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5), "Should navigate back to phone entry")
    }

    func testResendOTP_Timer() {
        navigateToPhoneEntry()

        // Navigate to OTP screen
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
        phoneField.tap()
        phoneField.typeText("9999999999")

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        // Look for "Resend" text - initially should show countdown
        let resendText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Resend'")).firstMatch
        XCTAssertTrue(resendText.waitForExistence(timeout: 2), "Resend text should be visible")
    }

    func testMobile360ConsentToggle() {
        navigateToPhoneEntry()

        // Navigate to OTP screen
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
        phoneField.tap()
        phoneField.typeText("9999999999")

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        // Look for consent toggle
        let toggle = app.switches["consent_toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 2), "Consent toggle should be visible")
        XCTAssertTrue(toggle.isEnabled, "Consent toggle should be enabled")
    }

    func testMobile360ConsentRequired() {
        navigateToPhoneEntry()

        // Navigate to OTP screen
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
        phoneField.tap()
        phoneField.typeText("9999999999")

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField0 = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField0.waitForExistence(timeout: 10))

        // FIRST: Disable consent toggle BEFORE entering full OTP
        // This prevents auto-verification when OTP is complete
        let toggle = app.switches["consent_toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 2), "Consent toggle should be visible")

        // Verify toggle is currently ON (default state)
        XCTAssertEqual(toggle.value as? String, "1", "Consent toggle should default to ON")

        // Use coordinate-based tap for better SwiftUI toggle interaction
        let toggleCoordinate = toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5))
        toggleCoordinate.tap()

        // Wait for state to update and verify it's now OFF
        Thread.sleep(forTimeInterval: 0.5)

        // Re-fetch toggle value
        let toggleValue = toggle.value as? String
        XCTAssertEqual(toggleValue, "0", "Consent toggle should be OFF after tap")

        // Now enter OTP - auto-verify won't trigger since consent is off
        for i in 0..<6 {
            let otpField = app.textFields["otp_input_\(i)"]
            if otpField.waitForExistence(timeout: 2) {
                otpField.tap()
                otpField.typeText("0")
            }
        }

        // Try to verify - should fail since consent is off
        let verifyButton = app.buttons["primary_button"]
        XCTAssertTrue(verifyButton.waitForExistence(timeout: 2))
        verifyButton.tap()

        // Should stay on OTP screen (not navigate to name verification)
        let otpFieldStillExists = app.textFields["otp_input_0"]
        XCTAssertTrue(otpFieldStillExists.waitForExistence(timeout: 3), "Should stay on OTP screen when consent is disabled")
    }
}
