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
///   - "One" - Gray (#A9A9A9)
///   - "More Step" - Brand (#FF9A6D)
/// - Subtitle: 14px Regular, #797979
/// - Horizontal padding: 48pt (sp-48)

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

                // Header - Figma: H1/Regular 400 (48px, tracking -2px)
                VStack(alignment: .leading, spacing: Spacing.md) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("One")
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.neutral500) // #A9A9A9
                            .tracking(-2)
                            .lineSpacing(16)
                        Text("More Step")
                            .font(Typography.h1) // 48px Regular
                            .foregroundColor(AppColors.brand500) // #FF9A6D
                            .tracking(-2)
                            .lineSpacing(16)
                    }

                    Text("Your rental agreement helps us confirm your details and unlock your Secured benefits.")
                        .font(Typography.bodyMd2) // 14px Regular
                        .foregroundColor(AppColors.black300) // #797979
                        .lineSpacing(6)
                }

                Spacer()

                // Upload Area with enhanced states
                EnhancedUploadDropZone(
                    state: viewModel.state,
                    fileName: viewModel.selectedFileName,
                    fileSize: viewModel.fileSizeFormatted,
                    progress: viewModel.uploadProgress,
                    errorType: viewModel.errorType,
                    onTap: {
                        if case .idle = viewModel.state {
                            showDocumentPicker = true
                        }
                    },
                    onDelete: {
                        viewModel.reset()
                    }
                )

                // Enhanced Error Display
                if case .error = viewModel.state {
                    if viewModel.selectedFileName != nil {
                         // Show inline error text for file-specific errors
                         Text(viewModel.errorType.message)
                             .font(Typography.bodyMd2)
                             .foregroundColor(AppColors.error)
                             .multilineTextAlignment(.center)
                             .padding(.top, Spacing.md)
                             .frame(maxWidth: .infinity)
                    } else {
                        uploadErrorView
                    }
                }

                Spacer()

                // File Requirements - Only show in idle
                if case .idle = viewModel.state {
                    fileRequirementsView
                }

                // Proceed / Upload Again Button
                if case .processed(let extractionId) = viewModel.state {
                    PrimaryButton(
                        title: "Proceed",
                        isLoading: false,
                        isEnabled: true
                    ) {
                        coordinator.navigate(to: .agreementReview(extractionId: extractionId))
                    }
                } else if case .error = viewModel.state {
                    PrimaryButton(
                        title: "Upload Again",
                        isLoading: false,
                        isEnabled: true
                    ) {
                        viewModel.retry()
                        showDocumentPicker = true
                    }
                } else if viewModel.selectedFileName != nil && !viewModel.isUploading {
                     PrimaryButton(
                        title: "Proceed",
                        isLoading: false,
                        isEnabled: true
                    ) {
                         Task {
                             await viewModel.startUpload()
                         }
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
            if case .processed(let extractionId) = newState {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
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
                        Image(systemName: viewModel.errorType.iconName)
                            .font(.system(size: 60))
                            .foregroundColor(viewModel.errorType.color)
                            .frame(maxWidth: .infinity)

                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text(viewModel.errorType.detailTitle)
                                .font(Typography.h5)
                                .foregroundColor(AppColors.textPrimary)

                            Text(viewModel.errorType.detailMessage)
                                .font(Typography.bodyMd2)
                                .foregroundColor(AppColors.textSecondary)
                                .lineSpacing(4)
                        }

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
    var onDelete: (() -> Void)? = nil

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
        Button(action: {
             if fileName != nil {
                 // Do nothing
             } else {
                 onTap()
             }
        }) {
            VStack(spacing: Spacing.md) {
                if isUploading {
                    uploadingState
                } else if isProcessed {
                    successState
                } else if hasError && fileName != nil {
                    fileSelectedState
                } else if hasError {
                    errorState
                } else if fileName != nil {
                    fileSelectedState
                } else {
                    idleState
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: fileName != nil ? 160 : 220)
            .background(backgroundColor)
            .cornerRadius(Radius.md)
            .overlay(borderOverlay)
        }
        .disabled(isUploading || (fileName != nil))
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
        ZStack {
            VStack(spacing: 12) {
                 Image(systemName: "doc.text")
                    .font(.system(size: 32))
                    .foregroundColor(AppColors.textSecondary)

                 if let name = fileName {
                    Text(name)
                        .font(Typography.bodySmMedium)
                        .foregroundColor(AppColors.black400)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .frame(width: 167)
                }
            }
            
            if let onDelete = onDelete {
                Button(action: onDelete) {
                    Image(systemName: "trash")
                         .font(.system(size: 16))
                         .foregroundColor(AppColors.error)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(16)
            }
        }
        .padding(Spacing.md)
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
        if fileName != nil {
            return AppColors.black500
        }
        if hasError {
            return errorType.color.opacity(0.05)
        }
        return AppColors.backgroundSecondary
    }

    private var borderOverlay: some View {
        RoundedRectangle(cornerRadius: Radius.md)
            .strokeBorder(
                style: StrokeStyle(
                    lineWidth: hasError ? 1 : 2,
                    dash: (isUploading || isProcessed || hasError || fileName != nil) ? [] : [8]
                )
            )
            .foregroundColor(borderColor)
    }

    private var borderColor: Color {
        if isProcessed {
            return AppColors.success
        } else if hasError {
            return errorType.color
        } else if isUploading {
            return AppColors.accentPrimary
        } else if fileName != nil {
            return Color.clear
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
            return "This file is too large. Please upload a file under 10MB"
        case .expired:
            return "The agreement is invalid or expired. Please upload a valid one."
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