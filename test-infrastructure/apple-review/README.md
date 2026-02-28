# Flent Secured - Apple Review Guide

## App Information

- **App Name**: Flent Secured
- **Bundle ID**: com.flent.secured
- **Platform**: iOS (React Native / Expo)

## Demo Account Login

| Field | Value |
|-------|-------|
| Phone Number | +91 99999 00001 |
| OTP Code | 123456 |

### Login Steps

1. Launch the app
2. Tap "Get Started" on the carousel screen
3. Enter phone number: **+91 99999 00001**
4. Tap "Send OTP"
5. Enter OTP: **123456**
6. You will be logged into a demo account with pre-loaded data

## What to Test

### Home Dashboard
- View rent payment summary card
- View upcoming payment due date and amount (Rs. 25,000)
- View cashback balance (Rs. 325)
- Scroll to see recent payment history (2 past payments)
- View payment stamps (on-time streak)

### Pay Rent
- Tap "Pay Rent" on the dashboard
- Enter rent amount or use the pre-filled amount
- Select any payment method (UPI, Card, or Netbanking)
- Confirm payment — the app completes a demo transaction (no real money is transferred)
- View the payment success screen with transaction details

### Download Receipt
- After a successful payment, tap "Download Receipt" on the success screen
- Or navigate to a past payment and tap the receipt icon
- A PDF receipt is generated and presented via the iOS share sheet

### Transactions
- Tap "Transactions" in the bottom navigation
- View list of past rent payments with amounts and dates
- Tap any transaction to see full details (amount, date, status, payment method)

### Profile
- Tap "Profile" in the bottom navigation
- View profile information (name, phone, email)
- View linked payment methods (UPI and card pre-loaded)
- View agreement details
- Access Terms & Conditions and Privacy Policy links

### Delete Account
- Navigate to Profile tab
- Scroll to the bottom
- Tap "Delete Account"
- Confirm deletion when prompted
- The account will be removed and you will return to the login screen

## Important Notes

- **Demo Mode**: This account uses a client-side demo mode. No real API calls or payment transactions are made. All data is simulated within the app.
- **Test Phone**: The phone number +91 99999 00001 activates demo mode. Any other phone number follows the real authentication flow.
- **OTP Code**: The fixed demo OTP code is 123456.
- **Payments**: All payment methods complete successfully in demo mode — no real money is charged.
- **Network**: The app does not require an internet connection when using the demo account.

## Contact

For any questions during the review process, contact: support@flent.in
