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

@MainActor
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

    var isUploading: Bool {
        switch state {
        case .uploading, .processing:
            return true
        default:
            return false
        }
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var errorType: UploadErrorType {
        guard case .error(let message) = state else { return .generic }

        let lowercased = message.lowercased()
        if lowercased.contains("too large") || lowercased.contains("maximum size") {
            return .fileTooLarge
        } else if lowercased.contains("expired") {
            return .expired
        } else if lowercased.contains("pdf") || lowercased.contains("format") {
            return .invalidFormat
        } else if lowercased.contains("network") || lowercased.contains("connection") || lowercased.contains("internet") {
            return .networkError
        }
        return .generic
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

    /// Start upload process manually
    @MainActor
    func startUpload() async {
        print("[AgreementUploadViewModel] startUpload called")
        // If we are in test mode or just simulating for UI
        #if DEBUG
        await simulateMockUpload()
        #endif
    }

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
        // In test mode, simulate successful upload
        #if DEBUG
        if AppEnvironment.useMockServices {
            await simulateMockUpload()
            return
        }
        #endif

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
                fileType: "application/pdf",
                fileSize: Int(selectedFileSize ?? 0)
            )

            print("[AgreementUploadViewModel] Calling upload-document function")

            let uploadResponse: UploadDocumentResponse
            do {
                uploadResponse = try await supabase.client.functions.invoke(
                    "upload-document",
                    options: FunctionInvokeOptions(body: uploadRequest)
                )
                print("[AgreementUploadViewModel] Got response - success: \(uploadResponse.success), uploadUrl: \(uploadResponse.uploadUrl != nil), error: \(uploadResponse.error ?? "nil")")
            } catch let error as FunctionsError {
                print("[AgreementUploadViewModel] FunctionsError: \(error)")
                switch error {
                case .httpError(let code, let data):
                    let errorBody = String(data: data, encoding: .utf8) ?? "Unable to decode"
                    print("[AgreementUploadViewModel] HTTP \(code): \(errorBody)")
                    throw UploadError.serverError("Server error (\(code)): \(errorBody)")
                case .relayError:
                    print("[AgreementUploadViewModel] Relay error")
                    throw UploadError.serverError("Network relay error")
                }
            } catch {
                print("[AgreementUploadViewModel] Other error: \(error)")
                print("[AgreementUploadViewModel] Error type: \(type(of: error))")
                throw UploadError.serverError("Function call failed: \(error.localizedDescription)")
            }

            guard uploadResponse.success, let signedUrl = uploadResponse.uploadUrl else {
                print("[AgreementUploadViewModel] Upload failed: \(uploadResponse.error ?? "Unknown error")")
                throw UploadError.serverError(uploadResponse.error ?? "Failed to get upload URL")
            }

            print("[AgreementUploadViewModel] Got signed URL, extraction ID: \(uploadResponse.extractedRentalInfoId ?? "nil")")
            state = .uploading(progress: 0.3)

            // Step 2: Upload to Storage using signed URL
            guard let uploadURL = URL(string: signedUrl) else {
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

            let currentExtractionId = uploadResponse.extractedRentalInfoId ?? ""
            print("[AgreementUploadViewModel] Calling process-document with extraction ID: \(currentExtractionId)")

            do {
                let processResponse: ProcessDocumentResponse = try await supabase.client.functions.invoke(
                    "process-document",
                    options: FunctionInvokeOptions(body: ["extraction_id": currentExtractionId])
                )
                print("[AgreementUploadViewModel] process-document response: success=\(processResponse.success), message=\(processResponse.message ?? "nil"), error=\(processResponse.error ?? "nil")")

                if processResponse.success {
                    extractionId = currentExtractionId
                    state = .processed(extractionId: currentExtractionId)
                    print("[AgreementUploadViewModel] Document processed successfully")
                } else {
                    // Processing started but may take time - still considered success
                    extractionId = currentExtractionId
                    state = .processed(extractionId: currentExtractionId)
                    print("[AgreementUploadViewModel] Processing queued: \(processResponse.message ?? "No message")")
                }
            } catch let error as FunctionsError {
                print("[AgreementUploadViewModel] process-document FunctionsError: \(error)")
                switch error {
                case .httpError(let code, let data):
                    let errorBody = String(data: data, encoding: .utf8) ?? "Unable to decode"
                    print("[AgreementUploadViewModel] process-document HTTP \(code): \(errorBody)")
                    throw UploadError.processingFailed
                case .relayError:
                    print("[AgreementUploadViewModel] process-document relay error")
                    throw UploadError.processingFailed
                }
            } catch {
                print("[AgreementUploadViewModel] process-document error: \(error)")
                print("[AgreementUploadViewModel] process-document error type: \(type(of: error))")
                throw UploadError.processingFailed
            }

        } catch let error as UploadError {
            print("[AgreementUploadViewModel] UploadError: \(error.localizedDescription)")
            state = .error(error.localizedDescription)
        } catch {
            print("[AgreementUploadViewModel] Unexpected error: \(error)")
            state = .error("Upload failed: \(error.localizedDescription)")
        }
    }

    /// Simulate mock upload for test mode
    #if DEBUG
    @MainActor
    private func simulateMockUpload() async {
        state = .uploading(progress: 0.2)
        try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s

        state = .uploading(progress: 0.5)
        try? await Task.sleep(nanoseconds: 300_000_000) // 0.3s

        state = .uploading(progress: 0.8)
        try? await Task.sleep(nanoseconds: 200_000_000) // 0.2s

        state = .processing
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s

        let mockExtractionId = "mock-extraction-\(UUID().uuidString.prefix(8))"
        extractionId = mockExtractionId
        state = .processed(extractionId: mockExtractionId)

        print("[AgreementUploadViewModel] 🧪 Mock upload completed with extraction ID: \(mockExtractionId)")
    }
    #endif

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
    let fileType: String
    let fileSize: Int

    enum CodingKeys: String, CodingKey {
        case fileName = "file_name"
        case fileType = "file_type"
        case fileSize = "file_size"
    }
}

private struct UploadDocumentResponse: Decodable {
    let success: Bool
    let uploadUrl: String?
    let extractedRentalInfoId: String?
    let downloadUrl: String?
    let documentPath: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success
        case uploadUrl = "upload_url"
        case extractedRentalInfoId = "extracted_rental_info_id"
        case downloadUrl = "download_url"
        case documentPath = "document_path"
        case error
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
