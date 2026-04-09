/**
 * Flent Secured v2 - Reprocess Route (Cloud Run)
 *
 * POST /reprocess
 * Reprocesses failed extractions, either specific IDs or all failed.
 *
 * Auth: X-Extraction-Secret header (validated by middleware)
 * Body: { extraction_ids?: string[] } -- optional, defaults to all failed
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { runExtractionPipeline } from "../services/extraction-pipeline.js";

export const reprocessRouter = Router();

reprocessRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { extraction_ids } = req.body as {
        extraction_ids?: string[];
      };

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        res.status(500).json({
          error: "Missing Supabase configuration",
        });
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // If specific IDs provided, validate them
      let idsToProcess: string[];

      if (extraction_ids && extraction_ids.length > 0) {
        // Validate all IDs are strings
        if (!extraction_ids.every((id) => typeof id === "string")) {
          res.status(400).json({
            error: "All extraction_ids must be strings",
          });
          return;
        }
        idsToProcess = extraction_ids;
      } else {
        // Query all failed extractions
        const { data: failedExtractions, error: queryError } =
          await supabase
            .from("extracted_rental_info")
            .select("id, user_id")
            .in("extraction_status", ["failed", "error"])
            .order("created_at", { ascending: false })
            .limit(100);

        if (queryError) {
          res.status(500).json({
            error: `Failed to query failed extractions: ${queryError.message}`,
          });
          return;
        }

        idsToProcess = (failedExtractions ?? []).map(
          (e: Record<string, any>) => e.id as string
        );
      }

      if (idsToProcess.length === 0) {
        res.status(200).json({
          message: "No extractions to reprocess",
          processed: 0,
          results: [],
        });
        return;
      }

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: `Reprocessing ${idsToProcess.length} extraction(s)`,
          extraction_ids: idsToProcess,
          timestamp: new Date().toISOString(),
        })
      );

      // Fetch extraction records to get user_ids
      const { data: extractions, error: fetchError } = await supabase
        .from("extracted_rental_info")
        .select("id, user_id")
        .in("id", idsToProcess);

      if (fetchError) {
        res.status(500).json({
          error: `Failed to fetch extraction records: ${fetchError.message}`,
        });
        return;
      }

      // Process each sequentially (concurrency=1 on Cloud Run)
      const results: Array<{
        extraction_id: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const extraction of extractions ?? []) {
        const record = extraction as Record<string, any>;
        try {
          const result = await runExtractionPipeline({
            extractionId: record.id as string,
            userId: record.user_id as string,
          });

          results.push({
            extraction_id: record.id as string,
            success: result.success,
          });

          console.log(
            JSON.stringify({
              severity: "INFO",
              message: "Reprocessed extraction",
              extraction_id: record.id,
              success: result.success,
              timestamp: new Date().toISOString(),
            })
          );
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          results.push({
            extraction_id: record.id as string,
            success: false,
            error: errorMessage,
          });

          console.error(
            JSON.stringify({
              severity: "ERROR",
              message: "Reprocessing failed",
              extraction_id: record.id,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            })
          );
        }
      }

      const successCount = results.filter((r) => r.success).length;

      res.status(200).json({
        message: `Reprocessed ${results.length} extraction(s): ${successCount} succeeded, ${results.length - successCount} failed`,
        processed: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
        results,
      });
    } catch (err) {
      next(err);
    }
  }
);
