/// AgreementUploadView.swift
/// Flent Secured v2 - Rental Agreement Upload Screen
///
/// Figma Node IDs:
/// - 1:31671 - Agreement upload (idle)
/// - 1:31752 - Agreement uploading
/// - 1:31754 - Expired agreement error
/// - 1:31755 - File too large error
///
/// PIXEL PERFECT from Figma:
/// - Background: #131313 with dotted grid pattern
/// - Header: H1/Regular 400 (48px, tracking -2px)
///   - "Upload your" - Gray (#A9A9A9)
///   - "agreement" - Brand (#FF9A6D)
/// - Subtitle: 14px Regular, #A6A6A6
/// - Horizontal padding: 48pt (sp-48)
///
/// States handled:
/// - .idle: Upload prompt
/// - .selecting: Choosing file
/// - .uploading: Uploading document with progress
/// - .processing: Document being processed by AI
/// - .processed: Ready to review
/// - .error: Various error states (expired, too large, generic)

import SwiftUI
import UniformTypeIdentifiers

struct AgreementUploadView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = AgreementUploadViewModel()
    @State private var showDocumentPicker = false
    @State private var showErrorSheet = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            DottedGridPattern()
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Back Button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.white)
                }

                // Header - Figma: H1/Regular 400 with two-color format
                VStack(alignment: .leading, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Upload your")
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.neutral500) // #A9A9A9
                            .tracking(-2)
                            .lineSpacing(16)
                        Text("agreement")
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.brand500) // #FF9A6D
                            .tracking(-2)
                            .lineSpacing(16)
                    }

                    Text("We'll extract your rental details automatically")
                        .font(Typography.bodyMd2) // 14px Regular
                        .foregroundColor(AppColors.black200) // #A6A6A6
                        .lineSpacing(6)
                }

                Spacer()

                // Upload Area with enhanced states
                EnhancedUploadDropZone(
                    state: viewModel.state,
                    fileName: viewModel.selectedFileName,
                    fileSize: viewModel.fileSizeFormatted,
                    progress: viewModel.uploadProgress,
                    errorType: viewModel.errorType
                ) {
                    showDocumentPicker = true
                }

                // Enhanced Error Display
                if case .error = viewModel.state {
                    uploadErrorView
                }

                Spacer()

                // Security Info
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.textMuted)

                    Text("Your document is encrypted and secure")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textMuted)
                }

                // File Requirements
                if case .idle = viewModel.state {
                    fileRequirementsView
                }

                // Continue Button (only shown when processed)
                if case .processed(let extractionId) = viewModel.state {
                    PrimaryButton(
                        title: "Continue",
                        isLoading: false,
                        isEnabled: true
                    ) {
                        coordinator.navigate(to: .agreementReview(extractionId: extractionId))
                    }
                }
            }
            .padding(.horizontal, Spacing.xxxl) // 48pt horizontal (sp-48)
            .padding(.top, Spacing.xxl) // 40pt top
        }
        .navigationBarHidden(true)
        .fileImporter(
            isPresented: $showDocumentPicker,
            allowedContentTypes: AgreementUploadViewModel.supportedTypes,
            allowsMultipleSelection: false
        ) { result in
            handleFileSelection(result)
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.state)
        .onChange(of: viewModel.state) { _, newState in
            print("[AgreementUploadView] State changed to: \(newState)")
            if case .processed(let extractionId) = newState {
                print("[AgreementUploadView] Document processed, navigating to review with ID: \(extractionId)")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    print("[AgreementUploadView] Executing navigation to agreementReview")
                    coordinator.navigate(to: .agreementReview(extractionId: extractionId))
                }
            }
        }
        .sheet(isPresented: $showErrorSheet) {
            errorDetailSheet
        }
    }

    // MARK: - Upload Error View

    private var uploadErrorView: some View {
        VStack(spacing: Spacing.md) {
            // Error Card
            HStack(spacing: Spacing.sm) {
                Image(systemName: viewModel.errorType.iconName)
                    .font(.system(size: 24))
                    .foregroundColor(viewModel.errorType.color)

                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(viewModel.errorType.title)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text(viewModel.errorType.message)
                        .font(Typography.bodySm)
                        .foregroundColor(AppColors.textSecondary)
                        .lineLimit(2)
                }

                Spacer()

                if viewModel.errorType.hasHelp {
                    Button {
                        showErrorSheet = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                            .font(.system(size: 20))
                            .foregroundColor(AppColors.textMuted)
                    }
                }
            }
            .padding(Spacing.md)
            .background(viewModel.errorType.color.opacity(0.1))
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(viewModel.errorType.color.opacity(0.3), lineWidth: 1)
            )

            // Action Buttons
            HStack(spacing: Spacing.sm) {
                SecondaryButton(title: "Try Again") {
                    viewModel.retry()
                    showDocumentPicker = true
                }

                if viewModel.errorType == .expired {
                    TextButton(title: "Contact Support") {
                        openSupport()
                    }
                }
            }
        }
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    // MARK: - File Requirements View

    private var fileRequirementsView: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Requirements")
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)

            HStack(spacing: Spacing.lg) {
                requirementItem(icon: "doc.text", text: "PDF format")
                requirementItem(icon: "arrow.up.doc", text: "Max \(AgreementUploadViewModel.maxFileSizeMB)MB")
                requirementItem(icon: "calendar", text: "Valid agreement")
            }
        }
        .padding(.top, Spacing.sm)
    }

    private func requirementItem(icon: String, text: String) -> some View {
        HStack(spacing: Spacing.xxs) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundColor(AppColors.textMuted)
            Text(text)
                .font(Typography.caption)
                .foregroundColor(AppColors.textMuted)
        }
    }

    // MARK: - Error Detail Sheet

    private var errorDetailSheet: some View {
        NavigationView {
            ZStack {
                AppColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Error Icon
                        Image(systemName: viewModel.errorType.iconName)
                            .font(.system(size: 60))
                            .foregroundColor(viewModel.errorType.color)
                            .frame(maxWidth: .infinity)

                        // Error Details
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text(viewModel.errorType.detailTitle)
                                .font(Typography.h5)
                                .foregroundColor(AppColors.textPrimary)

                            Text(viewModel.errorType.detailMessage)
                                .font(Typography.bodyMd2)
                                .foregroundColor(AppColors.textSecondary)
                                .lineSpacing(4)
                        }

                        // Help Steps
                        if !viewModel.errorType.helpSteps.isEmpty {
                            VStack(alignment: .leading, spacing: Spacing.sm) {
                                Text("What you can do:")
                                    .font(Typography.label)
                                    .foregroundColor(AppColors.textPrimary)

                                ForEach(Array(viewModel.errorType.helpSteps.enumerated()), id: \.offset) { index, step in
                                    HStack(alignment: .top, spacing: Spacing.sm) {
                                        Text("\(index + 1).")
                                            .font(Typography.bodySmMedium)
                                            .foregroundColor(AppColors.accentPrimary)
                                            .frame(width: 20, alignment: .leading)

                                        Text(step)
                                            .font(Typography.bodySm)
                                            .foregroundColor(AppColors.textSecondary)
                                    }
                                }
                            }
                            .padding(Spacing.md)
                            .background(AppColors.backgroundSecondary)
                            .cornerRadius(Radius.md)
                        }

                        Spacer()

                        PrimaryButton(title: "Got it") {
                            showErrorSheet = false
                        }
                    }
                    .padding(Spacing.xl)
                }
            }
            .navigationTitle("Upload Help")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        showErrorSheet = false
                    }
                    .foregroundColor(AppColors.textSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Actions

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            Task {
                await viewModel.selectFile(url: url)
            }
        case .failure(let error):
            print("File selection failed: \(error.localizedDescription)")
        }
    }

    private func openSupport() {
        if let url = URL(string: "mailto:support@flent.app?subject=Agreement%20Upload%20Issue") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Enhanced Upload Drop Zone

struct EnhancedUploadDropZone: View {
    let state: AgreementUploadViewModel.State
    let fileName: String?
    let fileSize: String?
    let progress: Double
    let errorType: UploadErrorType
    let onTap: () -> Void

    @State private var pulseAnimation = false

    private var isUploading: Bool {
        switch state {
        case .uploading, .processing:
            return true
        default:
            return false
        }
    }

    private var isProcessed: Bool {
        if case .processed = state { return true }
        return false
    }

    private var hasError: Bool {
        if case .error = state { return true }
        return false
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: Spacing.md) {
                if isUploading {
                    uploadingState
                } else if isProcessed {
                    successState
                } else if hasError {
                    errorState
                } else if fileName != nil {
                    fileSelectedState
                } else {
                    idleState
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 220)
            .background(backgroundColor)
            .cornerRadius(Radius.md)
            .overlay(borderOverlay)
        }
        .disabled(isUploading)
        .animation(.easeInOut(duration: 0.3), value: state)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                pulseAnimation = true
            }
        }
    }

    // MARK: - States

    private var idleState: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(AppColors.accentPrimary.opacity(0.1))
                    .frame(width: 80, height: 80)
                    .scaleEffect(pulseAnimation ? 1.1 : 1.0)

                Image(systemName: "doc.badge.plus")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.accentPrimary)
            }

            VStack(spacing: Spacing.xs) {
                Text("Tap to upload agreement")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Text("PDF up to \(AgreementUploadViewModel.maxFileSizeMB)MB")
                    .font(Typography.bodySm)
                    .foregroundColor(AppColors.textSecondary)
            }
        }
    }

    private var uploadingState: some View {
        VStack(spacing: Spacing.md) {
            if case .uploading(let progress) = state {
                // Upload Progress Ring
                ZStack {
                    Circle()
                        .stroke(AppColors.border, lineWidth: 6)
                        .frame(width: 80, height: 80)

                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(
                            AppColors.accentPrimary,
                            style: StrokeStyle(lineWidth: 6, lineCap: .round)
                        )
                        .frame(width: 80, height: 80)
                        .rotationEffect(.degrees(-90))

                    Text("\(Int(progress * 100))%")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)
                }
                .animation(.easeInOut, value: progress)

                VStack(spacing: Spacing.xs) {
                    Text("Uploading...")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    if let name = fileName {
                        Text(name)
                            .font(Typography.caption)
                            .foregroundColor(AppColors.textSecondary)
                            .lineLimit(1)
                    }
                }
            } else {
                // Processing with AI animation
                ZStack {
                    Circle()
                        .fill(AppColors.accentPrimary.opacity(0.1))
                        .frame(width: 80, height: 80)

                    Image(systemName: "sparkles")
                        .font(.system(size: 36))
                        .foregroundColor(AppColors.accentPrimary)
                        .symbolEffect(.variableColor.iterative)
                }

                VStack(spacing: Spacing.xs) {
                    Text("AI is reading your agreement...")
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)

                    Text("Extracting tenant, landlord, and rent details")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
    }

    private var successState: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(AppColors.success.opacity(0.1))
                    .frame(width: 80, height: 80)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.success)
            }

            VStack(spacing: Spacing.xs) {
                Text("Document processed!")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                if let name = fileName {
                    Text(name)
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textSecondary)
                        .lineLimit(1)
                }
            }
        }
    }

    private var fileSelectedState: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(AppColors.accentPrimary.opacity(0.1))
                    .frame(width: 64, height: 80)

                Image(systemName: "doc.fill")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.accentPrimary)
            }

            VStack(spacing: Spacing.xs) {
                if let name = fileName {
                    Text(name)
                        .font(Typography.bodyMd)
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)
                }

                if let size = fileSize {
                    Text(size)
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textSecondary)
                }

                Text("Tap to change")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.accentPrimary)
            }
        }
    }

    private var errorState: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(errorType.color.opacity(0.1))
                    .frame(width: 80, height: 80)

                Image(systemName: errorType.iconName)
                    .font(.system(size: 36))
                    .foregroundColor(errorType.color)
            }

            VStack(spacing: Spacing.xs) {
                Text(errorType.title)
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.textPrimary)

                Text("Tap to try again")
                    .font(Typography.caption)
                    .foregroundColor(AppColors.accentPrimary)
            }
        }
    }

    // MARK: - Styling

    private var backgroundColor: Color {
        if hasError {
            return errorType.color.opacity(0.05)
        }
        return AppColors.backgroundSecondary
    }

    private var borderOverlay: some View {
        RoundedRectangle(cornerRadius: Radius.md)
            .strokeBorder(
                style: StrokeStyle(
                    lineWidth: 2,
                    dash: (isUploading || isProcessed || hasError) ? [] : [8]
                )
            )
            .foregroundColor(borderColor)
    }

    private var borderColor: Color {
        if isProcessed {
            return AppColors.success
        } else if hasError {
            return errorType.color.opacity(0.5)
        } else if isUploading {
            return AppColors.accentPrimary
        } else {
            return AppColors.border
        }
    }
}

// MARK: - Legacy Upload Drop Zone (for backwards compatibility)

struct UploadDropZone: View {
    let state: AgreementUploadViewModel.State
    let fileName: String?
    let fileSize: String?
    let progress: Double
    let onTap: () -> Void

    var body: some View {
        EnhancedUploadDropZone(
            state: state,
            fileName: fileName,
            fileSize: fileSize,
            progress: progress,
            errorType: .generic,
            onTap: onTap
        )
    }
}

// MARK: - Circular Progress View

struct CircularProgressView: View {
    let progress: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(AppColors.border, lineWidth: 4)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(AppColors.accentPrimary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut, value: progress)

            Text("\(Int(progress * 100))%")
                .font(Typography.caption)
                .foregroundColor(AppColors.textSecondary)
        }
    }
}

// MARK: - Upload Error Types

enum UploadErrorType: Equatable {
    case generic
    case fileTooLarge
    case expired
    case invalidFormat
    case networkError

    var title: String {
        switch self {
        case .generic:
            return "Upload failed"
        case .fileTooLarge:
            return "File too large"
        case .expired:
            return "Agreement expired"
        case .invalidFormat:
            return "Invalid format"
        case .networkError:
            return "Connection error"
        }
    }

    var message: String {
        switch self {
        case .generic:
            return "Something went wrong. Please try again."
        case .fileTooLarge:
            return "Maximum file size is \(AgreementUploadViewModel.maxFileSizeMB)MB"
        case .expired:
            return "This agreement has expired. Please upload a valid agreement."
        case .invalidFormat:
            return "Please upload a PDF file"
        case .networkError:
            return "Please check your internet connection"
        }
    }

    var iconName: String {
        switch self {
        case .generic:
            return "exclamationmark.triangle.fill"
        case .fileTooLarge:
            return "arrow.up.doc.fill"
        case .expired:
            return "calendar.badge.exclamationmark"
        case .invalidFormat:
            return "doc.questionmark.fill"
        case .networkError:
            return "wifi.exclamationmark"
        }
    }

    var color: Color {
        switch self {
        case .expired:
            return AppColors.warning
        default:
            return AppColors.error
        }
    }

    var hasHelp: Bool {
        switch self {
        case .expired, .fileTooLarge:
            return true
        default:
            return false
        }
    }

    var detailTitle: String {
        switch self {
        case .fileTooLarge:
            return "Your file is too large"
        case .expired:
            return "Your agreement has expired"
        default:
            return title
        }
    }

    var detailMessage: String {
        switch self {
        case .fileTooLarge:
            return "The maximum file size we can process is \(AgreementUploadViewModel.maxFileSizeMB)MB. Large files can slow down processing and may contain unnecessary scanned images or attachments."
        case .expired:
            return "We detected that your rental agreement end date has passed. To use Flent, you need an active rental agreement that covers your current tenancy period."
        default:
            return message
        }
    }

    var helpSteps: [String] {
        switch self {
        case .fileTooLarge:
            return [
                "Try compressing the PDF using an online tool",
                "Remove any unnecessary pages or attachments",
                "Scan at a lower resolution if re-scanning",
                "Contact support if you need help"
            ]
        case .expired:
            return [
                "Get a renewed agreement from your landlord",
                "Upload an addendum extending your tenancy",
                "Contact your landlord about updating the agreement",
                "Reach out to us if you have questions"
            ]
        default:
            return []
        }
    }
}

#Preview("Initial") {
    AgreementUploadView()
        .environment(AppCoordinator())
}

#Preview("Uploading") {
    AgreementUploadView()
        .environment(AppCoordinator())
}

#Preview("Processing") {
    AgreementUploadView()
        .environment(AppCoordinator())
}

#Preview("Error - Too Large") {
    AgreementUploadView()
        .environment(AppCoordinator())
}

#Preview("Error - Expired") {
    AgreementUploadView()
        .environment(AppCoordinator())
}
