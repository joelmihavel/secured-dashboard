/**
 * Heartbeat service for long-running extraction pipeline.
 * Updates the extraction record periodically so the client
 * (and recovery cron) can detect stuck extractions.
 *
 * Writes to `gemini_raw_response` column with current step and timestamp.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export class Heartbeat {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentStep: string = 'initializing';
  private readonly supabase: SupabaseClient;
  private readonly extractionId: string;
  private readonly intervalMs: number;

  /**
   * @param supabase - Supabase service client
   * @param extractionId - extraction record ID to update
   * @param intervalMs - heartbeat interval in milliseconds (default 30s)
   */
  constructor(
    supabase: SupabaseClient,
    extractionId: string,
    intervalMs: number = 30_000
  ) {
    this.supabase = supabase;
    this.extractionId = extractionId;
    this.intervalMs = intervalMs;
  }

  /**
   * Start sending periodic heartbeats.
   * Each heartbeat updates `gemini_raw_response` with the current step
   * and a `last_heartbeat` timestamp.
   */
  start(): void {
    if (this.intervalId) return; // Already running

    this.intervalId = setInterval(async () => {
      try {
        await this.supabase
          .from('extracted_rental_info')
          .update({
            gemini_raw_response: {
              step: this.currentStep,
              last_heartbeat: new Date().toISOString(),
              started_at: new Date().toISOString(),
            },
          })
          .eq('id', this.extractionId);
      } catch (err) {
        // Non-fatal: heartbeat failure should not crash the pipeline
        console.warn('[heartbeat] Failed to update heartbeat:', err instanceof Error ? err.message : String(err));
      }
    }, this.intervalMs);

    console.log(`[heartbeat] Started for extraction ${this.extractionId} (every ${this.intervalMs / 1000}s)`);
  }

  /**
   * Update the current processing step name.
   * The next heartbeat tick will include this step name.
   * Also performs an immediate update to the database.
   */
  async updateStep(step: string): Promise<void> {
    this.currentStep = step;
    console.log(`[heartbeat] Step: ${step}`);

    try {
      await this.supabase
        .from('extracted_rental_info')
        .update({
          gemini_raw_response: {
            step,
            last_heartbeat: new Date().toISOString(),
            started_at: new Date().toISOString(),
          },
        })
        .eq('id', this.extractionId);
    } catch (err) {
      console.warn('[heartbeat] Failed to update step:', err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Stop sending heartbeats.
   * Call this when the pipeline completes (success or failure).
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`[heartbeat] Stopped for extraction ${this.extractionId}`);
    }
  }
}
