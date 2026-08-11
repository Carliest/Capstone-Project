import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../../config/database";
import { sendError, sendSuccess } from "../../utils/response";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const createSchema = z.object({
  trailId: z.string().min(1),
  climbDate: z.string().min(1),
});

const joinSchema = z.object({
  roomCode: z.string().min(4),
});

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function findBookableTrailById(trailId: string) {
  const result = await query<{
    trail_id: string;
    trail_name: string;
    mountain_id: string;
    mountain_name: string;
    active_safety_status: string;
    daily_carrying_capacity: number;
    current_trail_occupancy: number;
  }>(
    `SELECT
      trail_id,
      trail_name,
      mountain_id,
      mountain_name,
      active_safety_status,
      daily_carrying_capacity,
      current_trail_occupancy
     FROM trail
     LEFT JOIN mountain USING (mountain_id)
     WHERE trail_id = $1
     LIMIT 1`,
    [trailId]
  );

  return result.rows[0] ?? null;
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

  const trail = await findBookableTrailById(parsed.data.trailId);
  if (!trail) {
    return sendError(
      res,
      "No trail is available for this ID. Please create or select an existing trail first.",
      404
    );
  }

  if (trail.active_safety_status !== "open") {
    return sendError(
      res,
      "That trail is currently not open for booking.",
      409
    );
  }

  if (Number(trail.current_trail_occupancy) >= Number(trail.daily_carrying_capacity)) {
    return sendError(
      res,
      "That trail is already at full carrying capacity.",
      409
    );
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
      null,
      roomCode,
      parsed.data.climbDate,
      "pending_lgu_review",
    ]
  );

  return sendSuccess(res, {
    roomCode,
    manifest: result.rows[0],
  }, 201);
}

export async function listAvailableTrails(_req: Request, res: Response) {
  const result = await query(
    `SELECT *
     FROM trail
     LEFT JOIN mountain USING (mountain_id)
     WHERE active_safety_status = 'open'
       AND current_trail_occupancy < daily_carrying_capacity
     ORDER BY trail_name ASC`
  );

  return sendSuccess(res, {
    availableTrails: result.rows,
    count: result.rows.length,
  });
}

export async function listMountains(_req: Request, res: Response) {
  const result = await query(
    "SELECT * FROM mountain ORDER BY mountain_name ASC"
  );

  return sendSuccess(res, {
    mountains: result.rows,
    count: result.rows.length,
  });
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
    `INSERT INTO manifest_hiker (
      manifest_item_id,
      manifest_id,
      hiker_id,
      joined_at,
      hiker_readiness_status
    ) VALUES ($1, $2, $3, NOW(), $4)
     RETURNING *`,
    [
      crypto.randomUUID(),
      manifest.id,
      authReq.auth.userId,
      "incomplete",
    ]
  );

  return sendSuccess(res, {
    manifestHiker: result.rows[0],
  }, 201);
}
