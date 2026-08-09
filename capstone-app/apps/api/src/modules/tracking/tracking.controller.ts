import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { query } from "../../config/database";
import { sendError, sendSuccess } from "../../utils/response";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const checkpointSchema = z.object({
  manifestId: z.string().min(1),
  checkpointId: z.string().min(1),
});

const hazardSchema = z.object({
  trailId: z.string().min(1),
  incidentType: z.enum([
    "blockage",
    "landslide_risk",
    "trail_damage",
    "wasp_infestation",
    "medical",
  ]),
  description: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  imageProofUrl: z.string().url().optional(),
});

const sosSchema = z.object({
  manifestId: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  emergencyDetails: z.string().min(1),
});

export async function logCheckpointPassage(req: Request, res: Response) {
  const parsed = checkpointSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid checkpoint payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = await query(
    `INSERT INTO checkpoint_passage_log (
      passage_log_id,
      manifest_id,
      hiker_id,
      checkpoint_id,
      arrival_timestamp
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING *`,
    [
      crypto.randomUUID(),
      parsed.data.manifestId,
      authReq.auth.userId,
      parsed.data.checkpointId,
    ]
  );

  return sendSuccess(res, { checkpointLog: result.rows[0] }, 201);
}

export async function createHazardLog(req: Request, res: Response) {
  const parsed = hazardSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid hazard payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = await query(
    `INSERT INTO hazard_log (
      hazard_id,
      trail_id,
      reported_by_user_id,
      incident_type,
      description,
      latitude,
      longitude,
      image_proof_url,
      timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *`,
    [
      crypto.randomUUID(),
      parsed.data.trailId,
      authReq.auth.userId,
      parsed.data.incidentType,
      parsed.data.description,
      parsed.data.latitude,
      parsed.data.longitude,
      parsed.data.imageProofUrl ?? null,
    ]
  );

  return sendSuccess(res, { hazard: result.rows[0] }, 201);
}

export async function createSOSAlert(req: Request, res: Response) {
  const parsed = sosSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid SOS payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = await query(
    `INSERT INTO sos_alert (
      sos_id,
      manifest_id,
      hiker_id,
      last_known_latitude,
      last_known_longitude,
      emergency_details,
      status,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
    RETURNING *`,
    [
      crypto.randomUUID(),
      parsed.data.manifestId,
      authReq.auth.userId,
      parsed.data.latitude,
      parsed.data.longitude,
      parsed.data.emergencyDetails,
    ]
  );

  return sendSuccess(res, { sos: result.rows[0] }, 201);
}
