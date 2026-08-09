import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../../config/database";
import { sendError, sendSuccess } from "../../utils/response";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const createSchema = z.object({
  trailId: z.string().min(1),
  guideId: z.string().min(1).optional(),
  climbDate: z.string().min(1),
});

const joinSchema = z.object({
  roomCode: z.string().min(4),
});

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createManifest(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid manifest payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifestId = crypto.randomUUID();
  const roomCode = generateRoomCode();
  const result = await query(
    `INSERT INTO expedition_manifest (
      manifest_id,
      organizer_id,
      trail_id,
      guide_id,
      manifest_room_code,
      climb_date,
      booking_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      manifestId,
      authReq.auth.userId,
      parsed.data.trailId,
      parsed.data.guideId ?? null,
      roomCode,
      parsed.data.climbDate,
      "draft",
    ]
  );

  return sendSuccess(res, {
    roomCode,
    manifest: result.rows[0],
  }, 201);
}

export async function joinManifest(req: Request, res: Response) {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid join payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifestResult = await query<{ id: string }>(
    "SELECT manifest_id AS id FROM expedition_manifest WHERE manifest_room_code = $1 LIMIT 1",
    [parsed.data.roomCode]
  );

  const manifest = manifestResult.rows[0];
  if (!manifest) {
    return sendError(res, "Room code not found", 404);
  }

  const result = await query(
    `INSERT INTO manifest_hiker (manifest_id, hiker_user_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [manifest.id, authReq.auth.userId]
  );

  return sendSuccess(res, {
    manifestHiker: result.rows[0],
  }, 201);
}
