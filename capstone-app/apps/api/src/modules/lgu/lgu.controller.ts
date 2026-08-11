import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { pool, query } from "../../config/database";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { hashPassword } from "../../utils/password";
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

const createGuideSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  licenseNumber: z.string().min(1),
  contactNumber: z.string().min(1),
  availabilityStatus: z.enum(["available", "on_trail", "suspended"]).optional(),
});

const approveManifestSchema = z.object({
  guideId: z.string().uuid(),
});

const lguAccessRequestSchema = z.object({
  email: z.string().email(),
  lguName: z.string().min(1),
  province: z.string().min(1).optional(),
  municipalityCity: z.string().min(1).optional(),
  officeName: z.string().min(1).optional(),
  contactPerson: z.string().min(1).optional(),
  contactNumber: z.string().min(1).optional(),
  officeAddress: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
});

const updateLguCredentialsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
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

export async function listGuides(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = await query(
    `SELECT g.guide_id, g.lgu_official_id, g.email, g.first_name, g.last_name,
            g.license_number, g.contact_number, g.availability_status, g.created_at
     FROM accredited_guide g
     WHERE g.lgu_official_id = $1
     ORDER BY g.last_name ASC, g.first_name ASC`
    , [authReq.auth.userId]
  );

  return sendSuccess(res, { guides: result.rows, count: result.rows.length });
}

export async function createGuide(req: Request, res: Response) {
  const parsed = createGuideSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid accredited guide payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const guideId = crypto.randomUUID();
  if (!pool) {
    return sendError(res, "DATABASE_URL is not configured", 500);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingUser = await client.query<{ user_id: string }>(
      "SELECT user_id FROM users WHERE email = $1 LIMIT 1",
      [parsed.data.email]
    );
    if (existingUser.rows[0]) {
      await client.query("ROLLBACK");
      return sendError(res, "That email is already registered", 409);
    }

    const passwordHash = hashPassword(parsed.data.password);

    await client.query(
      `INSERT INTO users (
        user_id,
        email,
        password_hash,
        role,
        first_name,
        last_name,
        address,
        profile_picture
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        guideId,
        parsed.data.email,
        passwordHash,
        "guide",
        parsed.data.firstName,
        parsed.data.lastName,
        "LGU-issued guide account",
        null,
      ]
    );

    const guideResult = await client.query(
      `INSERT INTO accredited_guide (
        guide_id,
        lgu_official_id,
        first_name,
        last_name,
        license_number,
        email,
        contact_number,
        availability_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING guide_id, lgu_official_id, first_name, last_name,
                license_number, email, contact_number,
                availability_status, created_at`,
      [
        guideId,
        authReq.auth.userId,
        parsed.data.firstName,
        parsed.data.lastName,
        parsed.data.licenseNumber,
        parsed.data.email,
        parsed.data.contactNumber,
        parsed.data.availabilityStatus ?? "available",
      ]
    );

    await client.query("COMMIT");

    return sendSuccess(
      res,
      {
        guide: {
          ...guideResult.rows[0],
          role: "guide",
        },
        credentials: {
          email: parsed.data.email,
          password: parsed.data.password,
        },
      },
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteGuide(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const guideId = req.params.guideId;
  if (!guideId) {
    return sendError(res, "Guide ID is required", 400);
  }

  const assignedManifest = await query<{ manifest_id: string }>(
    `SELECT manifest_id
     FROM expedition_manifest
     WHERE guide_id = $1
       AND booking_status IN ('pending_lgu_review', 'approved')
     LIMIT 1`,
    [guideId]
  );

  if (assignedManifest.rows[0]) {
    return sendError(
      res,
      "This guide is assigned to an active manifest and cannot be deleted.",
      409
    );
  }

  if (!pool) {
    return sendError(res, "DATABASE_URL is not configured", 500);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
    `DELETE FROM accredited_guide
       WHERE guide_id = $1 AND lgu_official_id = $2
       RETURNING guide_id, first_name, last_name`,
      [guideId, authReq.auth.userId]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return sendError(res, "Accredited guide not found", 404);
    }

    await client.query("DELETE FROM users WHERE user_id = $1 AND role = 'guide'", [
      guideId,
    ]);

    await client.query("COMMIT");
    return sendSuccess(res, { deletedGuide: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function approveManifest(req: Request, res: Response) {
  const parsed = approveManifestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "A valid guideId is required to approve a manifest", 400, parsed.error.flatten());
  }

  const manifestId = req.params.manifestId;
  if (!manifestId) {
    return sendError(res, "Manifest ID is required", 400);
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const guideResult = await query<{ guide_id: string }>(
    `SELECT guide_id
     FROM accredited_guide
     WHERE guide_id = $1
       AND lgu_official_id = $2
       AND availability_status = 'available'
     LIMIT 1`,
    [parsed.data.guideId, authReq.auth.userId]
  );

  if (!guideResult.rows[0]) {
    return sendError(res, "Guide not found or not currently available", 409);
  }

  const result = await query(
    `UPDATE expedition_manifest
     SET booking_status = 'approved', guide_id = $1
     WHERE manifest_id = $2
       AND booking_status = 'pending_lgu_review'
     RETURNING *`,
    [parsed.data.guideId, manifestId]
  );

  if (!result.rows[0]) {
    return sendError(
      res,
      "Manifest not found or it is not waiting for LGU approval",
      409
    );
  }

  return sendSuccess(res, { manifest: result.rows[0] });
}

export async function submitLguAccessRequest(req: Request, res: Response) {
  const parsed = lguAccessRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid LGU access request payload", 400, parsed.error.flatten());
  }

  const requestId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO lgu_access_request (
      request_id,
      email,
      lgu_name,
      province,
      municipality_city,
      office_name,
      contact_person,
      contact_number,
      office_address,
      message,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
    RETURNING *`,
    [
      requestId,
      parsed.data.email,
      parsed.data.lguName,
      parsed.data.province ?? null,
      parsed.data.municipalityCity ?? null,
      parsed.data.officeName ?? parsed.data.lguName,
      parsed.data.contactPerson ?? null,
      parsed.data.contactNumber ?? null,
      parsed.data.officeAddress ?? null,
      parsed.data.message ?? null,
    ]
  );

  return sendSuccess(
    res,
    {
      request: result.rows[0],
      message:
        "Your request has been received. A super admin can review it and create your LGU account.",
    },
    201
  );
}

export async function updateOwnLguCredentials(req: Request, res: Response) {
  const parsed = updateLguCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid credential payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  if (!pool) {
    return sendError(res, "DATABASE_URL is not configured", 500);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (parsed.data.email) {
      const existing = await client.query<{ user_id: string }>(
        "SELECT user_id FROM users WHERE email = $1 AND user_id <> $2 LIMIT 1",
        [parsed.data.email, authReq.auth.userId]
      );
      if (existing.rows[0]) {
        await client.query("ROLLBACK");
        return sendError(res, "That email is already in use", 409);
      }

      await client.query(
        "UPDATE users SET email = $1 WHERE user_id = $2 AND role = 'lgu_official'",
        [parsed.data.email, authReq.auth.userId]
      );
    }

    if (parsed.data.password) {
      const passwordHash = hashPassword(parsed.data.password);
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE user_id = $2 AND role = 'lgu_official'",
        [passwordHash, authReq.auth.userId]
      );
    }

    const result = await client.query(
      `SELECT user_id, email, role, first_name, last_name, address, profile_picture
       FROM users
       WHERE user_id = $1 AND role = 'lgu_official'
       LIMIT 1`,
      [authReq.auth.userId]
    );

    await client.query("COMMIT");
    return sendSuccess(res, { lguAccount: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
