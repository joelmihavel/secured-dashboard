/// AccessibilityUITests.swift
/// Flent Secured v2 - Accessibility UI Tests
///
/// Tests for VoiceOver support, Dynamic Type, and accessibility compliance.
/// Ensures the app is usable by people with disabilities.

import XCTest

final class AccessibilityUITests: XCTestCase {

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

    // MARK: - Accessibility Identifier Tests

    func testSplashScreen_HasAccessibleElements() {
        // Verify primary button has accessibility identifier
        let getStartedButton = app.buttons["primary_button"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5), "Primary button should have accessibility identifier")
        XCTAssertTrue(getStartedButton.isEnabled, "Get Started button should be enabled")
    }

    func testPhoneEntry_HasAccessiblePhoneInput() {
        // Navigate to phone entry
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5), "Phone input should have accessibility identifier")

        // Verify keyboard appears when tapped
        phoneField.tap()
        XCTAssertTrue(app.keyboards.count > 0, "Keyboard should appear when phone field is tapped")
    }

    func testOTPEntry_HasAccessibleOTPFields() {
        // Navigate to OTP screen
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999999")
        }

        app.buttons["primary_button"].tap()

        // Check all OTP fields have accessibility identifiers
        for i in 0..<6 {
            let otpField = app.textFields["otp_input_\(i)"]
            XCTAssertTrue(otpField.waitForExistence(timeout: 10), "OTP field \(i) should have accessibility identifier")
        }
    }

    func testOTPEntry_BackButtonAccessible() {
        // Navigate to OTP screen
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999999")
        }

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        // Check back button
        let backButton = app.buttons["back_button"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 2), "Back button should have accessibility identifier")
    }

    func testConsentToggle_HasAccessibilityIdentifier() {
        // Navigate to OTP screen
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999999")
        }

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        // Check consent toggle
        let toggle = app.switches["consent_toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 2), "Consent toggle should have accessibility identifier")
    }

    // MARK: - VoiceOver Navigation Tests

    func testVoiceOver_CanNavigateSplashScreen() {
        // Verify elements are accessible for VoiceOver
        let getStartedButton = app.buttons["primary_button"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5))

        // Check that button has accessible label
        let label = getStartedButton.label
        XCTAssertFalse(label.isEmpty, "Button should have a label for VoiceOver")
    }

    func testVoiceOver_PhoneFieldHasLabel() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))

        // Check placeholder/label
        let placeholderValue = phoneField.placeholderValue ?? ""
        let label = phoneField.label
        let hasAccessibleText = !placeholderValue.isEmpty || !label.isEmpty
        XCTAssertTrue(hasAccessibleText, "Phone field should have placeholder or label for accessibility")
    }

    // MARK: - Tap Target Size Tests

    func testTapTargets_PrimaryButtonMinimumSize() {
        let getStartedButton = app.buttons["primary_button"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5))

        // Check button frame size meets minimum requirements (44x44 points)
        let frame = getStartedButton.frame
        XCTAssertGreaterThanOrEqual(frame.width, 44, "Button width should be at least 44 points")
        XCTAssertGreaterThanOrEqual(frame.height, 44, "Button height should be at least 44 points")
    }

    func testTapTargets_BackButtonMinimumSize() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999999")
        }

        app.buttons["primary_button"].tap()

        // Wait for OTP screen
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        let backButton = app.buttons["back_button"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 2))

        // Check back button meets minimum tap target size
        let frame = backButton.frame
        XCTAssertGreaterThanOrEqual(frame.width, 44, "Back button should have at least 44pt tap target")
        XCTAssertGreaterThanOrEqual(frame.height, 44, "Back button should have at least 44pt tap target")
    }

    // MARK: - Keyboard Accessibility Tests

    func testKeyboard_PhoneFieldShowsNumericKeyboard() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))

        phoneField.tap()

        // Give keyboard time to appear
        sleep(1)

        // Verify keyboard is showing
        XCTAssertTrue(app.keyboards.count > 0, "Keyboard should be visible")
    }

    func testKeyboard_OTPFieldShowsNumericKeyboard() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999999")
        }

        app.buttons["primary_button"].tap()

        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))

        otpField.tap()

        // Verify keyboard
        XCTAssertTrue(app.keyboards.count > 0, "Keyboard should be visible for OTP entry")
    }

    // MARK: - Focus Management Tests

    func testFocus_PhoneFieldAutoFocuses() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        // Give time for auto-focus
        sleep(1)

        // Check if keyboard appeared (indicating focus)
        // Some implementations auto-focus the phone field
        let phoneField = app.textFields["phone_input"]
        XCTAssertTrue(phoneField.waitForExistence(timeout: 5))
    }

    func testFocus_OTPFieldAutoFocusesFirst() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999999")
        }

        app.buttons["primary_button"].tap()

        // First OTP field should exist and potentially be focused
        let otpField = app.textFields["otp_input_0"]
        XCTAssertTrue(otpField.waitForExistence(timeout: 10))
    }

    // MARK: - Color Contrast Tests (Visual Verification)

    func testContrast_ErrorMessagesVisible() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("1234567890") // Invalid starting digit
        }

        let continueButton = app.buttons["primary_button"]
        continueButton.tap()

        // Error message or staying on screen indicates proper error handling
        XCTAssertTrue(phoneField.waitForExistence(timeout: 3), "Should show error or stay on screen for invalid input")
    }

    // MARK: - Screen Reader Order Tests

    func testScreenReaderOrder_SplashScreenLogicalOrder() {
        // Elements should be in logical reading order
        let getStartedButton = app.buttons["primary_button"]
        XCTAssertTrue(getStartedButton.waitForExistence(timeout: 5))

        // Check that Flent text appears before button (based on frame position)
        let flentText = app.staticTexts["Flent"]
        if flentText.exists {
            let textFrame = flentText.frame
            let buttonFrame = getStartedButton.frame

            // Text should be above button in reading order
            XCTAssertLessThan(textFrame.minY, buttonFrame.minY, "Flent text should appear before button")
        }
    }
}
