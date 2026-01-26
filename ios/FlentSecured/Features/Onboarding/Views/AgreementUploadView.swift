/// AgreementUploadView.swift
/// Flent Secured v2 - Rental Agreement Upload Screen
///
/// States handled:
/// - .idle: Upload prompt
/// - .selecting: Choosing file
/// - .uploading: Uploading document
/// - .processing: Document being processed
/// - .processed: Ready to review
/// - .error: Upload or processing error
///
/// Figma: Onboarding / Upload Agreement screens

import SwiftUI
import UniformTypeIdentifiers

struct AgreementUploadView: View {
    @Environment(AppCoordinator.self) private var coordinator

    @State private var viewModel = AgreementUploadViewModel()
    @State private var showDocumentPicker = false

    var body: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.xl) {
                // Back Button
                Button {
                    coordinator.pop()
                } label: {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(AppColors.textPrimary)
                }

                // Header
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Upload your rental agreement")
                        .font(Typography.h4)
                        .foregroundColor(AppColors.textPrimary)

                    Text("We'll extract your rental details automatically")
                        .font(Typography.bodyMd2)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                // Upload Area
                UploadDropZone(
                    state: viewModel.state,
                    fileName: viewModel.selectedFileName,
                    fileSize: viewModel.fileSizeFormatted,
                    progress: viewModel.uploadProgress
                ) {
                    showDocumentPicker = true
                }

                // Error Message
                if let error = viewModel.errorMessage {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(AppColors.error)
                            .font(.system(size: 14))

                        Text(error)
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.error)
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))

                    // Retry Button
                    Button {
                        viewModel.retry()
                        showDocumentPicker = true
                    } label: {
                        Text("Try again")
                            .font(Typography.bodySmMedium)
                            .foregroundColor(AppColors.accentPrimary)
                    }
                    .padding(.top, Spacing.xs)
                }

                Spacer()

                // Info Text
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.textMuted)

                    Text("Your document is encrypted and secure")
                        .font(Typography.caption)
                        .foregroundColor(AppColors.textMuted)
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
            .screenPadding()
            .padding(.top, Spacing.xl)
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
            // Auto-navigate when processing is complete
            if case .processed(let extractionId) = newState {
                // Small delay for user to see success state
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    coordinator.navigate(to: .agreementReview(extractionId: extractionId))
                }
            }
        }
    }

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
}

// MARK: - Upload Drop Zone

struct UploadDropZone: View {
    let state: AgreementUploadViewModel.State
    let fileName: String?
    let fileSize: String?
    let progress: Double
    let onTap: () -> Void

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

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: Spacing.md) {
                if isUploading {
                    // Uploading/Processing State
                    VStack(spacing: Spacing.sm) {
                        if case .uploading(let progress) = state {
                            CircularProgressView(progress: progress)
                                .frame(width: 60, height: 60)

                            Text("Uploading... \(Int(progress * 100))%")
                                .font(Typography.bodyMd)
                                .foregroundColor(AppColors.textSecondary)
                        } else {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppColors.accentPrimary))
                                .scaleEffect(1.5)

                            Text("Processing document...")
                                .font(Typography.bodyMd)
                                .foregroundColor(AppColors.textSecondary)

                            Text("This may take a moment")
                                .font(Typography.caption)
                                .foregroundColor(AppColors.textMuted)
                        }
                    }
                } else if isProcessed {
                    // Success State
                    VStack(spacing: Spacing.sm) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.success)

                        Text("Document processed")
                            .font(Typography.bodyMd)
                            .foregroundColor(AppColors.textPrimary)

                        if let name = fileName {
                            Text(name)
                                .font(Typography.caption)
                                .foregroundColor(AppColors.textSecondary)
                                .lineLimit(1)
                        }
                    }
                } else if let name = fileName {
                    // File Selected State
                    VStack(spacing: Spacing.sm) {
                        Image(systemName: "doc.fill")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.accentPrimary)

                        Text(name)
                            .font(Typography.bodyMd)
                            .foregroundColor(AppColors.textPrimary)
                            .lineLimit(1)

                        if let size = fileSize {
                            Text(size)
                                .font(Typography.caption)
                                .foregroundColor(AppColors.textSecondary)
                        }

                        Text("Tap to change")
                            .font(Typography.caption)
                            .foregroundColor(AppColors.accentPrimary)
                    }
                } else {
                    // Initial State
                    VStack(spacing: Spacing.sm) {
                        Image(systemName: "doc.badge.plus")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.accentPrimary)

                        Text("Tap to upload")
                            .font(Typography.bodyMd)
                            .foregroundColor(AppColors.textPrimary)

                        Text("PDF up to \(AgreementUploadViewModel.maxFileSizeMB)MB")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 200)
            .background(AppColors.backgroundSecondary)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .strokeBorder(
                        style: StrokeStyle(lineWidth: 2, dash: isUploading ? [] : [8])
                    )
                    .foregroundColor(
                        isProcessed ? AppColors.success :
                        isUploading ? AppColors.accentPrimary : AppColors.border
                    )
            )
        }
        .disabled(isUploading)
        .animation(.easeInOut(duration: 0.2), value: state)
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
