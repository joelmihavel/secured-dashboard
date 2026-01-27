/// PersonalDetailsView.swift
/// Flent Secured v2 - Personal Details Screen
///
/// Displays and allows editing of user's personal information
/// - First name, Last name, Phone, Email
/// - Edit capability for name/email
///
/// Figma: Profile > Personal Details

import SwiftUI

struct PersonalDetailsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PersonalDetailsViewModel()

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

                    if viewModel.isEditing {
                        Button("Cancel") {
                            viewModel.cancelEditing()
                        }
                        .font(Typography.bodyMdMedium)
                        .foregroundColor(AppColors.neutral500)
                    }
                }
                .padding(.top, Spacing.md)

                // Title - Split color
                VStack(alignment: .leading, spacing: 0) {
                    Text("Personal")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(.white)
                    Text("Details")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                if viewModel.isLoading {
                    Spacer()
                    ProgressView()
                        .tint(AppColors.brand500)
                        .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            // Personal Information Card
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("PERSONAL INFORMATION")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)
                                    .padding(.leading, Spacing.xs)

                                VStack(spacing: 0) {
                                    // First Name
                                    PersonalDetailRow(
                                        label: "First Name",
                                        value: viewModel.isEditing ? nil : viewModel.firstName,
                                        editableValue: viewModel.isEditing ? $viewModel.editFirstName : nil,
                                        placeholder: "Enter first name",
                                        isEditing: viewModel.isEditing
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    // Last Name
                                    PersonalDetailRow(
                                        label: "Last Name",
                                        value: viewModel.isEditing ? nil : viewModel.lastName,
                                        editableValue: viewModel.isEditing ? $viewModel.editLastName : nil,
                                        placeholder: "Enter last name",
                                        isEditing: viewModel.isEditing
                                    )
                                }
                                .background(AppColors.black500)
                                .cornerRadius(Radius.md)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.md)
                                        .stroke(AppColors.black400, lineWidth: 1)
                                )
                            }

                            // Contact Information Card
                            VStack(alignment: .leading, spacing: Spacing.md) {
                                Text("CONTACT INFORMATION")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(AppColors.neutral500)
                                    .padding(.leading, Spacing.xs)

                                VStack(spacing: 0) {
                                    // Phone (read-only)
                                    PersonalDetailRow(
                                        label: "Phone Number",
                                        value: viewModel.formattedPhone,
                                        isEditing: false,
                                        isReadOnly: true
                                    )

                                    Divider()
                                        .background(AppColors.black400)

                                    // Email
                                    PersonalDetailRow(
                                        label: "Email Address",
                                        value: viewModel.isEditing ? nil : viewModel.email,
                                        editableValue: viewModel.isEditing ? $viewModel.editEmail : nil,
                                        placeholder: "Enter email address",
                                        keyboardType: .emailAddress,
                                        isEditing: viewModel.isEditing
                                    )
                                }
                                .background(AppColors.black500)
                                .cornerRadius(Radius.md)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.md)
                                        .stroke(AppColors.black400, lineWidth: 1)
                                )
                            }

                            // Phone number note
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "info.circle")
                                    .font(.system(size: 14))
                                    .foregroundColor(AppColors.neutral500)
                                Text("Phone number cannot be changed. Contact support if needed.")
                                    .font(Typography.caption)
                                    .foregroundColor(AppColors.neutral500)
                            }
                            .padding(.top, Spacing.xs)

                            // Error message
                            if let error = viewModel.errorMessage {
                                HStack(spacing: Spacing.xs) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .foregroundColor(AppColors.error)
                                    Text(error)
                                        .font(Typography.bodySm)
                                        .foregroundColor(AppColors.error)
                                }
                                .padding(Spacing.md)
                                .background(AppColors.error.opacity(0.1))
                                .cornerRadius(Radius.sm)
                            }
                        }
                        .padding(.top, Spacing.md)
                    }

                    Spacer()

                    // Action Button
                    if viewModel.isEditing {
                        PrimaryButton(
                            title: viewModel.isSaving ? "Saving..." : "Save Changes",
                            isLoading: viewModel.isSaving,
                            isEnabled: viewModel.hasChanges && !viewModel.isSaving
                        ) {
                            Task {
                                let success = await viewModel.saveChanges()
                                if success {
                                    viewModel.isEditing = false
                                }
                            }
                        }
                    } else {
                        SecondaryButton(title: "Edit Details") {
                            viewModel.startEditing()
                        }
                    }

                    Spacer()
                        .frame(height: Spacing.md)
                }
            }
            .padding(.horizontal, Spacing.screenHorizontalCompact)
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadProfile()
        }
    }
}

// MARK: - Personal Detail Row

struct PersonalDetailRow: View {
    let label: String
    var value: String? = nil
    var editableValue: Binding<String>? = nil
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default
    var isEditing: Bool = false
    var isReadOnly: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppColors.neutral500)

            if isEditing, let binding = editableValue {
                TextField(placeholder, text: binding)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(.white)
                    .keyboardType(keyboardType)
                    .autocapitalization(keyboardType == .emailAddress ? .none : .words)
            } else {
                HStack {
                    Text(value ?? "-")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(isReadOnly ? AppColors.neutral500 : .white)

                    Spacer()

                    if isReadOnly {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }
        }
        .padding(Spacing.md)
    }
}

// MARK: - Personal Details ViewModel

@Observable
final class PersonalDetailsViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case loading
        case loaded
        case saving
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var firstName: String = ""
    private(set) var lastName: String = ""
    private(set) var phone: String = ""
    private(set) var email: String = ""

    var isEditing: Bool = false
    var editFirstName: String = ""
    var editLastName: String = ""
    var editEmail: String = ""

    // MARK: - Computed Properties

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var isSaving: Bool {
        if case .saving = state { return true }
        return false
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var formattedPhone: String {
        guard !phone.isEmpty else { return "-" }
        // Format: +91 98765 43210
        if phone.hasPrefix("+91") {
            let digits = String(phone.dropFirst(3))
            if digits.count == 10 {
                return "+91 \(digits.prefix(5)) \(digits.suffix(5))"
            }
        }
        return phone
    }

    var hasChanges: Bool {
        editFirstName != firstName ||
        editLastName != lastName ||
        editEmail != email
    }

    // MARK: - Dependencies

    private let userService: UserServiceProtocol

    // MARK: - Initialization

    init(userService: UserServiceProtocol = AppEnvironment.shared.userService) {
        self.userService = userService
    }

    // MARK: - Actions

    @MainActor
    func loadProfile() async {
        state = .loading

        do {
            let profile = try await userService.getCurrentUser()
            firstName = profile.firstName ?? ""
            lastName = profile.lastName ?? ""
            phone = profile.phone ?? ""
            email = profile.email ?? ""
            state = .loaded
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to load profile")
        } catch {
            state = .error("Unable to load profile. Please try again.")
        }
    }

    func startEditing() {
        editFirstName = firstName
        editLastName = lastName
        editEmail = email
        isEditing = true
    }

    func cancelEditing() {
        isEditing = false
        editFirstName = ""
        editLastName = ""
        editEmail = ""
    }

    @MainActor
    func saveChanges() async -> Bool {
        guard hasChanges else { return true }

        state = .saving

        do {
            let updatedProfile = try await userService.updateProfile(
                firstName: editFirstName.isEmpty ? nil : editFirstName,
                lastName: editLastName.isEmpty ? nil : editLastName
            )

            firstName = updatedProfile.firstName ?? ""
            lastName = updatedProfile.lastName ?? ""
            email = updatedProfile.email ?? ""

            state = .loaded
            return true
        } catch let error as UserServiceError {
            state = .error(error.errorDescription ?? "Failed to save changes")
            return false
        } catch {
            state = .error("Unable to save changes. Please try again.")
            return false
        }
    }
}

// MARK: - Preview

#Preview {
    PersonalDetailsView()
        .environment(AppCoordinator())
        .environment(AppState())
}
