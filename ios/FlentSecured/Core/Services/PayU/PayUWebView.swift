/// PayUWebView.swift
/// Flent Secured v2 - PayU WebView Integration
///
/// WKWebView wrapper for PayU payment checkout
/// Handles form submission, callbacks, and navigation

import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#endif

// MARK: - PayU WebView

struct PayUWebView: UIViewRepresentable {
    let params: PayUParams
    let onSuccess: (String) -> Void
    let onFailure: (String, String?) -> Void
    let onCancel: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptEnabled = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.backgroundColor = UIColor(AppColors.backgroundPrimary)
        webView.isOpaque = false

        // Load PayU payment form
        let html = buildPayUForm()
        webView.loadHTMLString(html, baseURL: URL(string: params.baseURL))

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No updates needed
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onSuccess: onSuccess, onFailure: onFailure, onCancel: onCancel)
    }

    // MARK: - Build PayU Form

    private func buildPayUForm() -> String {
        """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
                body {
                    background-color: #0D0D0D;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    font-family: -apple-system, system-ui, sans-serif;
                }
                .loading {
                    color: #FFFFFF;
                    font-size: 16px;
                    text-align: center;
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid #333333;
                    border-top: 3px solid #FF6B35;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 16px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body onload="document.getElementById('payuForm').submit();">
            <div class="loading">
                <div class="spinner"></div>
                <p>Redirecting to payment gateway...</p>
            </div>
            <form id="payuForm" action="\(params.baseURL)/_payment" method="post" style="display:none;">
                <input type="hidden" name="key" value="\(params.key)" />
                <input type="hidden" name="txnid" value="\(params.txnid)" />
                <input type="hidden" name="amount" value="\(params.amount)" />
                <input type="hidden" name="productinfo" value="\(escapeHTML(params.productinfo))" />
                <input type="hidden" name="firstname" value="\(escapeHTML(params.firstname))" />
                <input type="hidden" name="email" value="\(params.email)" />
                <input type="hidden" name="phone" value="\(params.phone)" />
                <input type="hidden" name="surl" value="\(params.surl)" />
                <input type="hidden" name="furl" value="\(params.furl)" />
                <input type="hidden" name="hash" value="\(params.hash)" />
                \(params.udf1.map { "<input type=\"hidden\" name=\"udf1\" value=\"\(escapeHTML($0))\" />" } ?? "")
                \(params.udf2.map { "<input type=\"hidden\" name=\"udf2\" value=\"\(escapeHTML($0))\" />" } ?? "")
                \(params.udf3.map { "<input type=\"hidden\" name=\"udf3\" value=\"\(escapeHTML($0))\" />" } ?? "")
            </form>
        </body>
        </html>
        """
    }

    private func escapeHTML(_ string: String) -> String {
        string
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate {
        let onSuccess: (String) -> Void
        let onFailure: (String, String?) -> Void
        let onCancel: () -> Void

        private var hasHandledCallback = false

        init(
            onSuccess: @escaping (String) -> Void,
            onFailure: @escaping (String, String?) -> Void,
            onCancel: @escaping () -> Void
        ) {
            self.onSuccess = onSuccess
            self.onFailure = onFailure
            self.onCancel = onCancel
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            let urlString = url.absoluteString.lowercased()

            // Handle deep link callbacks (flent://)
            if url.scheme == "flent" {
                handleDeepLink(url)
                decisionHandler(.cancel)
                return
            }

            // Handle webhook callbacks (success/failure URL)
            if urlString.contains("/functions/v1/payment-webhook") ||
               urlString.contains("/payment/success") ||
               urlString.contains("/payment/failure") {
                handleWebhookCallback(url)
                decisionHandler(.cancel)
                return
            }

            // Handle UPI intent URLs
            if url.scheme == "upi" ||
               url.scheme == "gpay" ||
               url.scheme == "phonepe" ||
               url.scheme == "paytm" {
                handleUPIIntent(url)
                decisionHandler(.cancel)
                return
            }

            // Allow all other navigations
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            guard !hasHandledCallback else { return }

            let nsError = error as NSError
            // Ignore cancelled requests (user navigated away)
            if nsError.code == NSURLErrorCancelled { return }

            hasHandledCallback = true
            onFailure("", "Payment gateway error: \(error.localizedDescription)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            guard !hasHandledCallback else { return }

            let nsError = error as NSError
            // Ignore cancelled requests
            if nsError.code == NSURLErrorCancelled { return }

            hasHandledCallback = true
            onFailure("", "Failed to load payment gateway: \(error.localizedDescription)")
        }

        // MARK: - Callback Handlers

        private func handleDeepLink(_ url: URL) {
            guard !hasHandledCallback else { return }
            hasHandledCallback = true

            guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else {
                onFailure("", "Invalid callback URL")
                return
            }

            let path = components.path
            let txnId = components.queryItems?.first(where: { $0.name == "txnid" })?.value ?? ""
            let status = components.queryItems?.first(where: { $0.name == "status" })?.value ?? ""
            let errorMessage = components.queryItems?.first(where: { $0.name == "error_Message" })?.value

            if path.contains("success") || status.lowercased() == "success" {
                onSuccess(txnId)
            } else {
                onFailure(txnId, errorMessage ?? "Payment failed")
            }
        }

        private func handleWebhookCallback(_ url: URL) {
            guard !hasHandledCallback else { return }
            hasHandledCallback = true

            // The webhook has been called - payment status will be updated via Realtime
            // We just need to determine if it's success or failure from URL
            let urlString = url.absoluteString.lowercased()

            if urlString.contains("success") || urlString.contains("surl") {
                // Extract txnId from URL if available
                let components = URLComponents(url: url, resolvingAgainstBaseURL: true)
                let txnId = components?.queryItems?.first(where: { $0.name == "txnid" })?.value ?? ""
                onSuccess(txnId)
            } else {
                let components = URLComponents(url: url, resolvingAgainstBaseURL: true)
                let txnId = components?.queryItems?.first(where: { $0.name == "txnid" })?.value ?? ""
                let errorMessage = components?.queryItems?.first(where: { $0.name == "error_Message" })?.value
                onFailure(txnId, errorMessage)
            }
        }

        private func handleUPIIntent(_ url: URL) {
            // Open UPI app
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:]) { success in
                    if !success {
                        // UPI app not installed or failed to open
                        // Let user continue in WebView
                    }
                }
            }
        }
    }
}

// MARK: - PayU WebView Container

struct PayUWebViewContainer: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(\.dismiss) private var dismiss

    let params: PayUParams
    let paymentId: String
    let onComplete: (Bool, String?) -> Void

    @State private var isLoading = true
    @State private var showCancelAlert = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Button {
                        showCancelAlert = true
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(AppColors.textPrimary)
                            .frame(width: 44, height: 44)
                    }

                    Spacer()

                    Text("Payment")
                        .font(Typography.h5)
                        .foregroundColor(AppColors.textPrimary)

                    Spacer()

                    // Spacer for alignment
                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.horizontal, Spacing.md)
                .background(AppColors.backgroundSecondary)

                // WebView
                PayUWebView(
                    params: params,
                    onSuccess: { txnId in
                        onComplete(true, txnId)
                    },
                    onFailure: { txnId, error in
                        onComplete(false, error)
                    },
                    onCancel: {
                        dismiss()
                    }
                )
            }
        }
        .navigationBarHidden(true)
        .alert("Cancel Payment?", isPresented: $showCancelAlert) {
            Button("Continue Payment", role: .cancel) {}
            Button("Cancel", role: .destructive) {
                onComplete(false, "Payment cancelled by user")
            }
        } message: {
            Text("Are you sure you want to cancel this payment?")
        }
    }
}

// MARK: - Preview

#Preview {
    PayUWebViewContainer(
        params: PayUParams(
            key: "test_key",
            txnid: "test_txn_123",
            amount: "40000.00",
            productinfo: "Rent payment for January 2026",
            firstname: "Amit",
            email: "test@flent.app",
            phone: "9876543210",
            surl: "https://example.com/success",
            furl: "https://example.com/failure",
            hash: "test_hash",
            udf1: nil,
            udf2: nil,
            udf3: nil
        ),
        paymentId: "test-payment-123",
        onComplete: { success, error in
            print("Payment completed: \(success), error: \(error ?? "none")")
        }
    )
    .environment(AppCoordinator())
}
