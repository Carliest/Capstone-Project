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

const lookupSchema = z.object({
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

export async function lookupManifestByRoomCode(req: Request, res: Response) {
  const parsed = lookupSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, "Invalid room code", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = await query<{
    manifest_id: string;
    manifest_room_code: string;
    climb_date: string | null;
    booking_status: string;
    trail_id: string | null;
    trail_name: string | null;
    trail_class: string | null;
    difficulty_rating: string | null;
    daily_carrying_capacity: number | null;
    current_trail_occupancy: number | null;
    mountain_name: string | null;
    location_description: string | null;
    organizer_first_name: string | null;
    organizer_last_name: string | null;
    guide_first_name: string | null;
    guide_last_name: string | null;
    joined_count: number;
  }>(
    `SELECT
      m.manifest_id,
      m.manifest_room_code,
      m.climb_date,
      m.booking_status,
      m.trail_id,
      t.trail_name,
      t.trail_class,
      t.difficulty_rating,
      t.daily_carrying_capacity,
      t.current_trail_occupancy,
      mountain.mountain_name,
      mountain.location_description,
      organizer.first_name AS organizer_first_name,
      organizer.last_name AS organizer_last_name,
      guide.first_name AS guide_first_name,
      guide.last_name AS guide_last_name,
      COALESCE(COUNT(mh.manifest_item_id), 0)::int AS joined_count
     FROM expedition_manifest m
     LEFT JOIN trail t ON t.trail_id = m.trail_id
     LEFT JOIN mountain ON mountain.mountain_id = t.mountain_id
     LEFT JOIN users organizer ON organizer.user_id = m.organizer_id
     LEFT JOIN accredited_guide guide ON guide.guide_id = m.guide_id
     LEFT JOIN manifest_hiker mh ON mh.manifest_id = m.manifest_id
     WHERE m.manifest_room_code = $1
     GROUP BY
      m.manifest_id,
      m.manifest_room_code,
      m.climb_date,
      m.booking_status,
      m.trail_id,
      t.trail_name,
      t.trail_class,
      t.difficulty_rating,
      t.daily_carrying_capacity,
      t.current_trail_occupancy,
      mountain.mountain_name,
      mountain.location_description,
      organizer.first_name,
      organizer.last_name,
      guide.first_name,
      guide.last_name
     LIMIT 1`,
    [parsed.data.roomCode.toUpperCase()]
  );

  const manifest = result.rows[0];
  if (!manifest) {
    return sendError(res, "Room code not found", 404);
  }

  return sendSuccess(res, {
    manifest: {
      ...manifest,
      organizer_name:
        [manifest.organizer_first_name, manifest.organizer_last_name]
          .filter(Boolean)
          .join(" ") || null,
      guide_name:
        [manifest.guide_first_name, manifest.guide_last_name]
          .filter(Boolean)
          .join(" ") || null,
      capacity_total: manifest.daily_carrying_capacity,
      capacity_used: manifest.current_trail_occupancy,
      description:
        manifest.trail_name && manifest.mountain_name
          ? `A summit expedition to ${manifest.trail_name} on ${manifest.mountain_name}.`
          : "Expedition details are being prepared by the organizer.",
    },
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

  const existingMembership = await query(
    `SELECT manifest_item_id
     FROM manifest_hiker
     WHERE manifest_id = $1
       AND hiker_id = $2
     LIMIT 1`,
    [manifest.id, authReq.auth.userId]
  );

  if (existingMembership.rows.length > 0) {
    return sendSuccess(res, {
      manifestHiker: existingMembership.rows[0],
      message: "You are already in this group",
    });
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

export async function listMyGroups(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = await query<{
    manifest_item_id: string;
    manifest_id: string;
    manifest_room_code: string;
    climb_date: string | null;
    booking_status: string;
    trail_name: string | null;
    trail_class: string | null;
    difficulty_rating: string | null;
    daily_carrying_capacity: number | null;
    current_trail_occupancy: number | null;
    mountain_name: string | null;
    location_description: string | null;
    organizer_name: string | null;
    guide_name: string | null;
    hiker_readiness_status: string;
    joined_at: string;
    joined_count: number;
  }>(
    `SELECT
      mh.manifest_item_id,
      mh.manifest_id,
      m.manifest_room_code,
      m.climb_date,
      m.booking_status,
      t.trail_name,
      t.trail_class,
      t.difficulty_rating,
      t.daily_carrying_capacity,
      t.current_trail_occupancy,
      mountain.mountain_name,
      mountain.location_description,
      organizer.first_name || ' ' || organizer.last_name AS organizer_name,
      guide.first_name || ' ' || guide.last_name AS guide_name,
      mh.hiker_readiness_status,
      mh.joined_at,
      COALESCE(COUNT(mh2.manifest_item_id), 0)::int AS joined_count
     FROM manifest_hiker mh
     INNER JOIN expedition_manifest m ON m.manifest_id = mh.manifest_id
     LEFT JOIN trail t ON t.trail_id = m.trail_id
     LEFT JOIN mountain ON mountain.mountain_id = t.mountain_id
     LEFT JOIN users organizer ON organizer.user_id = m.organizer_id
     LEFT JOIN accredited_guide guide ON guide.guide_id = m.guide_id
     LEFT JOIN manifest_hiker mh2 ON mh2.manifest_id = m.manifest_id
     WHERE mh.hiker_id = $1
     GROUP BY
      mh.manifest_item_id,
      mh.manifest_id,
      m.manifest_room_code,
      m.climb_date,
      m.booking_status,
      t.trail_name,
      t.trail_class,
      t.difficulty_rating,
      t.daily_carrying_capacity,
      t.current_trail_occupancy,
      mountain.mountain_name,
      mountain.location_description,
      organizer.first_name,
      organizer.last_name,
      guide.first_name,
      guide.last_name,
      mh.hiker_readiness_status,
      mh.joined_at
     ORDER BY mh.joined_at DESC`,
    [authReq.auth.userId]
  );

  return sendSuccess(res, {
    groups: result.rows,
    count: result.rows.length,
  });
}
