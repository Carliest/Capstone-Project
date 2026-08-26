import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../../config/database";
import { searchPlace } from "../../mapbox";
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

const manifestParamsSchema = z.object({
  manifestId: z.string().min(1),
});

const createTrailMaterialSchema = z.object({
  manifestId: z.string().min(1),
  title: z.string().min(1),
  materialType: z.enum(["video", "pdf", "file", "link"]),
  resourceUrl: z.string().url().optional(),
  description: z.string().min(1).optional(),
});

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
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
     WHERE UPPER(m.manifest_room_code) = $1
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
    [normalizeRoomCode(parsed.data.roomCode)]
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
    "SELECT manifest_id AS id FROM expedition_manifest WHERE UPPER(manifest_room_code) = $1 LIMIT 1",
    [normalizeRoomCode(parsed.data.roomCode)]
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
    `WITH my_memberships AS (
      SELECT DISTINCT ON (mh.manifest_id)
        mh.manifest_item_id,
        mh.manifest_id,
        mh.hiker_readiness_status,
        mh.joined_at
      FROM manifest_hiker mh
      WHERE mh.hiker_id = $1
      ORDER BY mh.manifest_id, mh.joined_at DESC, mh.manifest_item_id DESC
    )
     SELECT
      my_memberships.manifest_item_id,
      my_memberships.manifest_id,
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
      my_memberships.hiker_readiness_status,
      my_memberships.joined_at,
      COALESCE(COUNT(DISTINCT mh2.hiker_id), 0)::int AS joined_count
     FROM my_memberships
     INNER JOIN expedition_manifest m ON m.manifest_id = my_memberships.manifest_id
     LEFT JOIN trail t ON t.trail_id = m.trail_id
     LEFT JOIN mountain ON mountain.mountain_id = t.mountain_id
     LEFT JOIN users organizer ON organizer.user_id = m.organizer_id
     LEFT JOIN accredited_guide guide ON guide.guide_id = m.guide_id
     LEFT JOIN manifest_hiker mh2 ON mh2.manifest_id = m.manifest_id
     GROUP BY
      my_memberships.manifest_item_id,
      my_memberships.manifest_id,
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
      my_memberships.hiker_readiness_status,
      my_memberships.joined_at
     ORDER BY my_memberships.joined_at DESC`,
    [authReq.auth.userId]
  );

  return sendSuccess(res, {
    groups: result.rows,
    count: result.rows.length,
  });
}

async function assertManifestAccess(manifestId: string, userId: string) {
  const result = await query<{
    manifest_id: string;
    organizer_id: string;
    guide_id: string | null;
  }>(
    `SELECT manifest_id, organizer_id, guide_id
     FROM expedition_manifest
     WHERE manifest_id = $1
       AND (
         organizer_id = $2
         OR guide_id = $2
         OR EXISTS (
           SELECT 1
           FROM manifest_hiker
           WHERE manifest_hiker.manifest_id = expedition_manifest.manifest_id
             AND manifest_hiker.hiker_id = $2
         )
       )
     LIMIT 1`,
    [manifestId, userId]
  );

  return result.rows[0] ?? null;
}

export async function listManifestPeople(req: Request, res: Response) {
  const parsed = manifestParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, "Manifest ID is required", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifest = await query<{ manifest_id: string }>(
    "SELECT manifest_id FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [parsed.data.manifestId]
  );
  if (!manifest.rows[0]) {
    return sendError(res, "Manifest not found", 404);
  }

  const result = await query<{
    person_id: string;
    display_name: string;
    email: string | null;
    joined_at: string | null;
    hiker_readiness_status: string | null;
    sort_order: number;
  }>(
    `SELECT *
     FROM (
       SELECT
         m.organizer_id::text AS person_id,
         'organizer'::text AS manifest_role,
         m.organizer_id::text AS display_name,
         NULL::text AS email,
         NULL::timestamp AS joined_at,
         NULL::text AS hiker_readiness_status,
         0 AS sort_order
       FROM expedition_manifest m
       WHERE m.manifest_id = $1

       UNION ALL

       SELECT
         m.guide_id::text AS person_id,
         'guide'::text AS manifest_role,
         m.guide_id::text AS display_name,
         NULL::text AS email,
         NULL::timestamp AS joined_at,
         NULL::text AS hiker_readiness_status,
         1 AS sort_order
       FROM expedition_manifest m
       WHERE m.manifest_id = $1
         AND m.guide_id IS NOT NULL

       UNION ALL

       SELECT
         mh.hiker_id::text AS person_id,
         'hiker'::text AS manifest_role,
         mh.hiker_id::text AS display_name,
         NULL::text AS email,
         mh.joined_at,
         mh.hiker_readiness_status,
         2 AS sort_order
       FROM manifest_hiker mh
       WHERE mh.manifest_id = $1
     ) people
     ORDER BY people.sort_order ASC, people.joined_at ASC NULLS LAST, people.person_id ASC`,
    [parsed.data.manifestId]
  );

  return sendSuccess(res, {
    people: result.rows,
    count: result.rows.length,
  });
}

export async function listManifestTrail(req: Request, res: Response) {
  const parsed = manifestParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, "Manifest ID is required", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifest = await query<{
    manifest_id: string;
    trail_id: string | null;
    trail_name: string | null;
    mountain_name: string | null;
    location_description: string | null;
    daily_carrying_capacity: number | null;
    current_trail_occupancy: number | null;
    difficulty_rating: string | null;
  }>(
    `SELECT
      m.manifest_id,
      m.trail_id,
      t.trail_name,
      mountain.mountain_name,
      mountain.location_description,
      t.daily_carrying_capacity,
      t.current_trail_occupancy,
      t.difficulty_rating
     FROM expedition_manifest m
     LEFT JOIN trail t ON t.trail_id = m.trail_id
     LEFT JOIN mountain ON mountain.mountain_id = t.mountain_id
     WHERE m.manifest_id = $1
       AND (
         m.organizer_id = $2
         OR m.guide_id = $2
         OR EXISTS (
           SELECT 1
           FROM manifest_hiker
           WHERE manifest_hiker.manifest_id = m.manifest_id
             AND manifest_hiker.hiker_id = $2
         )
       )
     LIMIT 1`,
    [parsed.data.manifestId, authReq.auth.userId]
  );

  const manifestRow = manifest.rows[0];
  if (!manifestRow) {
    return sendError(res, "Manifest not found", 404);
  }

  const gpsQuery =
    [manifestRow.trail_name, manifestRow.mountain_name]
      .filter(Boolean)
      .join(", ") || manifestRow.location_description || manifestRow.trail_name || "Mt. Isarog";
  const gps = await searchPlace(gpsQuery);

  if (!manifestRow.trail_id) {
    return sendSuccess(res, {
      trail: null,
      gps,
    });
  }

  const checkpoints = await query<{
    checkpoint_id: string;
    checkpoint_name: string;
    sequence_number: number;
    static_qr_payload: string;
    arrival_timestamp: string | null;
  }>(
    `SELECT
      cs.checkpoint_id,
      cs.checkpoint_name,
      cs.sequence_number,
      cs.static_qr_payload,
      cpl.arrival_timestamp
     FROM checkpoint_station cs
     LEFT JOIN checkpoint_passage_log cpl
       ON cpl.checkpoint_id = cs.checkpoint_id
      AND cpl.manifest_id = $1
      AND cpl.hiker_id = $2
     WHERE cs.trail_id = $3
     ORDER BY cs.sequence_number ASC`,
    [parsed.data.manifestId, authReq.auth.userId, manifestRow.trail_id]
  );

  const checkpointRows = checkpoints.rows;
  const completedCount = checkpointRows.filter((row) => row.arrival_timestamp).length;
  const nextCheckpoint =
    checkpointRows.find((row) => !row.arrival_timestamp) ?? checkpointRows[0] ?? null;

  return sendSuccess(res, {
    trail: {
      manifestId: manifestRow.manifest_id,
      trailId: manifestRow.trail_id,
      trailName: manifestRow.trail_name,
      mountainName: manifestRow.mountain_name,
      locationDescription: manifestRow.location_description,
      difficultyRating: manifestRow.difficulty_rating,
      dailyCarryingCapacity: manifestRow.daily_carrying_capacity,
      currentTrailOccupancy: manifestRow.current_trail_occupancy,
      progress: {
        completedCount,
        totalCount: checkpointRows.length,
        nextCheckpointName: nextCheckpoint?.checkpoint_name ?? null,
      },
      checkpoints: checkpointRows,
    },
    gps,
  });
}

export async function listManifestRequirements(req: Request, res: Response) {
  const parsed = manifestParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, "Manifest ID is required", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifest = await query<{ manifest_id: string }>(
    "SELECT manifest_id FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [parsed.data.manifestId]
  );
  if (!manifest.rows[0]) {
    return sendError(res, "Manifest not found", 404);
  }

  const membership = await query<{ manifest_item_id: string }>(
    `SELECT manifest_item_id
     FROM manifest_hiker
     WHERE manifest_id = $1
       AND hiker_id = $2
     LIMIT 1`,
    [parsed.data.manifestId, authReq.auth.userId]
  );

  const manifestItemId = membership.rows[0]?.manifest_item_id ?? null;

  const trailMaterials = await query<{
    trail_material_id: string;
    manifest_id: string;
    title: string;
    material_type: string;
    resource_url: string | null;
    description: string | null;
    created_at: string;
  }>(
    `SELECT
      trail_material_id,
      manifest_id,
      title,
      material_type,
      resource_url,
      description,
      created_at
     FROM trail_resource_material
     WHERE manifest_id = $1
     ORDER BY created_at ASC, title ASC`,
    [parsed.data.manifestId]
  );

  const complianceDocuments = manifestItemId
    ? await query<{
        document_id: string;
        document_type_id: string;
        document_name: string;
        uploaded_file_url: string;
        verification_status: string;
        created_at: string;
      }>(
        `SELECT
          d.document_id,
          d.document_type_id,
          t.document_name,
          d.uploaded_file_url,
          d.verification_status,
          d.created_at
         FROM hiker_compliance_document d
         INNER JOIN lgu_required_document t ON t.document_type_id = d.document_type_id
         WHERE d.manifest_item_id = $1
         ORDER BY d.created_at DESC, t.document_name ASC`,
        [manifestItemId]
      )
    : { rows: [] as Array<{
        document_id: string;
        document_type_id: string;
        document_name: string;
        uploaded_file_url: string;
        verification_status: string;
        created_at: string;
      }> };

  return sendSuccess(res, {
    requirements: {
      manifestId: parsed.data.manifestId,
      manifestItemId,
      trailMaterials: trailMaterials.rows,
      complianceDocuments: complianceDocuments.rows,
    },
  });
}

export async function listManifestTrailMaterials(req: Request, res: Response) {
  const parsed = manifestParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, "Manifest ID is required", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifest = await query<{ manifest_id: string }>(
    "SELECT manifest_id FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [parsed.data.manifestId]
  );
  if (!manifest.rows[0]) {
    return sendError(res, "Manifest not found", 404);
  }

  const result = await query<{
    trail_material_id: string;
    manifest_id: string;
    title: string;
    material_type: string;
    resource_url: string | null;
    description: string | null;
    created_at: string;
  }>(
    `SELECT
      trail_material_id,
      manifest_id,
      title,
      material_type,
      resource_url,
      description,
      created_at
     FROM trail_resource_material
     WHERE manifest_id = $1
     ORDER BY created_at ASC, title ASC`,
    [parsed.data.manifestId]
  );

  return sendSuccess(res, {
    trailMaterials: result.rows,
    count: result.rows.length,
  });
}

export async function createManifestTrailMaterial(req: Request, res: Response) {
  const parsed = createTrailMaterialSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid trail material payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const manifest = await query<{ manifest_id: string }>(
    "SELECT manifest_id FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [parsed.data.manifestId]
  );
  if (!manifest.rows[0]) {
    return sendError(res, "Manifest not found", 404);
  }

  const materialId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO trail_resource_material (
      trail_material_id,
      manifest_id,
      lgu_official_id,
      title,
      material_type,
      resource_url,
      description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      materialId,
      parsed.data.manifestId,
      authReq.auth.userId,
      parsed.data.title,
      parsed.data.materialType,
      parsed.data.resourceUrl ?? null,
      parsed.data.description ?? null,
    ]
  );

  return sendSuccess(res, { trailMaterial: result.rows[0] }, 201);
}
