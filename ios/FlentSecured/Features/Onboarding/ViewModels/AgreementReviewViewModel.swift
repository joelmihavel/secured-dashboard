/// AgreementReviewViewModel.swift
/// Flent Secured v2 - Agreement Review ViewModel
///
/// Manages review of extracted rental agreement data
/// Handles polling for extraction status and confirmation
///
/// Figma: onboarding / agreement review

import Foundation
import Observation
import Supabase

// MARK: - Agreement Review ViewModel

@Observable
final class AgreementReviewViewModel {

    // MARK: - State

    enum State: Equatable {
        case loading
        case extractionPending
        case extractionComplete(ExtractedRentalInfo)
        case confirming
        case confirmed
        case error(String)

        static func == (lhs: State, rhs: State) -> Bool {
            switch (lhs, rhs) {
            case (.loading, .loading),
                 (.extractionPending, .extractionPending),
                 (.confirming, .confirming),
                 (.confirmed, .confirmed):
                return true
            case (.extractionComplete(let l), .extractionComplete(let r)):
                return l.id == r.id
            case (.error(let l), .error(let r)):
                return l == r
            default:
                return false
            }
        }
    }

    // MARK: - Properties

    let extractionId: String
    private(set) var state: State = .loading
    private(set) var extractedInfo: ExtractedRentalInfo?

    private var pollingTimer: Timer?
    private var pollCount = 0
    private let maxPollAttempts = 60 // 5 minutes at 5 second intervals

    // MARK: - Editable Fields (user can correct extracted data)

    var tenantName: String = ""
    var landlordName: String = ""
    var propertyAddress: String = ""
    var propertyCity: String = ""
    var propertyState: String = ""
    var propertyPincode: String = ""
    var monthlyRent: String = ""
    var securityDeposit: String = ""
    var rentDueDay: String = ""
    var leaseStartDate: Date?
    var leaseEndDate: Date?
    var landlordPhone: String = ""
    var landlordEmail: String = ""

    // MARK: - Computed Properties

    var isLoading: Bool {
        switch state {
        case .loading, .extractionPending, .confirming:
            return true
        default:
            return false
        }
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var canConfirm: Bool {
        guard case .extractionComplete = state else { return false }
        return isValidForConfirmation
    }

    var isValidForConfirmation: Bool {
        !tenantName.isEmpty &&
        !landlordName.isEmpty &&
        !propertyAddress.isEmpty &&
        !propertyCity.isEmpty &&
        !monthlyRent.isEmpty &&
        monthlyRentValue > 0
    }

    var monthlyRentValue: Int {
        // Convert to paise (multiply by 100)
        let cleaned = monthlyRent.replacingOccurrences(of: ",", with: "")
        return (Int(cleaned) ?? 0) * 100
    }

    var securityDepositValue: Int? {
        guard !securityDeposit.isEmpty else { return nil }
        let cleaned = securityDeposit.replacingOccurrences(of: ",", with: "")
        return (Int(cleaned) ?? 0) * 100
    }

    var rentDueDayValue: Int {
        Int(rentDueDay) ?? 5
    }

    var fullAddress: String {
        [propertyAddress, propertyCity, propertyState, propertyPincode]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    var extractionStatusMessage: String {
        switch state {
        case .loading:
            return "Loading..."
        case .extractionPending:
            return "Processing your document... This may take a minute."
        case .extractionComplete:
            return "Please review the extracted information"
        case .confirming:
            return "Confirming..."
        case .confirmed:
            return "Confirmed!"
        case .error:
            return "Something went wrong"
        }
    }

    // MARK: - Dependencies

    private let supabase: SupabaseManager

    // MARK: - Initialization

    init(extractionId: String, supabase: SupabaseManager = .shared) {
        self.extractionId = extractionId
        self.supabase = supabase
    }

    deinit {
        pollingTimer?.invalidate()
    }

    // MARK: - Actions

    /// Start loading extraction status
    @MainActor
    func loadExtractionStatus() async {
        state = .loading

        do {
            let info = try await fetchExtraction()

            if info.extractionStatus == "completed" {
                populateFields(from: info)
                extractedInfo = info
                state = .extractionComplete(info)
            } else if info.extractionStatus == "failed" {
                state = .error(info.extractionError ?? "Document processing failed")
            } else {
                // Still processing - start polling
                state = .extractionPending
                startPolling()
            }
        } catch {
            state = .error("Failed to load extraction: \(error.localizedDescription)")
        }
    }

    /// Confirm the extracted/edited information
    @MainActor
    func confirmExtraction() async -> Bool {
        guard canConfirm else {
            state = .error("Please fill in all required fields")
            return false
        }

        state = .confirming

        do {
            let request = ConfirmExtractionRequest(
                extractionId: extractionId,
                tenantName: tenantName,
                landlordName: landlordName,
                propertyAddress: propertyAddress,
                propertyCity: propertyCity,
                propertyState: propertyState.isEmpty ? nil : propertyState,
                propertyPincode: propertyPincode.isEmpty ? nil : propertyPincode,
                monthlyRentPaise: monthlyRentValue,
                securityDepositPaise: securityDepositValue,
                rentDueDay: rentDueDayValue,
                leaseStartDate: leaseStartDate.map { ISO8601DateFormatter().string(from: $0) },
                leaseEndDate: leaseEndDate.map { ISO8601DateFormatter().string(from: $0) },
                landlordPhone: landlordPhone.isEmpty ? nil : landlordPhone,
                landlordEmail: landlordEmail.isEmpty ? nil : landlordEmail
            )

            let response: ConfirmExtractionResponse = try await supabase.client.functions.invoke(
                "confirm-extraction",
                options: FunctionInvokeOptions(body: request)
            )

            if response.success {
                state = .confirmed
                return true
            } else {
                state = .error(response.error ?? "Confirmation failed")
                return false
            }
        } catch {
            state = .error("Failed to confirm: \(error.localizedDescription)")
            return false
        }
    }

    /// Retry loading extraction
    @MainActor
    func retry() async {
        pollCount = 0
        await loadExtractionStatus()
    }

    // MARK: - Private Methods

    private func fetchExtraction() async throws -> ExtractedRentalInfo {
        let info: ExtractedRentalInfo = try await supabase.client
            .from("extracted_rental_info")
            .select()
            .eq("id", value: extractionId)
            .single()
            .execute()
            .value

        return info
    }

    private func populateFields(from info: ExtractedRentalInfo) {
        tenantName = info.tenantName ?? ""
        landlordName = info.landlordName ?? ""
        propertyAddress = info.propertyAddress ?? ""
        propertyCity = info.propertyCity ?? ""
        propertyState = info.propertyState ?? ""
        propertyPincode = info.propertyPincode ?? ""

        if let rent = info.monthlyRentPaise {
            monthlyRent = String(rent / 100)
        }
        if let deposit = info.securityDepositPaise {
            securityDeposit = String(deposit / 100)
        }
        if let dueDay = info.rentDueDay {
            rentDueDay = String(dueDay)
        }

        if let startStr = info.leaseStartDate {
            leaseStartDate = ISO8601DateFormatter().date(from: startStr)
        }
        if let endStr = info.leaseEndDate {
            leaseEndDate = ISO8601DateFormatter().date(from: endStr)
        }

        landlordPhone = info.landlordPhone ?? ""
        landlordEmail = info.landlordEmail ?? ""
    }

    private func startPolling() {
        pollingTimer?.invalidate()
        pollingTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            self.pollCount += 1

            if self.pollCount >= self.maxPollAttempts {
                timer.invalidate()
                Task { @MainActor in
                    self.state = .error("Document processing is taking too long. Please try again later.")
                }
                return
            }

            Task { @MainActor in
                do {
                    let info = try await self.fetchExtraction()

                    if info.extractionStatus == "completed" {
                        timer.invalidate()
                        self.populateFields(from: info)
                        self.extractedInfo = info
                        self.state = .extractionComplete(info)
                    } else if info.extractionStatus == "failed" {
                        timer.invalidate()
                        self.state = .error(info.extractionError ?? "Processing failed")
                    }
                    // Otherwise continue polling
                } catch {
                    // Ignore polling errors, continue trying
                }
            }
        }
    }
}

// MARK: - Extracted Rental Info Model

struct ExtractedRentalInfo: Codable, Identifiable {
    let id: String
    let userId: String
    let extractionStatus: String
    let extractionError: String?
    let tenantName: String?
    let landlordName: String?
    let propertyAddress: String?
    let propertyCity: String?
    let propertyState: String?
    let propertyPincode: String?
    let monthlyRentPaise: Int?
    let securityDepositPaise: Int?
    let rentDueDay: Int?
    let leaseStartDate: String?
    let leaseEndDate: String?
    let landlordPhone: String?
    let landlordEmail: String?
    let documentPath: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case extractionStatus = "extraction_status"
        case extractionError = "extraction_error"
        case tenantName = "tenant_name"
        case landlordName = "landlord_name"
        case propertyAddress = "property_address"
        case propertyCity = "property_city"
        case propertyState = "property_state"
        case propertyPincode = "property_pincode"
        case monthlyRentPaise = "monthly_rent_paise"
        case securityDepositPaise = "security_deposit_paise"
        case rentDueDay = "rent_due_day"
        case leaseStartDate = "lease_start_date"
        case leaseEndDate = "lease_end_date"
        case landlordPhone = "landlord_phone"
        case landlordEmail = "landlord_email"
        case documentPath = "document_path"
        case createdAt = "created_at"
    }
}

// MARK: - Request/Response Types

private struct ConfirmExtractionRequest: Encodable {
    let extractionId: String
    let tenantName: String
    let landlordName: String
    let propertyAddress: String
    let propertyCity: String
    let propertyState: String?
    let propertyPincode: String?
    let monthlyRentPaise: Int
    let securityDepositPaise: Int?
    let rentDueDay: Int
    let leaseStartDate: String?
    let leaseEndDate: String?
    let landlordPhone: String?
    let landlordEmail: String?

    enum CodingKeys: String, CodingKey {
        case extractionId = "extraction_id"
        case tenantName = "tenant_name"
        case landlordName = "landlord_name"
        case propertyAddress = "property_address"
        case propertyCity = "property_city"
        case propertyState = "property_state"
        case propertyPincode = "property_pincode"
        case monthlyRentPaise = "monthly_rent_paise"
        case securityDepositPaise = "security_deposit_paise"
        case rentDueDay = "rent_due_day"
        case leaseStartDate = "lease_start_date"
        case leaseEndDate = "lease_end_date"
        case landlordPhone = "landlord_phone"
        case landlordEmail = "landlord_email"
    }
}

private struct ConfirmExtractionResponse: Decodable {
    let success: Bool
    let data: ResponseData?
    let error: String?

    struct ResponseData: Decodable {
        let tenancyId: String
        let userStatus: String

        enum CodingKeys: String, CodingKey {
            case tenancyId = "tenancy_id"
            case userStatus = "user_status"
        }
    }
}

// MARK: - Preview Helpers

extension AgreementReviewViewModel {
    static var preview: AgreementReviewViewModel {
        AgreementReviewViewModel(extractionId: "test-id")
    }

    static var previewWithData: AgreementReviewViewModel {
        let vm = AgreementReviewViewModel(extractionId: "test-id")
        vm.tenantName = "Amit Kumar"
        vm.landlordName = "Rajesh Gupta"
        vm.propertyAddress = "Prestige Lakeside Habitat, Tower A, Flat 1204"
        vm.propertyCity = "Bangalore"
        vm.propertyState = "Karnataka"
        vm.propertyPincode = "560103"
        vm.monthlyRent = "40000"
        vm.securityDeposit = "80000"
        vm.rentDueDay = "5"
        vm.landlordPhone = "+919876543211"
        vm.state = .extractionComplete(ExtractedRentalInfo(
            id: "test-id",
            userId: "user-id",
            extractionStatus: "completed",
            extractionError: nil,
            tenantName: "Amit Kumar",
            landlordName: "Rajesh Gupta",
            propertyAddress: "Prestige Lakeside Habitat",
            propertyCity: "Bangalore",
            propertyState: "Karnataka",
            propertyPincode: "560103",
            monthlyRentPaise: 4000000,
            securityDepositPaise: 8000000,
            rentDueDay: 5,
            leaseStartDate: nil,
            leaseEndDate: nil,
            landlordPhone: "+919876543211",
            landlordEmail: nil,
            documentPath: nil,
            createdAt: "2026-01-26T10:00:00Z"
        ))
        return vm
    }

    static var previewPending: AgreementReviewViewModel {
        let vm = AgreementReviewViewModel(extractionId: "test-id")
        vm.state = .extractionPending
        return vm
    }

    static var previewError: AgreementReviewViewModel {
        let vm = AgreementReviewViewModel(extractionId: "test-id")
        vm.state = .error("Failed to process document")
        return vm
    }
}
