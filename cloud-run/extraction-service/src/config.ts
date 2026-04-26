/**
 * config.ts — single source of truth for env reads in extraction-service.
 *
 * Reads every required env var ONCE at module load, validates required
 * fields (logs FATAL + exits if anything's missing), and exports a
 * typed frozen `config` object.
 *
 * RULE: every other file in src/ MUST import from here. Do NOT call
 * process.env.X anywhere else. Enforced by scripts/check-env-isolation.sh.
 *
 * Why this exists: prior to this module, env vars were read directly in
 * index.ts, middleware/auth.ts, routes/reprocess.ts, services/{supabase,
 * notifications,geocoding,extraction-pipeline}.ts, and onboarding/
 * name-matching.ts. Each had its own fallback logic (e.g., SB_SECRET_KEY
 * vs SUPABASE_SERVICE_ROLE_KEY). Centralizing prevents drift and makes
 * the env contract obvious to anyone reading the service.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    console.error(`[config] FATAL: required env var ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value : undefined;
}

// Read once. Subsequent process.env mutations don't affect us.
const RAW_NODE_ENV = process.env.NODE_ENV ?? 'development';
const RAW_PORT = process.env.PORT;

// Supabase keys: support both legacy SB_* fallback (kept for backward
// compat with the earlier deploy.sh) and the canonical SUPABASE_* names.
const RAW_SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.SB_URL;
const RAW_SUPABASE_SERVICE_KEY =
  process.env.SB_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

// Gemini API key: same dual-name pattern from the original code
const RAW_GEMINI_KEY =
  process.env.GEMINI_API_KEY_SECURED ?? process.env.GEMINI_API_KEY;

export const config = Object.freeze({
  nodeEnv: RAW_NODE_ENV as 'development' | 'production' | 'test',
  port: parseInt(RAW_PORT ?? '8080', 10),

  /** Identifies this service to callers via x-extraction-secret header. */
  extractionSecret: required('EXTRACTION_SECRET', process.env.EXTRACTION_SECRET),

  supabase: {
    url: required('SUPABASE_URL (or SB_URL)', RAW_SUPABASE_URL),
    serviceKey: required('SUPABASE_SERVICE_ROLE_KEY (or SB_SECRET_KEY)', RAW_SUPABASE_SERVICE_KEY),
  },

  gcp: {
    projectId: process.env.GCP_PROJECT_ID ?? 'secured-by-flent',
    /** Document AI processor ID (cc5734db2b80908b). */
    processorId: optional(process.env.GCP_PROCESSOR_ID),
    /** Region for Document AI calls. Currently 'us'; per data-residency audit may need to move to 'asia-south1'. */
    location: process.env.GCP_LOCATION ?? 'us',
    /** Document AI service account JSON (base64-encoded or raw). Mounted from Secret Manager in production. */
    docAiCredentials: optional(process.env.GCP_DOCUMENT_AI_CREDENTIALS),
  },

  vertex: {
    projectId: process.env.VERTEX_AI_PROJECT_ID ?? 'flent-ai-project-2',
    credentials: optional(process.env.VERTEX_AI_CREDENTIALS),
    /**
     * Vertex AI endpoint location. Stays at 'global' as a project decision
     * (2026-04-26) — see docs/infrastructure/data-residency.md Finding 2,
     * marked ACCEPTED. The env var is kept configurable for emergency
     * regional pinning but should not be flipped without revisiting the
     * decision.
     */
    location: process.env.VERTEX_AI_LOCATION ?? 'global',
  },

  /** Used for Gemini API-key fallback path (when Vertex AI is unavailable). */
  geminiApiKey: optional(RAW_GEMINI_KEY),

  /** Used by services/geocoding.ts. Optional — geocoding silently no-ops if unset. */
  googleMapsApiKey: optional(process.env.GOOGLE_MAPS_API_KEY),

  /** Stamp verification service URL (set on prod + dev, omitted on local). */
  stampVerification: {
    url: optional(process.env.STAMP_VERIFICATION_SERVICE_URL),
    secret: optional(process.env.STAMP_VERIFICATION_SECRET),
  },

  /** Computed: are we running locally (vs prod / dev cloud)? */
  get isLocal(): boolean {
    const url = RAW_SUPABASE_URL ?? '';
    return url.includes('127.0.0.1') || url.includes('localhost') || url.includes('host.docker.internal');
  },
});

export type Config = typeof config;
