/// AgreementUploadView.swift
/// Flent Secured v2 - Rental Agreement Upload Screen
///
/// Figma screens implemented:
/// - 1:29914 - Initial upload state
/// - 1:30001 - Upload in progress (30%)
/// - 1:30268 - Error: File too large
/// - 1:30178 - Error: Invalid/expired agreement
/// - 1:30358 - Manual review pending
/// - 1:30090 - Upload complete/success

import SwiftUI
import UniformTypeIdentifiers

struct AgreementUploadView: View {
    // MARK: - Assets (from Figma REST API)
    private let imgPaperclip = "https://www.figma.com/api/mcp/asset/28714a31-4800-4989-9cf0-d78cad53ea01"
    private let imgFLogoBackground = "https://www.figma.com/api/mcp/asset/e884e3c8-e927-40f1-a915-d532346b79b2"

    // MARK: - Environment
    @Environment(AppCoordinator.self) private var coordinator

    // MARK: - ViewModel
    @State private var viewModel = AgreementUploadViewModel()
    @State private var showFilePicker = false

    // MARK: - Visual Test Mode
    var isVisualTestMode: Bool = false
    var previewState: AgreementUploadViewModel.State?

    private var displayState: AgreementUploadViewModel.State {
        previewState ?? viewModel.state
    }

    // MARK: - Body
    var body: some View {
        ZStack {
            // Background
            backgroundLayer

            // Content - Figma: 48pt horizontal padding
            VStack(spacing: 0) {
                Spacer().frame(height: 60)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        // Logo - Figma: 32pt height
                        FlentLogo(size: 32)
                            .padding(.bottom, Spacing.xs)

                        // Title Section
                        titleSection

                        // Upload Card - Figma: gap after title section
                        uploadCard
                            .padding(.top, Spacing.sm)
                    }
                    .padding(.horizontal, Spacing.xxxl)
                }

                Spacer()

                // Bottom Button - Figma: 48pt horizontal padding, 16pt bottom
                bottomButton
                    .padding(.horizontal, Spacing.xxxl)
                    .padding(.bottom, Spacing.lg)
            }
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [UTType.pdf, UTType(filenameExtension: "docx") ?? .pdf],
            allowsMultipleSelection: false
        ) { result in
            handleFileSelection(result)
        }
    }

    // MARK: - Background Layer
    private var backgroundLayer: some View {
        ZStack {
            AppColors.backgroundPrimary
                .ignoresSafeArea()

            // Dotted grid pattern - Figma: 1pt dots, 8pt spacing, 0.2 opacity, #7A6B5A
            DottedGridPattern(dotSize: 1.0, spacing: 8, dotOpacity: 0.2, dotColor: Color(hex: "7A6B5A"))
                .ignoresSafeArea()

            // F Logo background (top right)
            GeometryReader { proxy in
                AsyncImage(url: URL(string: imgFLogoBackground)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    Color.clear
                }
                .frame(width: 333.75, height: 400)
                .position(x: proxy.size.width - (333.75 / 2) + 100, y: 180)
                .opacity(0.35)

                // Paperclip watermark (left side, middle)
                AsyncImage(url: URL(string: imgPaperclip)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                } placeholder: {
                    Color.clear
                }
                .frame(width: 306, height: 194.5)
                .position(x: 43.5 + 153, y: proxy.size.height / 2 + 20)
                .opacity(0.45)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)
        }
    }

    // MARK: - Title Section
    private var titleSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // "One" + "More Step" title - Figma: 48px, -2pt tracking, tight line spacing
            VStack(alignment: .leading, spacing: -4) {
                Text("One")
                    .foregroundColor(AppColors.neutral500)
                Text("More Step")
                    .foregroundColor(AppColors.brand500)
            }
            .font(Typography.h1)
            .tracking(-2)

            // Subtitle - Figma: 12px regular, line-height 20px, color #797979
            Text("Your rental agreement helps us confirm your eligibility and unlock your Secured benefits.")
                .font(Typography.bodySm)
                .foregroundColor(AppColors.black300)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Upload Card
    @ViewBuilder
    private var uploadCard: some View {
        switch displayState {
        case .idle, .selecting:
            initialUploadCard

        case .uploading(let progress):
            uploadingCard(progress: progress)

        case .processing:
            uploadingCard(progress: 0.9)

        case .error(let type, _):
            errorCard(errorType: type)

        case .manualReview(let fileName):
            manualReviewCard(fileName: fileName)

        case .processed:
            successCard
        }
    }

    // MARK: - Initial Upload Card (Screen 1 - 1:29914)
    private var initialUploadCard: some View {
        Button(action: {
            showFilePicker = true
        }) {
            ZStack(alignment: .topLeading) {
                // Card content - Figma: 16pt spacing between icon box and text
                VStack(alignment: .leading, spacing: Spacing.md) {
                    // Upload icon in dark container - Figma: 56x56, rounded 8pt
                    ZStack {
                        RoundedRectangle(cornerRadius: Radius.sm)
                            .fill(AppColors.black600)
                            .frame(width: 56, height: 56)

                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 24, weight: .regular))
                            .foregroundColor(AppColors.neutral300)
                    }

                    // Text content - Figma: 12px, first line medium weight, second line regular
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Upload Rental Agreement")
                            .font(Typography.bodySmMedium)
                            .foregroundColor(AppColors.neutral300)

                        Text("File types: PDF, DOCX, Max size: 10MB")
                            .font(Typography.bodySm)
                            .foregroundColor(AppColors.neutral500.opacity(0.9))
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.lg)

                // Paperclip decoration (top left, offset outside card)
                paperclipDecoration
                    .offset(x: -12, y: -10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Uploading Card (Screen 2 - 1:30001)
    private func uploadingCard(progress: Double) -> some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: Spacing.sm) {
                // Progress percentage - Figma: 16px semibold, #CBCBCB
                Text("\(Int(progress * 100))%")
                    .font(Typography.bodyMd)
                    .foregroundColor(AppColors.neutral300)

                // Progress bar - Figma: 4pt height, brand orange fill
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Background track - Figma: #4D4D4D
                        Capsule()
                            .fill(AppColors.black400)
                            .frame(height: 4)

                        // Progress fill - Figma: brand500 orange
                        Capsule()
                            .fill(AppColors.brand500)
                            .frame(width: geometry.size.width * progress, height: 4)
                    }
                }
                .frame(height: 4)
                .padding(.horizontal, Spacing.lg)
            }
            .padding(.vertical, Spacing.xxxl)
            .frame(maxWidth: .infinity)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)

            // Paperclip decoration
            paperclipDecoration
                .offset(x: -12, y: -10)
        }
    }

    // MARK: - Error Card (Screens 3 & 4 - 1:30268, 1:30178)
    private func errorCard(errorType: UploadErrorType) -> some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: Spacing.sm) {
                // File icon with fold - Figma: red border for error
                fileIconWithFold(borderColor: AppColors.error)

                // Filename - Figma: 12px regular, #d2d2d2, center aligned
                Text(viewModel.selectedFileName ?? "Document.pdf")
                    .font(Typography.bodySm)
                    .foregroundColor(Color(hex: "D2D2D2"))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .padding(.vertical, Spacing.xl)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.error, lineWidth: 1)
            )

            // Paperclip decoration
            paperclipDecoration
                .offset(x: -12, y: -10)
        }
    }

    // MARK: - Manual Review Card (Screen 5 - 1:30358)
    private func manualReviewCard(fileName: String) -> some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: Spacing.sm) {
                // File icon with fold - Figma: brand orange border for pending review
                fileIconWithFold(borderColor: AppColors.brand500)

                // Filename - Figma: 12px regular, #d2d2d2, center aligned
                Text(fileName)
                    .font(Typography.bodySm)
                    .foregroundColor(Color(hex: "D2D2D2"))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .padding(.vertical, Spacing.xl)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md)
                    .stroke(AppColors.brand500, lineWidth: 1)
            )

            // Paperclip decoration
            paperclipDecoration
                .offset(x: -12, y: -10)
        }
    }

    // MARK: - Success Card (Screen 6 - 1:30090)
    private var successCard: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: Spacing.sm) {
                // File icon with fold - Figma: success green for completed
                fileIconWithFold(borderColor: AppColors.success)

                // Filename - Figma: 12px regular, #d2d2d2, center aligned
                Text(viewModel.selectedFileName ?? "Document.pdf")
                    .font(Typography.bodySm)
                    .foregroundColor(Color(hex: "D2D2D2"))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .padding(.vertical, Spacing.xl)
            .padding(.horizontal, Spacing.md)
            .frame(maxWidth: .infinity)
            .background(AppColors.black500)
            .cornerRadius(Radius.md)
            // Note: Success state has no border stroke per Figma

            // Paperclip decoration
            paperclipDecoration
                .offset(x: -12, y: -10)
        }
    }

    // MARK: - File Icon with Fold
    /// Figma: Document icon with folded corner, 48x56pt, lock icon centered
    private func fileIconWithFold(borderColor: Color) -> some View {
        ZStack {
            // Document shape with corner fold - Figma: fold size ~14pt
            DocumentWithFold(foldSize: 14, cornerRadius: 4)
                .fill(AppColors.black600)
                .frame(width: 48, height: 60)
                .overlay(
                    DocumentWithFold(foldSize: 14, cornerRadius: 4)
                        .stroke(borderColor, lineWidth: 1)
                )

            // Lock icon in center - Figma: centered lock symbol
            Image(systemName: "lock.fill")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(borderColor)
                .offset(y: 6)
        }
    }

    // MARK: - Paperclip Decoration
    /// Figma: Decorative paperclip overlapping top-left of card
    /// Positioned to appear as if clipping the card
    private var paperclipDecoration: some View {
        Image(systemName: "paperclip")
            .font(.system(size: 26, weight: .thin))
            .foregroundColor(AppColors.neutral500.opacity(0.5))
            .rotationEffect(.degrees(-45))
    }

    // MARK: - Bottom Button
    @ViewBuilder
    private var bottomButton: some View {
        VStack(spacing: Spacing.md) {
            // Error/Status message - Figma: 14px regular, centered
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.error)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.sm)
            } else if case .manualReview = displayState {
                Text("Our team will review it manually and get back to you within 24 hours.")
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.brand500)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.sm)
            }

            // Divider line above button (for error/manual review states)
            if shouldShowDivider {
                Rectangle()
                    .fill(AppColors.black400)
                    .frame(height: 1)
                    .padding(.top, Spacing.xs)
            }

            // Button - Figma: full width, 56pt height
            PrimaryButton(
                title: buttonTitle,
                isLoading: viewModel.isUploading,
                isEnabled: isButtonEnabled,
                action: handleButtonTap
            )
        }
    }

    // MARK: - Computed Properties

    private var buttonTitle: String {
        switch displayState {
        case .idle, .selecting:
            return "Proceed"
        case .uploading, .processing:
            return "Uploading..."
        case .error:
            return "Upload Again"
        case .manualReview:
            return "Get Notified"
        case .processed:
            return "Proceed"
        }
    }

    private var isButtonEnabled: Bool {
        switch displayState {
        case .idle, .selecting:
            return false // No file selected
        case .uploading, .processing:
            return false // Loading
        case .error, .manualReview, .processed:
            return true
        }
    }

    private var shouldShowDivider: Bool {
        switch displayState {
        case .error, .manualReview:
            return true
        default:
            return false
        }
    }

    // MARK: - Actions

    private func handleButtonTap() {
        switch displayState {
        case .error:
            showFilePicker = true
            viewModel.retry()

        case .manualReview:
            // TODO: Handle "Get Notified" - register for push notifications
            coordinator.navigate(to: .home(state: .zeroState))

        case .processed(let extractionId):
            coordinator.navigate(to: .agreementReview(extractionId: extractionId))

        default:
            break
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
            print("[AgreementUploadView] File selection failed: \(error)")
        }
    }
}

// MARK: - Document with Fold Shape

struct DocumentWithFold: Shape {
    let foldSize: CGFloat
    let cornerRadius: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let foldX = rect.maxX - foldSize
        let foldY = rect.minY + foldSize

        // Start at bottom left
        path.move(to: CGPoint(x: rect.minX + cornerRadius, y: rect.maxY))

        // Bottom left corner
        path.addQuadCurve(
            to: CGPoint(x: rect.minX, y: rect.maxY - cornerRadius),
            control: CGPoint(x: rect.minX, y: rect.maxY)
        )

        // Left edge
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + cornerRadius))

        // Top left corner
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + cornerRadius, y: rect.minY),
            control: CGPoint(x: rect.minX, y: rect.minY)
        )

        // Top edge to fold
        path.addLine(to: CGPoint(x: foldX, y: rect.minY))

        // Fold diagonal
        path.addLine(to: CGPoint(x: rect.maxX, y: foldY))

        // Right edge
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - cornerRadius))

        // Bottom right corner
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX - cornerRadius, y: rect.maxY),
            control: CGPoint(x: rect.maxX, y: rect.maxY)
        )

        // Bottom edge
        path.addLine(to: CGPoint(x: rect.minX + cornerRadius, y: rect.maxY))

        return path
    }
}

// MARK: - Previews

#Preview("Initial State") {
    AgreementUploadView(previewState: .idle)
        .environment(AppCoordinator())
}

#Preview("Uploading 30%") {
    AgreementUploadView(previewState: .uploading(progress: 0.3))
        .environment(AppCoordinator())
}

#Preview("Error - File Too Large") {
    let vm = AgreementUploadViewModel.previewFileTooLarge
    return AgreementUploadView(previewState: vm.state)
        .environment(AppCoordinator())
}

#Preview("Error - Invalid/Expired") {
    let vm = AgreementUploadViewModel.previewInvalidExpired
    return AgreementUploadView(previewState: vm.state)
        .environment(AppCoordinator())
}

#Preview("Manual Review") {
    AgreementUploadView(previewState: .manualReview(fileName: "Joel_Ramesh-Agreement_Dec 2025.pdf"))
        .environment(AppCoordinator())
}

#Preview("Success") {
    AgreementUploadView(previewState: .processed(extractionId: "mock-id"))
        .environment(AppCoordinator())
}
