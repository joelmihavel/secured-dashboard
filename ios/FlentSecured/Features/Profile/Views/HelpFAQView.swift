/// HelpFAQView.swift
/// Flent Secured v2 - Help & FAQ Screen
///
/// Displays FAQ sections with expandable items
/// - FAQ categories with expandable questions
/// - Contact support option
/// - Dark theme
///
/// Figma: Profile > Help & FAQ

import SwiftUI

struct HelpFAQView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var expandedQuestions: Set<String> = []
    @State private var selectedCategory: FAQCategory = .general

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern
            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Header with back button
                HStack {
                    Button {
                        coordinator.pop()
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(.white)
                    }

                    Spacer()
                }
                .padding(.top, Spacing.md)

                // Title - Split color
                VStack(alignment: .leading, spacing: 0) {
                    Text("Help &")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(.white)
                    Text("FAQ")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                // Category Selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(FAQCategory.allCases, id: \.self) { category in
                            FAQCategoryPill(
                                title: category.displayName,
                                isSelected: selectedCategory == category
                            ) {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    selectedCategory = category
                                }
                            }
                        }
                    }
                }

                // FAQ Content
                ScrollView {
                    VStack(spacing: Spacing.md) {
                        ForEach(selectedCategory.questions, id: \.id) { faq in
                            FAQItemView(
                                faq: faq,
                                isExpanded: expandedQuestions.contains(faq.id)
                            ) {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    if expandedQuestions.contains(faq.id) {
                                        expandedQuestions.remove(faq.id)
                                    } else {
                                        expandedQuestions.insert(faq.id)
                                    }
                                }
                            }
                        }

                        // Can't find answer section
                        VStack(spacing: Spacing.md) {
                            Divider()
                                .background(AppColors.black400)
                                .padding(.vertical, Spacing.md)

                            Text("Can't find what you're looking for?")
                                .font(Typography.bodyMd2)
                                .foregroundColor(AppColors.textSecondary)

                            // Contact Support Button
                            Button {
                                openSupportEmail()
                            } label: {
                                HStack(spacing: Spacing.sm) {
                                    Image(systemName: "envelope.fill")
                                        .font(.system(size: 18))
                                    Text("Contact Support")
                                        .font(Typography.button)
                                }
                                .foregroundColor(AppColors.brand500)
                                .frame(maxWidth: .infinity)
                                .padding(Spacing.md)
                                .background(AppColors.black500)
                                .cornerRadius(Radius.md)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.md)
                                        .stroke(AppColors.brand500, lineWidth: 1)
                                )
                            }

                            // WhatsApp Support Button
                            Button {
                                openWhatsAppSupport()
                            } label: {
                                HStack(spacing: Spacing.sm) {
                                    Image(systemName: "message.fill")
                                        .font(.system(size: 18))
                                    Text("Chat on WhatsApp")
                                        .font(Typography.button)
                                }
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(Spacing.md)
                                .background(Color(hex: "25D366"))
                                .cornerRadius(Radius.md)
                            }
                        }
                        .padding(.top, Spacing.md)
                        .padding(.bottom, Spacing.xl)
                    }
                }
            }
            .padding(.horizontal, Spacing.screenHorizontalCompact)
        }
        .navigationBarHidden(true)
    }

    // MARK: - Actions

    private func openSupportEmail() {
        guard let url = URL(string: "mailto:support@flent.in?subject=Help%20Request") else { return }
        UIApplication.shared.open(url)
    }

    private func openWhatsAppSupport() {
        // Replace with actual WhatsApp business number
        guard let url = URL(string: "https://wa.me/919876543210?text=Hi,%20I%20need%20help%20with%20Flent%20Secured") else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - FAQ Category Pill

struct FAQCategoryPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Typography.bodySmMedium)
                .foregroundColor(isSelected ? AppColors.black700 : AppColors.textSecondary)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(isSelected ? AppColors.brand500 : AppColors.black500)
                .cornerRadius(Radius.pill)
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.pill)
                        .stroke(isSelected ? AppColors.brand500 : AppColors.black400, lineWidth: 1)
                )
        }
    }
}

// MARK: - FAQ Item View

struct FAQItemView: View {
    let faq: FAQItem
    let isExpanded: Bool
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Question Header
            Button(action: action) {
                HStack(alignment: .top, spacing: Spacing.md) {
                    Text(faq.question)
                        .font(Typography.bodyMdMedium)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.leading)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.brand500)
                }
                .padding(Spacing.md)
            }

            // Answer (when expanded)
            if isExpanded {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Divider()
                        .background(AppColors.black400)

                    Text(faq.answer)
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                        .padding(Spacing.md)
                        .padding(.top, -Spacing.xs)
                }
            }
        }
        .background(AppColors.black500)
        .cornerRadius(Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: Radius.md)
                .stroke(AppColors.black400, lineWidth: 1)
        )
    }
}

// MARK: - FAQ Data Models

struct FAQItem: Identifiable {
    let id: String
    let question: String
    let answer: String
}

enum FAQCategory: String, CaseIterable {
    case general
    case payments
    case cashback
    case landlord
    case security

    var displayName: String {
        switch self {
        case .general: return "General"
        case .payments: return "Payments"
        case .cashback: return "Cashback"
        case .landlord: return "Landlord"
        case .security: return "Security"
        }
    }

    var questions: [FAQItem] {
        switch self {
        case .general:
            return [
                FAQItem(
                    id: "general-1",
                    question: "What is Flent Secured?",
                    answer: "Flent Secured is a rent payment platform that rewards you for paying rent on time. We help you build a positive payment history while earning cashback on every rent payment."
                ),
                FAQItem(
                    id: "general-2",
                    question: "How do I get started with Flent?",
                    answer: "Getting started is easy! Simply sign up with your phone number, upload your rental agreement, verify your address with a utility bill, and invite your landlord. Once verified, you can start making rent payments through Flent."
                ),
                FAQItem(
                    id: "general-3",
                    question: "Is Flent available in my city?",
                    answer: "Flent is currently available in major metropolitan cities across India. We're expanding rapidly! If you're on the waitlist, we'll notify you as soon as we launch in your area."
                ),
                FAQItem(
                    id: "general-4",
                    question: "What documents do I need to sign up?",
                    answer: "You'll need your rental agreement, a recent utility bill (electricity, gas, or water) for address verification, and your bank account details for payment."
                )
            ]

        case .payments:
            return [
                FAQItem(
                    id: "payment-1",
                    question: "How do I make a rent payment?",
                    answer: "Go to the home screen and tap 'Pay Rent'. Choose your payment method (UPI, Net Banking, or Credit Card), enter the amount, and confirm the payment. You'll receive a confirmation once the payment is successful."
                ),
                FAQItem(
                    id: "payment-2",
                    question: "What payment methods are supported?",
                    answer: "We support UPI (Google Pay, PhonePe, Paytm, etc.), Net Banking from all major banks, and Credit/Debit Cards. Payment methods available to you depend on your account status."
                ),
                FAQItem(
                    id: "payment-3",
                    question: "When will my landlord receive the payment?",
                    answer: "Payments are typically settled to your landlord's bank account within 1-2 business days. You can track the settlement status in your payment history."
                ),
                FAQItem(
                    id: "payment-4",
                    question: "What if my payment fails?",
                    answer: "If your payment fails, no amount is deducted from your account. You can retry the payment immediately. If money was deducted but payment shows failed, it will be automatically refunded within 5-7 business days."
                ),
                FAQItem(
                    id: "payment-5",
                    question: "Is there a fee for making payments?",
                    answer: "Flent charges a small convenience fee for processing payments. The fee varies based on your payment method and is always shown before you confirm the payment."
                )
            ]

        case .cashback:
            return [
                FAQItem(
                    id: "cashback-1",
                    question: "How does cashback work?",
                    answer: "You earn cashback on every on-time rent payment. Pay before the 7th of the month to earn maximum cashback. The cashback is credited to your Flent wallet and can be used for future rent payments."
                ),
                FAQItem(
                    id: "cashback-2",
                    question: "How much cashback can I earn?",
                    answer: "Cashback rates vary based on your payment history and account status. Regular on-time payers can earn up to 1% cashback on their rent payments. Special promotions may offer higher rates."
                ),
                FAQItem(
                    id: "cashback-3",
                    question: "When is my cashback credited?",
                    answer: "Cashback is credited to your Flent wallet once your payment is successfully settled to your landlord's account, typically within 2-3 business days."
                ),
                FAQItem(
                    id: "cashback-4",
                    question: "Can I withdraw my cashback?",
                    answer: "Currently, cashback can only be used to offset future rent payments through Flent. We're working on adding more redemption options in the future."
                )
            ]

        case .landlord:
            return [
                FAQItem(
                    id: "landlord-1",
                    question: "Why do I need to invite my landlord?",
                    answer: "Your landlord needs to verify your tenancy and provide their bank account details to receive rent payments. This ensures that payments go to the right person securely."
                ),
                FAQItem(
                    id: "landlord-2",
                    question: "What does my landlord need to do?",
                    answer: "Your landlord will receive an invitation link. They need to verify your tenancy details, add their bank account, and complete a simple KYC verification. The entire process takes less than 10 minutes."
                ),
                FAQItem(
                    id: "landlord-3",
                    question: "What if my landlord doesn't accept the invitation?",
                    answer: "You can resend the invitation or contact our support team for assistance. We can also help facilitate a conversation with your landlord to address any concerns they may have."
                ),
                FAQItem(
                    id: "landlord-4",
                    question: "Can I change my landlord?",
                    answer: "If you move to a new property or your landlord changes, contact our support team. We'll help you update your tenancy details and onboard the new landlord."
                )
            ]

        case .security:
            return [
                FAQItem(
                    id: "security-1",
                    question: "Is my data safe with Flent?",
                    answer: "Yes, we take security very seriously. All your data is encrypted using bank-grade security (256-bit SSL encryption). We never store your full bank account or card details on our servers."
                ),
                FAQItem(
                    id: "security-2",
                    question: "Who can see my payment information?",
                    answer: "Your payment information is only visible to you. Your landlord can only see that a payment was made, the amount, and the date. They cannot see your bank account or card details."
                ),
                FAQItem(
                    id: "security-3",
                    question: "What happens if there's unauthorized access to my account?",
                    answer: "If you suspect unauthorized access, immediately change your phone number linked to Flent and contact our support team. We have measures in place to detect and prevent fraudulent activity."
                ),
                FAQItem(
                    id: "security-4",
                    question: "How do I delete my account?",
                    answer: "You can request account deletion from the Profile section. Note that you'll need to have no pending payments or unsettled transactions. All your data will be permanently deleted within 30 days of the request."
                )
            ]
        }
    }
}

// MARK: - Preview

#Preview {
    HelpFAQView()
        .environment(AppCoordinator())
}
