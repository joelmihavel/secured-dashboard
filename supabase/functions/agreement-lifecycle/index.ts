/**
 * Flent Secured v2 - Agreement Lifecycle State Machine (BE-081)
 *
 * Manages agreement status transitions with validation.
 * Supports the full lifecycle: draft -> pending_review -> active -> expired -> terminated
 *
 * Endpoints:
 * - GET  /functions/v1/agreement-lifecycle?tenancy_id=xxx - Get current agreement state
 * - POST /functions/v1/agreement-lifecycle - Transition agreement to new state
 *
 * Auth: Required (User JWT or Service Role for system transitions)
 *
 * Request body (POST):
 * {
 *   tenancy_id: string,
 *   target_status: "pending_review" | "active" | "expired" | "terminated",
 *   reason?: string,
 *   metadata?: object
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
  hasServiceRoleAuth,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  NotFoundError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { isTestMode, mockData } from "../_shared/test-mode.ts";

// ==============================================
// STATE MACHINE CONFIGURATION
// ==============================================

type AgreementStatus = "draft" | "pending_review" | "active" | "expired" | "terminated";

/**
 * Valid state transitions map.
 * Key = current state, Value = array of allowed target states.
 */
const VALID_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  draft: ["pending_review", "terminated"],
  pending_review: ["active", "draft", "terminated"],
  active: ["expired", "terminated"],
  expired: ["terminated"],
  terminated: [], // Terminal state - no transitions out
};

/**
 * Human-readable status labels for notifications.
 */
const STATUS_LABELS: Record<AgreementStatus, string> = {
  draft: "Draft",
  pending_review: "Under Review",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

/**
 * Notification types by transition.
 */
const TRANSITION_NOTIFICATIONS: Record<string, { title: string; body: string; type: string }> = {
  "draft->pending_review": {
    title: "Agreement Submitted for Review",
    body: "Your rental agreement has been submitted and is under review.",
    type: "general",
  },
  "pending_review->active": {
    title: "Agreement Activated",
    body: "Your rental agreement is now active. You can start making rent payments.",
    type: "general",
  },
  "active->expired": {
    title: "Agreement Expired",
    body: "Your rental agreement has expired. Please renew to continue using Flent Secured.",
    type: "general",
  },
  "active->terminated": {
    title: "Agreement Terminated",
    body: "Your rental agreement has been terminated. Contact support if this was unexpected.",
    type: "general",
  },
  "pending_review->draft": {
    title: "Agreement Returned",
    body: "Your agreement has been returned for corrections. Please review and resubmit.",
    type: "general",
  },
};

// ==============================================
// TYPES
// ==============================================

interface TransitionRequest {
  tenancy_id: string;
  target_status: AgreementStatus;
  reason?: string;
  metadata?: Record<string, unknown>;
}

interface AgreementTransition {
  from_status: AgreementStatus;
  to_status: AgreementStatus;
  reason: string | null;
  transitioned_by: string;
  transitioned_at: string;
  metadata: Record<string, unknown> | null;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const transitionSchema = {
  tenancy_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid tenancy ID",
  },
  target_status: {
    required: true,
    type: "string" as const,
    enum: ["pending_review", "active", "expired", "terminated"] as unknown[],
  },
  reason: { required: false, type: "string" as const, maxLength: 500 },
  metadata: { required: false, type: "object" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // MD-131: Test mode support
  if (isTestMode(req)) {
    return handleTestMode(req);
  }

  const supabase = createServiceClient();

  try {
    // Determine actor (user or service role)
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = hasServiceRoleAuth(authHeader);

    let userId: string;
    let actorType: "user" | "system";

    if (isServiceRole) {
      userId = "system";
      actorType = "system";
    } else {
      const { userId: uid } = await createAuthenticatedClient(authHeader);
      userId = uid;
      actorType = "user";
    }

    const audit = AuditLogger.fromRequest(supabase, req, userId === "system" ? undefined : userId, "agreement-lifecycle");

    switch (req.method) {
      case "GET":
        return await handleGetAgreementState(req, supabase, userId, isServiceRole);
      case "POST":
        return await handleTransition(req, supabase, userId, actorType, isServiceRole, audit);
      default:
        return errorResponse("Method not allowed", 405);
    }
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// GET AGREEMENT STATE
// ==============================================

async function handleGetAgreementState(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  isServiceRole: boolean
): Promise<Response> {
  const url = new URL(req.url);
  const tenancyId = url.searchParams.get("tenancy_id");

  if (!tenancyId || !isValidUuid(tenancyId)) {
    throw new ValidationError("Valid tenancy_id is required", {
      tenancy_id: "Required",
    });
  }

  // Build query - service role can access any tenancy
  let query = supabase
    .from("tenancies")
    .select("id, user_id, status, created_at, updated_at, lease_start_date, lease_end_date, landlord_approved")
    .eq("id", tenancyId);

  if (!isServiceRole) {
    query = query.eq("user_id", userId);
  }

  const { data: tenancy, error } = await query.single();

  if (error || !tenancy) {
    throw new NotFoundError("Tenancy", tenancyId);
  }

  // Map tenancy status to agreement status
  const currentStatus = mapTenancyStatus(tenancy.status);

  // Get allowed transitions from current state
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];

  // Fetch transition history from audit logs
  const { data: transitionHistory } = await supabase
    .from("audit_logs")
    .select("action, details, created_at, user_id, actor_type")
    .eq("entity_type", "agreement")
    .eq("entity_id", tenancyId)
    .eq("action_category", "tenancy")
    .order("created_at", { ascending: true })
    .limit(50);

  const transitions: AgreementTransition[] = (transitionHistory ?? []).map((log: any) => ({
    from_status: log.details?.from_status ?? "unknown",
    to_status: log.details?.to_status ?? "unknown",
    reason: log.details?.reason ?? null,
    transitioned_by: log.user_id ?? "system",
    transitioned_at: log.created_at,
    metadata: log.details?.metadata ?? null,
  }));

  return jsonResponse({
    success: true,
    data: {
      tenancy_id: tenancy.id,
      current_status: currentStatus,
      current_status_label: STATUS_LABELS[currentStatus],
      allowed_transitions: allowedTransitions,
      allowed_transition_labels: allowedTransitions.map((s) => ({
        status: s,
        label: STATUS_LABELS[s],
      })),
      lease_start_date: tenancy.lease_start_date,
      lease_end_date: tenancy.lease_end_date,
      landlord_approved: tenancy.landlord_approved,
      transition_history: transitions,
      updated_at: tenancy.updated_at,
    },
  });
}

// ==============================================
// TRANSITION HANDLER
// ==============================================

async function handleTransition(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  actorType: "user" | "system",
  isServiceRole: boolean,
  audit: AuditLogger
): Promise<Response> {
  const body = await req.json();
  const validated = validateSchema<TransitionRequest>(body, transitionSchema, true);

  const { tenancy_id, target_status, reason, metadata } = validated;

  // Fetch current tenancy status
  let query = supabase
    .from("tenancies")
    .select("id, user_id, status, landlord_approved, lease_end_date")
    .eq("id", tenancy_id);

  if (!isServiceRole) {
    query = query.eq("user_id", userId);
  }

  const { data: tenancy, error: fetchError } = await query.single();

  if (fetchError || !tenancy) {
    throw new NotFoundError("Tenancy", tenancy_id);
  }

  const currentStatus = mapTenancyStatus(tenancy.status);
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];

  // Validate transition
  if (!allowedTransitions.includes(target_status)) {
    throw new AppError(
      `Invalid transition: cannot move from '${currentStatus}' to '${target_status}'. ` +
        `Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(", ") : "none (terminal state)"}`,
      "INVALID_TRANSITION",
      400
    );
  }

  // Additional business rules
  validateBusinessRules(currentStatus, target_status, tenancy);

  // Map agreement status back to tenancy status for DB update
  const dbStatus = mapAgreementToTenancyStatus(target_status);

  // Perform the transition
  const updatePayload: Record<string, unknown> = {
    status: dbStatus,
  };

  // Set timestamps for specific transitions
  if (target_status === "terminated") {
    updatePayload.terminated_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("tenancies")
    .update(updatePayload)
    .eq("id", tenancy_id);

  if (updateError) {
    console.error("Failed to transition agreement:", updateError);
    throw new AppError("Failed to update agreement status", "DB_ERROR", 500);
  }

  // Log the transition in audit
  await audit.log({
    action: "AGREEMENT_TRANSITION",
    category: "tenancy",
    entityType: "agreement",
    entityId: tenancy_id,
    details: {
      from_status: currentStatus,
      to_status: target_status,
      reason,
      metadata,
      actor_type: actorType,
    },
    oldValues: { status: currentStatus },
    newValues: { status: target_status },
    status: "success",
  });

  // Send notification if applicable
  const transitionKey = `${currentStatus}->${target_status}`;
  const notification = TRANSITION_NOTIFICATIONS[transitionKey];

  if (notification && tenancy.user_id) {
    try {
      await supabase.rpc("create_notification", {
        p_user_id: tenancy.user_id,
        p_title: notification.title,
        p_body: notification.body,
        p_notification_type: notification.type,
        p_action_type: "navigate",
        p_action_data: { screen: "agreement", tenancy_id },
        p_related_entity_type: "tenancy",
        p_related_entity_id: tenancy_id,
        p_priority: target_status === "terminated" ? "high" : "normal",
      });
    } catch (notifError) {
      // Don't fail the transition if notification fails
      console.error("Failed to send transition notification:", notifError);
    }
  }

  return jsonResponse({
    success: true,
    data: {
      tenancy_id,
      previous_status: currentStatus,
      new_status: target_status,
      new_status_label: STATUS_LABELS[target_status],
      reason,
      transitioned_by: actorType,
      transitioned_at: new Date().toISOString(),
      allowed_next_transitions: VALID_TRANSITIONS[target_status] ?? [],
    },
  });
}

// ==============================================
// BUSINESS RULE VALIDATION
// ==============================================

function validateBusinessRules(
  currentStatus: AgreementStatus,
  targetStatus: AgreementStatus,
  tenancy: any
): void {
  // Cannot activate without landlord approval
  if (targetStatus === "active" && !tenancy.landlord_approved) {
    throw new AppError(
      "Cannot activate agreement: landlord approval is required",
      "LANDLORD_APPROVAL_REQUIRED",
      400
    );
  }

  // Cannot transition to active if lease end date is in the past
  if (targetStatus === "active" && tenancy.lease_end_date) {
    const leaseEnd = new Date(tenancy.lease_end_date);
    if (leaseEnd < new Date()) {
      throw new AppError(
        "Cannot activate agreement: lease end date is in the past",
        "LEASE_EXPIRED",
        400
      );
    }
  }
}

// ==============================================
// STATUS MAPPING
// ==============================================

/**
 * Maps tenancy DB status to agreement lifecycle status.
 * The tenancy table uses a slightly different status enum.
 */
function mapTenancyStatus(tenancyStatus: string): AgreementStatus {
  const mapping: Record<string, AgreementStatus> = {
    pending_verification: "draft",
    active: "active",
    expired: "expired",
    terminated: "terminated",
  };
  return mapping[tenancyStatus] ?? "draft";
}

/**
 * Maps agreement lifecycle status back to tenancy DB status.
 */
function mapAgreementToTenancyStatus(agreementStatus: AgreementStatus): string {
  const mapping: Record<AgreementStatus, string> = {
    draft: "pending_verification",
    pending_review: "pending_verification",
    active: "active",
    expired: "expired",
    terminated: "terminated",
  };
  return mapping[agreementStatus] ?? "pending_verification";
}

// ==============================================
// TEST MODE HANDLER
// ==============================================

function handleTestMode(req: Request): Response {
  if (req.method === "GET") {
    return jsonResponse({
      success: true,
      data: {
        tenancy_id: mockData.agreement.tenancy_id,
        current_status: mockData.agreement.status,
        current_status_label: STATUS_LABELS[mockData.agreement.status as AgreementStatus],
        allowed_transitions: VALID_TRANSITIONS[mockData.agreement.status as AgreementStatus],
        allowed_transition_labels: (
          VALID_TRANSITIONS[mockData.agreement.status as AgreementStatus] ?? []
        ).map((s) => ({ status: s, label: STATUS_LABELS[s] })),
        lease_start_date: "2026-01-01",
        lease_end_date: "2027-01-01",
        landlord_approved: true,
        transition_history: mockData.agreement.transitions,
        updated_at: "2026-02-17T10:00:00.000Z",
      },
    });
  }

  // POST
  return jsonResponse({
    success: true,
    data: {
      tenancy_id: mockData.agreement.tenancy_id,
      previous_status: "active",
      new_status: "expired",
      new_status_label: "Expired",
      reason: "Test transition",
      transitioned_by: "user",
      transitioned_at: new Date().toISOString(),
      allowed_next_transitions: ["terminated"],
    },
  });
}
