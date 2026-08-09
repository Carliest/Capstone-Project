import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { query } from "../../config/database";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { sendError, sendSuccess } from "../../utils/response";

const createMountainSchema = z.object({
  mountainName: z.string().min(1),
  locationDescription: z.string().min(1).optional(),
});

const createTrailSchema = z.object({
  mountainId: z.string().min(1),
  trailName: z.string().min(1),
  trailClass: z.enum(["class_1", "class_2", "class_3", "class_4"]),
  difficultyRating: z.enum(["easy", "moderate", "difficult", "expert"]),
  latitude: z.number(),
  longitude: z.number(),
  dailyCarryingCapacity: z.number().int().positive(),
  activeSafetyStatus: z
    .enum(["open", "closed_weather", "closed_maintenance"])
    .optional(),
  currentTrailOccupancy: z.number().int().nonnegative().optional(),
});

export async function listMountains(_req: Request, res: Response) {
  const result = await query(
    "SELECT * FROM mountain ORDER BY mountain_name ASC"
  );

  return sendSuccess(res, {
    mountains: result.rows,
    count: result.rows.length,
  });
}

export async function createMountain(req: Request, res: Response) {
  const parsed = createMountainSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid mountain payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const mountainId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO mountain (
      mountain_id,
      mountain_name,
      location_description
    ) VALUES ($1, $2, $3)
    RETURNING *`,
    [
      mountainId,
      parsed.data.mountainName,
      parsed.data.locationDescription ?? null,
    ]
  );

  return sendSuccess(res, { mountain: result.rows[0] }, 201);
}

export async function listTrails(_req: Request, res: Response) {
  const result = await query(
    `SELECT
      trail.*,
      mountain.mountain_name
     FROM trail
     LEFT JOIN mountain USING (mountain_id)
     ORDER BY trail.trail_name ASC`
  );

  return sendSuccess(res, {
    trails: result.rows,
    count: result.rows.length,
  });
}

export async function createTrail(req: Request, res: Response) {
  const parsed = createTrailSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid trail payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const mountainResult = await query<{ mountain_id: string }>(
    "SELECT mountain_id FROM mountain WHERE mountain_id = $1 LIMIT 1",
    [parsed.data.mountainId]
  );

  if (!mountainResult.rows[0]) {
    return sendError(res, "Mountain not found", 404);
  }

  const trailId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO trail (
      trail_id,
      mountain_id,
      trail_name,
      trail_class,
      difficulty_rating,
      latitude,
      longitude,
      daily_carrying_capacity,
      active_safety_status,
      current_trail_occupancy
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      trailId,
      parsed.data.mountainId,
      parsed.data.trailName,
      parsed.data.trailClass,
      parsed.data.difficultyRating,
      parsed.data.latitude,
      parsed.data.longitude,
      parsed.data.dailyCarryingCapacity,
      parsed.data.activeSafetyStatus ?? "open",
      parsed.data.currentTrailOccupancy ?? 0,
    ]
  );

  return sendSuccess(res, { trail: result.rows[0] }, 201);
}
