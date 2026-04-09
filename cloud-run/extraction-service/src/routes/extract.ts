/**
 * Flent Secured v2 - Extract Route (Cloud Run)
 *
 * POST /extract
 * Triggers the extraction pipeline for a given extraction_id and user_id.
 *
 * Auth: X-Extraction-Secret header (validated by middleware)
 * Body: { extraction_id: string, user_id: string }
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { runExtractionPipeline } from "../services/extraction-pipeline.js";

export const extractRouter = Router();

extractRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { extraction_id, user_id } = req.body as {
        extraction_id?: string;
        user_id?: string;
      };

      // Validate required fields
      if (!extraction_id || typeof extraction_id !== "string") {
        res.status(400).json({
          error: "Missing or invalid extraction_id",
          extraction_id: extraction_id ?? null,
        });
        return;
      }

      if (!user_id || typeof user_id !== "string") {
        res.status(400).json({
          error: "Missing or invalid user_id",
          extraction_id,
        });
        return;
      }

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "Starting extraction pipeline",
          extraction_id,
          user_id,
          timestamp: new Date().toISOString(),
        })
      );

      const result = await runExtractionPipeline({
        extractionId: extraction_id,
        userId: user_id,
      });

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "Extraction pipeline completed",
          extraction_id,
          user_id,
          success: result.success,
          timestamp: new Date().toISOString(),
        })
      );

      res.status(200).json({
        ...result,
        extraction_id,
        user_id,
      });
    } catch (err) {
      next(err);
    }
  }
);
