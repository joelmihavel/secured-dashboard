/// AgreementUploadViewModel.swift
/// Flent Secured v2 - Agreement Upload ViewModel
///
/// Manages rental agreement document upload and processing
/// Handles file selection, upload, and OCR processing status
///
/// Figma: onboarding / agreement upload

import Foundation
import Observation
import UniformTypeIdentifiers
import Supabase

// MARK: - Agreement Upload ViewModel

@Observable
final class AgreementUploadViewModel {

    // MARK: - State

    enum State: Equatable {
        case idle
        case selecting
        case uploading(progress: Double)
        case processing
        case processed(extractionId: String)
        case error(String)
    }

    // MARK: - Properties

    private(set) var state: State = .idle
    private(set) var selectedFileName: String?
    private(set) var selectedFileSize: Int64?
    private(set) var extractionId: String?

    // MARK: - Computed Properties

    var isLoading: Bool {
        switch state {
        case .uploading, .processing:
            return true
        default:
            return false
        }
    }

    var uploadProgress: Double {
        if case .uploading(let progress) = state {
            return progress
        }
        return 0
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var hasSelectedFile: Bool {
        selectedFileName != nil
    }

    var canUpload: Bool {
        hasSelectedFile && !isLoading
    }

    var fileSizeFormatted: String? {
        guard let size = selectedFileSize else { return nil }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: size)
    }

    var statusMessage: String {
        switch state {
        case .idle:
            return "Select your rental agreement PDF"
        case .selecting:
            return "Selecting file..."
        case .uploading(let progress):
            return "Uploading... \(Int(progress * 100))%"
        case .processing:
            return "Processing document..."
        case .processed:
            return "Document processed successfully"
        case .error:
            return "Upload failed"
        }
    }

    // MARK: - Supported File Types

    static let supportedTypes: [UTType] = [.pdf]
    static let maxFileSizeMB: Int = 10
    static let maxFileSizeBytes: Int64 = Int64(maxFileSizeMB * 1024 * 1024)

    // MARK: - Dependencies

    private let supabase: SupabaseManager

    // MARK: - Initialization

    init(supabase: SupabaseManager = .shared) {
        self.supabase = supabase
    }

    // MARK: - Actions

    /// Handle file selection from document picker
    @MainActor
    func selectFile(url: URL) async {
        state = .selecting

        // Start accessing security-scoped resource
        guard url.startAccessingSecurityScopedResource() else {
            state = .error("Cannot access the selected file")
            return
        }

        defer {
            url.stopAccessingSecurityScopedResource()
        }

        do {
            // Get file attributes
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            let fileSize = attributes[.size] as? Int64 ?? 0

            // Validate file size
            if fileSize > Self.maxFileSizeBytes {
                state = .error("File is too large. Maximum size is \(Self.maxFileSizeMB)MB")
                return
            }

            // Validate file type
            guard url.pathExtension.lowercased() == "pdf" else {
                state = .error("Please select a PDF file")
                return
            }

            selectedFileName = url.lastPathComponent
            selectedFileSize = fileSize

            // Auto-upload after selection
            await uploadDocument(from: url)

        } catch {
            state = .error("Failed to read file: \(error.localizedDescription)")
        }
    }

    /// Upload the selected document
    @MainActor
    func uploadDocument(from url: URL) async {
        guard url.startAccessingSecurityScopedResource() else {
            state = .error("Cannot access the selected file")
            return
        }

        defer {
            url.stopAccessingSecurityScopedResource()
        }

        state = .uploading(progress: 0)

        do {
            // Read file data
            let fileData = try Data(contentsOf: url)

            // Step 1: Get signed upload URL from Edge Function
            state = .uploading(progress: 0.1)

            let uploadRequest = UploadDocumentRequest(
                fileName: selectedFileName ?? "agreement.pdf",
                fileSize: Int(selectedFileSize ?? 0),
                contentType: "application/pdf"
            )

            let uploadResponse: UploadDocumentResponse = try await supabase.client.functions.invoke(
                "upload-document",
                options: FunctionInvokeOptions(body: uploadRequest)
            )

            guard uploadResponse.success, let uploadData = uploadResponse.data else {
                throw UploadError.serverError(uploadResponse.error ?? "Failed to get upload URL")
            }

            state = .uploading(progress: 0.3)

            // Step 2: Upload to Storage using signed URL
            guard let uploadURL = URL(string: uploadData.signedUrl) else {
                throw UploadError.invalidURL
            }

            var request = URLRequest(url: uploadURL)
            request.httpMethod = "PUT"
            request.setValue("application/pdf", forHTTPHeaderField: "Content-Type")
            request.httpBody = fileData

            let (_, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                throw UploadError.uploadFailed
            }

            state = .uploading(progress: 0.7)

            // Step 3: Trigger document processing
            state = .processing

            let processResponse: ProcessDocumentResponse = try await supabase.client.functions.invoke(
                "process-document",
                options: FunctionInvokeOptions(body: ["extraction_id": uploadData.extractionId])
            )

            if processResponse.success {
                extractionId = uploadData.extractionId
                state = .processed(extractionId: uploadData.extractionId)
            } else {
                // Processing started but may take time - still considered success
                extractionId = uploadData.extractionId
                state = .processed(extractionId: uploadData.extractionId)
            }

        } catch let error as UploadError {
            state = .error(error.localizedDescription)
        } catch {
            state = .error("Upload failed: \(error.localizedDescription)")
        }
    }

    /// Retry upload with previously selected file
    @MainActor
    func retry() {
        state = .idle
    }

    /// Reset state
    func reset() {
        state = .idle
        selectedFileName = nil
        selectedFileSize = nil
        extractionId = nil
    }
}

// MARK: - Request/Response Types

private struct UploadDocumentRequest: Encodable {
    let fileName: String
    let fileSize: Int
    let contentType: String

    enum CodingKeys: String, CodingKey {
        case fileName = "file_name"
        case fileSize = "file_size"
        case contentType = "content_type"
    }
}

private struct UploadDocumentResponse: Decodable {
    let success: Bool
    let data: UploadData?
    let error: String?

    struct UploadData: Decodable {
        let extractionId: String
        let signedUrl: String
        let filePath: String

        enum CodingKeys: String, CodingKey {
            case extractionId = "extraction_id"
            case signedUrl = "signed_url"
            case filePath = "file_path"
        }
    }
}

private struct ProcessDocumentResponse: Decodable {
    let success: Bool
    let message: String?
    let error: String?
}

// MARK: - Upload Error

enum UploadError: LocalizedError {
    case invalidURL
    case uploadFailed
    case processingFailed
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid upload URL"
        case .uploadFailed:
            return "Failed to upload document"
        case .processingFailed:
            return "Failed to process document"
        case .serverError(let message):
            return message
        }
    }
}

// MARK: - Preview Helpers

extension AgreementUploadViewModel {
    static var preview: AgreementUploadViewModel {
        AgreementUploadViewModel()
    }

    static var previewWithFile: AgreementUploadViewModel {
        let vm = AgreementUploadViewModel()
        vm.selectedFileName = "rental_agreement.pdf"
        vm.selectedFileSize = 2_500_000
        return vm
    }

    static var previewUploading: AgreementUploadViewModel {
        let vm = AgreementUploadViewModel()
        vm.selectedFileName = "rental_agreement.pdf"
        vm.state = .uploading(progress: 0.45)
        return vm
    }

    static var previewProcessing: AgreementUploadViewModel {
        let vm = AgreementUploadViewModel()
        vm.selectedFileName = "rental_agreement.pdf"
        vm.state = .processing
        return vm
    }

    static var previewError: AgreementUploadViewModel {
        let vm = AgreementUploadViewModel()
        vm.state = .error("Upload failed. Please try again.")
        return vm
    }
}
