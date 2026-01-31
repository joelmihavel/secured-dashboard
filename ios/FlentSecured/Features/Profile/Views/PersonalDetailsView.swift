/// PersonalDetailsView.swift
/// Flent Secured v2 - Personal Details Screen
///
/// Figma: 41:8880 - My Profile Edit Screen
///
/// Design Specifications from Figma:
/// - Header: "My" (white) "Profile" (brand500), 48px light
/// - Avatar: 80x80 with "Edit Picture" button (brand500 bg)
/// - Fields: User name, Email, City, Phone Number
/// - Field labels: 12px regular, neutral500
/// - Field values: 16px regular, white (editable) or gray (read-only)
/// - "edit" link on right side of editable fields
/// - Save Changes button at bottom

import SwiftUI

struct PersonalDetailsView: View {
    @Environment(AppCoordinator.self) private var coordinator
    @Environment(AppState.self) private var appState

    @State private var viewModel = PersonalDetailsViewModel()

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.lg) {
                // Header with back button
                HStack {
                    Button {
                        coordinator.pop()
                    } label: {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 24, height: 24)
                    }

                    Spacer()
                }
                .padding(.top, Spacing.md)

                // Title - Figma: "My" "Profile" 48px light
                VStack(alignment: .leading, spacing: 0) {
                    Text("My")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(.white)
                    Text("Profile")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(AppColors.brand500)
                }

                if viewModel.isLoading {
                    Spacer()
                    ProgressView()
                        .tint(AppColors.brand500)
                        .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: Spacing.lg) {
                            // Avatar Section - Figma: 80x80 avatar with Edit Picture button
                            HStack(spacing: Spacing.lg) {
                                // Avatar
                                ZStack {
                                    Circle()
                                        .fill(AppColors.brand500.opacity(0.3))
                                        .frame(width: 80, height: 80)

                                    Image(systemName: "person.fill")
                                        .font(.system(size: 32))
                                        .foregroundColor(AppColors.brand500)
                                }

                                // Edit Picture Button - Figma: brand500 bg, white text
                                Button {
                                    // TODO: Implement photo picker
                                } label: {
                                    Text("Edit Picture")
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, Spacing.md)
                                        .padding(.vertical, Spacing.xs)
                                        .background(AppColors.brand500)
                                        .cornerRadius(Radius.md)
                                }

                                Spacer()
                            }
                            .padding(.top, Spacing.md)

                            // User name field - Figma: "User name" label with "edit" link
                            ProfileEditField(
                                label: "User name",
                                value: viewModel.fullName,
                                isEditable: true
                            ) {
                                viewModel.startEditing()
                            }

                            // Email field
                            ProfileEditField(
                                label: "Email",
                                value: viewModel.email.isEmpty ? "-" : viewModel.email,
                                isEditable: true
                            ) {
                                viewModel.startEditing()
                            }

                            // City field - Figma: Read-only, gray text
                            ProfileEditField(
                                label: "City",
                                value: viewModel.city.isEmpty ? "Bangalore" : viewModel.city,
                                isEditable: false
                            )

                            // Phone Number field - Figma: Read-only with country code
                            ProfileEditField(
                                label: "Phone Number",
                                value: viewModel.formattedPhone,
                                isEditable: false,
                                showCountryCode: true
                            )

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

                    // Save Changes Button - Figma: Dark button with orange border
                    PrimaryButton(
                        title: viewModel.isSaving ? "Saving..." : "Save Changes",
                        isLoading: viewModel.isSaving,
                        isEnabled: !viewModel.isSaving
                    ) {
                        Task {
                            _ = await viewModel.saveChanges()
                        }
                    }

                    Spacer()
                        .frame(height: Spacing.md)
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .navigationBarHidden(true)
        .task {
            await viewModel.loadProfile()
        }
    }
}

// MARK: - Profile Edit Field
// Figma: Label above, value below, "edit" link on right

struct ProfileEditField: View {
    let label: String
    let value: String
    var isEditable: Bool = false
    var showCountryCode: Bool = false
    var onEdit: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            // Label row with edit link
            HStack {
                Text(label)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(AppColors.neutral500)

                Spacer()

                if isEditable, let onEdit = onEdit {
                    Button(action: onEdit) {
                        Text("edit")
                            .font(.system(size: 12, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                    }
                }
            }

            // Value row
            HStack(spacing: Spacing.xs) {
                if showCountryCode {
                    HStack(spacing: 4) {
                        Text("+91")
                            .font(.system(size: 16, weight: .regular))
                            .foregroundColor(AppColors.neutral500)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10))
                            .foregroundColor(AppColors.neutral500)
                    }
                }

                Text(value)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundColor(isEditable ? .white : AppColors.neutral500)
            }
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

    var fullName: String {
        let name = [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
        return name.isEmpty ? "-" : name
    }

    var city: String = ""

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
