/**
 * Flent Secured v2 - Audit Logging Helper
 *
 * Provides functions to log audit events to the audit_logs table.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// ==============================================
// TYPES
// ==============================================

export type ActorType = "user" | "system" | "admin" | "service";

export type ActionCategory =
  | "auth"
  | "payment"
  | "verification"
  | "tenancy"
  | "profile"
  | "landlord"
  | "cashback"
  | "notification"
  | "system"
  | "security"
  | "extraction";

export interface AuditContext {
  userId?: string;
  actorType?: ActorType;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  functionName?: string;
}

export interface AuditEvent {
  action: string;
  category: ActionCategory;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  status?: "success" | "failure" | "partial";
  errorCode?: string;
  errorMessage?: string;
}

// ==============================================
// AUDIT LOGGER CLASS
// ==============================================

/**
 * Audit logger for Edge Functions.
 * Automatically captures context and logs to audit_logs table.
 */
export class AuditLogger {
  private context: AuditContext;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, context: AuditContext = {}) {
    this.supabase = supabase;
    this.context = context;
  }

  /**
   * Creates an AuditLogger from a request.
   */
  static fromRequest(
    supabase: SupabaseClient,
    request: Request,
    userId?: string,
    functionName?: string
  ): AuditLogger {
    return new AuditLogger(supabase, {
      userId,
      actorType: userId ? "user" : "system",
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
      functionName,
    });
  }

  /**
   * Logs an audit event.
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      const { error } = await this.supabase.from("audit_logs").insert({
        user_id: this.context.userId,
        actor_type: this.context.actorType ?? "system",
        action: event.action,
        action_category: event.category,
        entity_type: event.entityType,
        entity_id: event.entityId,
        details: event.details,
        old_values: event.oldValues,
        new_values: event.newValues,
        ip_address: this.context.ipAddress,
        user_agent: this.context.userAgent,
        request_id: this.context.requestId,
        function_name: this.context.functionName,
        status: event.status ?? "success",
        error_code: event.errorCode,
        error_message: event.errorMessage,
      });

      if (error) {
        console.error("Failed to write audit log:", error);
      }
    } catch (err) {
      console.error("Audit logging error:", err);
    }
  }

  /**
   * Logs a successful action.
   */
  async logSuccess(
    action: string,
    category: ActionCategory,
    entityType?: string,
    entityId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action,
      category,
      entityType,
      entityId,
      details,
      status: "success",
    });
  }

  /**
   * Logs a failed action.
   */
  async logFailure(
    action: string,
    category: ActionCategory,
    errorCode: string,
    errorMessage: string,
    entityType?: string,
    entityId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action,
      category,
      entityType,
      entityId,
      details,
      status: "failure",
      errorCode,
      errorMessage,
    });
  }

  /**
   * Sets the user context (after authentication).
   */
  setUser(userId: string): void {
    this.context.userId = userId;
    this.context.actorType = "user";
  }
}

// ==============================================
// COMMON AUDIT ACTIONS
// ==============================================

export const AuditActions = {
  // Auth
  OTP_REQUESTED: "OTP_REQUESTED",
  OTP_VERIFIED: "OTP_VERIFIED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  AUTH_OTP_INITIATED: "AUTH_OTP_INITIATED",
  AUTH_OTP_VERIFIED: "AUTH_OTP_VERIFIED",
  AUTH_OTP_FAILED: "AUTH_OTP_FAILED",
  AUTH_SUCCESS: "AUTH_SUCCESS",
  AUTH_RESEND: "AUTH_RESEND",
  AUTH_RATE_LIMITED: "AUTH_RATE_LIMITED",

  // Payment
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_REFUND_INITIATED: "PAYMENT_REFUND_INITIATED",
  PAYMENT_REFUND_COMPLETED: "PAYMENT_REFUND_COMPLETED",

  // Verification
  BANK_VERIFICATION_INITIATED: "BANK_VERIFICATION_INITIATED",
  BANK_VERIFICATION_SUCCESS: "BANK_VERIFICATION_SUCCESS",
  BANK_VERIFICATION_FAILED: "BANK_VERIFICATION_FAILED",
  IDENTITY_VERIFICATION_INITIATED: "IDENTITY_VERIFICATION_INITIATED",
  IDENTITY_VERIFICATION_SUCCESS: "IDENTITY_VERIFICATION_SUCCESS",
  IDENTITY_VERIFICATION_FAILED: "IDENTITY_VERIFICATION_FAILED",
  UTILITY_VERIFICATION_INITIATED: "UTILITY_VERIFICATION_INITIATED",
  UTILITY_VERIFICATION_SUCCESS: "UTILITY_VERIFICATION_SUCCESS",
  UTILITY_VERIFICATION_FAILED: "UTILITY_VERIFICATION_FAILED",
  PAN_VERIFICATION_INITIATED: "PAN_VERIFICATION_INITIATED",
  PAN_VERIFICATION_SUCCESS: "PAN_VERIFICATION_SUCCESS",
  PAN_VERIFICATION_FAILED: "PAN_VERIFICATION_FAILED",

  // Tenancy
  TENANCY_CREATED: "TENANCY_CREATED",
  TENANCY_UPDATED: "TENANCY_UPDATED",
  TENANCY_ACTIVATED: "TENANCY_ACTIVATED",
  TENANCY_TERMINATED: "TENANCY_TERMINATED",

  // Landlord
  LANDLORD_INVITED: "LANDLORD_INVITED",
  LANDLORD_INVITE_SENT: "LANDLORD_INVITE_SENT",
  LANDLORD_APPROVED: "LANDLORD_APPROVED",
  LANDLORD_DISPUTED: "LANDLORD_DISPUTED",
  LANDLORD_OTP_SENT: "LANDLORD_OTP_SENT",
  LANDLORD_OTP_VERIFIED: "LANDLORD_OTP_VERIFIED",

  // Document Processing
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  DOCUMENT_PROCESSED: "DOCUMENT_PROCESSED",
  DOCUMENT_PROCESSING_FAILED: "DOCUMENT_PROCESSING_FAILED",

  // Cashback
  CASHBACK_EARNED: "CASHBACK_EARNED",
  CASHBACK_APPLIED: "CASHBACK_APPLIED",
  CASHBACK_EXPIRED: "CASHBACK_EXPIRED",

  // Notifications
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  NOTIFICATION_FAILED: "NOTIFICATION_FAILED",

  // Transfer Flags
  LANDLORD_TRANSFER_HELD: "LANDLORD_TRANSFER_HELD",
  LANDLORD_SETTLEMENT_SKIPPED: "LANDLORD_SETTLEMENT_SKIPPED",
  HELD_PAYMENTS_RELEASED: "HELD_PAYMENTS_RELEASED",
} as const;

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

/**
 * Extracts client IP from request headers.
 */
function getClientIp(request: Request): string | undefined {
  // cf-connecting-ip is set by Cloudflare — authoritative, not client-spoofable
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // x-real-ip is set by reverse proxy, not client
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return undefined;
}
