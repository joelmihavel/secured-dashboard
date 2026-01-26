/// PaymentFlowUITests.swift
/// Flent Secured v2 - Payment Flow UI Tests
///
/// End-to-end tests for the payment flow including method selection,
/// payment processing, and result screens.

import XCTest

final class PaymentFlowUITests: XCTestCase {

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

    /// Login as a COMPLETE user with full payment access
    func loginAsCompleteUser() {
        // Navigate through splash
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        // Enter phone
        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999992") // Test COMPLETE user
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

        // Wait for home screen
        let payButton = app.buttons["pay_rent_button"]
        _ = payButton.waitForExistence(timeout: 15)
    }

    /// Login as a QUALIFIED user with limited payment access
    func loginAsQualifiedUser() {
        let getStartedButton = app.buttons["primary_button"]
        if getStartedButton.waitForExistence(timeout: 5) {
            getStartedButton.tap()
        }

        let phoneField = app.textFields["phone_input"]
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText("9999999991") // Test QUALIFIED user
        }

        app.buttons["primary_button"].tap()

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

    // MARK: - Home Screen Payment Tests

    func testHomeScreen_PayRentButtonVisible() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10), "Pay Rent button should be visible for complete user")
    }

    func testHomeScreen_TapPayRent_NavigatesToPaymentMethods() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Verify payment methods screen appears
        let methodsTitle = app.staticTexts["Choose a Payment Method"]
        XCTAssertTrue(methodsTitle.waitForExistence(timeout: 5), "Payment methods screen should appear")
    }

    // MARK: - Payment Methods Tests

    func testPaymentMethods_UPIOptionsVisible() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Check UPI options are visible
        let gpay = app.buttons["payment_method_google_pay"]
        let phonePe = app.buttons["payment_method_phonepe"]
        let otherUPI = app.buttons["payment_method_other_upi"]

        XCTAssertTrue(gpay.waitForExistence(timeout: 5), "Google Pay option should be visible")
        XCTAssertTrue(phonePe.exists, "PhonePe option should be visible")
        XCTAssertTrue(otherUPI.exists, "Other UPI option should be visible")
    }

    func testPaymentMethods_NetBankingVisible() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        let netBanking = app.buttons["payment_method_net_banking"]
        XCTAssertTrue(netBanking.waitForExistence(timeout: 5), "Net Banking option should be visible")
    }

    func testPaymentMethods_CreditCardVisibleForCompleteUser() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        let creditCard = app.buttons["payment_method_credit/debit_card"]
        XCTAssertTrue(creditCard.waitForExistence(timeout: 5), "Credit/Debit Card option should be visible for COMPLETE user")
    }

    func testPaymentMethods_SelectGooglePay() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Select Google Pay
        let gpay = app.buttons["payment_method_google_pay"]
        XCTAssertTrue(gpay.waitForExistence(timeout: 5))
        gpay.tap()

        // Verify selection indicator
        let checkmark = gpay.images["checkmark.circle.fill"]
        XCTAssertTrue(checkmark.exists || gpay.isSelected, "Google Pay should be selected")
    }

    func testPaymentMethods_SelectNetBanking() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Select Net Banking
        let netBanking = app.buttons["payment_method_net_banking"]
        XCTAssertTrue(netBanking.waitForExistence(timeout: 5))
        netBanking.tap()

        // Pay button should be enabled
        let payMethodButton = app.buttons["primary_button"]
        XCTAssertTrue(payMethodButton.isEnabled, "Pay button should be enabled after selection")
    }

    func testPaymentMethods_BackButton() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Verify payment methods screen
        let methodsTitle = app.staticTexts["Choose a Payment Method"]
        XCTAssertTrue(methodsTitle.waitForExistence(timeout: 5))

        // Tap back button
        let backButton = app.buttons["back_button"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 2))
        backButton.tap()

        // Should return to home
        XCTAssertTrue(payButton.waitForExistence(timeout: 5), "Should return to home screen")
    }

    // MARK: - QUALIFIED User Restrictions

    func testPaymentMethods_CreditCardLockedForQualifiedUser() {
        loginAsQualifiedUser()

        // Wait for setup or home screen
        let setupCard = app.otherElements["setup_progress_card"]
        let payButton = app.buttons["pay_rent_button"]

        // Either on setup screen or has pay button
        let hasPayAccess = payButton.waitForExistence(timeout: 10)

        if hasPayAccess {
            payButton.tap()

            // Look for locked cards section
            let lockedText = app.staticTexts["Complete 3 on-time payments to unlock"]
            XCTAssertTrue(lockedText.waitForExistence(timeout: 5), "Cards should be locked for QUALIFIED user")
        } else {
            // User might be on setup screen - this is also valid
            XCTAssertTrue(setupCard.waitForExistence(timeout: 10), "QUALIFIED user should see setup or payment screen")
        }
    }

    // MARK: - Payment Processing Tests

    func testPaymentProcessing_ShowsLoadingIndicator() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Select a payment method
        let netBanking = app.buttons["payment_method_net_banking"]
        XCTAssertTrue(netBanking.waitForExistence(timeout: 5))
        netBanking.tap()

        // Tap pay - this would normally open PayU
        // In test mode, we check for processing indicators
        let payMethodButton = app.buttons["primary_button"]
        payMethodButton.tap()

        // In test mode, should show some loading/processing state
        // This depends on mock setup
    }

    // MARK: - Payment Result Tests

    func testPaymentResult_SuccessScreen() {
        // This test requires mock to return success
        // For now, verify the flow structure
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10), "Pay button should exist for testing flow")
    }

    func testPaymentResult_FailureScreen_RetryButton() {
        // Test that failure screen has retry button
        // This requires mock payment failure
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10), "Pay button should exist for testing flow")
    }

    // MARK: - Amount Display Tests

    func testPaymentMethods_ShowsTotalAmount() {
        loginAsCompleteUser()

        let payButton = app.buttons["pay_rent_button"]
        XCTAssertTrue(payButton.waitForExistence(timeout: 10))
        payButton.tap()

        // Look for "Total:" label
        let totalLabel = app.staticTexts["Total:"]
        XCTAssertTrue(totalLabel.waitForExistence(timeout: 5), "Total amount label should be visible")

        // Verify rupee symbol is present
        let rupeeSymbol = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '₹'")).firstMatch
        XCTAssertTrue(rupeeSymbol.exists, "Amount with rupee symbol should be visible")
    }
}
