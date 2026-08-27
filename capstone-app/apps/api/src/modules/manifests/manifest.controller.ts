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

const createTrailMaterialSchema = z
  .object({
    trailId: z.string().min(1).optional(),
    manifestId: z.string().min(1).optional(),
    title: z.string().min(1),
    materialType: z.enum(["video", "pdf", "file", "link"]),
    resourceUrl: z.string().url().optional(),
    description: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.trailId || value.manifestId), {
    message: "Trail ID or manifest ID is required",
    path: ["trailId"],
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

async function resolveManifestTrailId(manifestId: string) {
  const result = await query<{ trail_id: string | null }>(
    "SELECT trail_id FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [manifestId]
  );

  return result.rows[0]?.trail_id ?? null;
}

async function getTrailMaterialsForManifest(manifestId: string) {
  const trailId = await resolveManifestTrailId(manifestId);
  if (!trailId) {
    return [] as Array<{
      trail_material_id: string;
      trail_id: string | null;
      manifest_id: string | null;
      lgu_official_id: string;
      title: string;
      material_type: string;
      resource_url: string | null;
      description: string | null;
      created_at: string;
    }>;
  }

  const result = await query<{
    trail_material_id: string;
    trail_id: string | null;
    manifest_id: string | null;
    lgu_official_id: string;
    title: string;
    material_type: string;
    resource_url: string | null;
    description: string | null;
    created_at: string;
  }>(
    `SELECT
      trail_material_id,
      trail_id,
      manifest_id,
      lgu_official_id,
      title,
      material_type,
      resource_url,
      description,
      created_at
     FROM trail_resource_material
     WHERE trail_id = $1
        OR manifest_id = $2
     ORDER BY created_at ASC, title ASC`,
    [trailId, manifestId]
  );

  return result.rows;
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

  const manifest = await query<{
    manifest_id: string;
    organizer_id: string;
    guide_id: string | null;
  }>(
    "SELECT manifest_id, organizer_id, guide_id FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [parsed.data.manifestId]
  );
  if (!manifest.rows[0]) {
    return sendError(res, "Manifest not found", 404);
  }

  const manifestRow = manifest.rows[0];
  const organizerResult = await query<{
    person_id: string;
    display_name: string;
    email: string | null;
    profile_picture: string | null;
  }>(
    `SELECT
       m.organizer_id::text AS person_id,
       COALESCE(
         NULLIF(TRIM(COALESCE(organizer.first_name, '') || ' ' || COALESCE(organizer.last_name, '')), ''),
         m.organizer_id::text
       ) AS display_name,
       organizer.email,
       organizer.profile_picture
     FROM expedition_manifest m
     LEFT JOIN users organizer ON organizer.user_id = m.organizer_id
     WHERE m.manifest_id = $1
     LIMIT 1`,
    [parsed.data.manifestId]
  );

  const guideResult = manifestRow.guide_id
      ? await query<{
        person_id: string;
        display_name: string;
        email: string | null;
        profile_picture: string | null;
      }>(
        `SELECT
           m.guide_id::text AS person_id,
           COALESCE(
             NULLIF(TRIM(COALESCE(guide.first_name, '') || ' ' || COALESCE(guide.last_name, '')), ''),
             m.guide_id::text
           ) AS display_name,
           guide.email,
           guide.profile_picture
         FROM expedition_manifest m
         LEFT JOIN users guide ON guide.user_id = m.guide_id
         WHERE m.manifest_id = $1
           AND m.guide_id IS NOT NULL
         LIMIT 1`,
        [parsed.data.manifestId]
      )
    : { rows: [] as Array<{ person_id: string; display_name: string; email: string | null; profile_picture: string | null }> };

  const hikers = await query<{
    person_id: string;
    display_name: string;
    email: string | null;
    profile_picture: string | null;
    joined_at: string | null;
    hiker_readiness_status: string | null;
  }>(
    `SELECT
       mh.hiker_id::text AS person_id,
       COALESCE(
         NULLIF(TRIM(COALESCE(hiker.first_name, '') || ' ' || COALESCE(hiker.last_name, '')), ''),
         mh.hiker_id::text
       ) AS display_name,
       hiker.email,
       hiker.profile_picture,
       mh.joined_at,
       mh.hiker_readiness_status
     FROM manifest_hiker mh
     LEFT JOIN users hiker ON hiker.user_id = mh.hiker_id
     WHERE mh.manifest_id = $1
     ORDER BY mh.joined_at ASC NULLS LAST, mh.hiker_id ASC`,
    [parsed.data.manifestId]
  );

  const result = [
    {
      ...organizerResult.rows[0],
      manifest_role: "organizer" as const,
      joined_at: null,
      hiker_readiness_status: null,
      profile_picture: organizerResult.rows[0].profile_picture,
      sort_order: 0,
    },
    ...(guideResult.rows[0]
      ? [{
          ...guideResult.rows[0],
          manifest_role: "guide" as const,
          joined_at: null,
          hiker_readiness_status: null,
          sort_order: 1,
        }]
      : []),
    ...hikers.rows.map((row) => ({
      person_id: row.person_id,
      manifest_role: "hiker" as const,
      display_name: row.display_name,
      email: row.email,
      profile_picture: row.profile_picture,
      joined_at: row.joined_at,
      hiker_readiness_status: row.hiker_readiness_status,
      sort_order: 2,
    })),
  ];

  return sendSuccess(res, {
    people: result,
    count: result.length,
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
  const trailMaterials = await getTrailMaterialsForManifest(parsed.data.manifestId);

  let requiredDocuments: Array<{
    document_type_id: string;
    manifest_id: string;
    created_by_organizer_id: string;
    document_name: string;
    description: string | null;
    is_required: boolean;
    created_at: string;
  }> = [];

  try {
    const requiredDocumentsResult = await query<{
      document_type_id: string;
      manifest_id: string;
      created_by_organizer_id: string;
      document_name: string;
      description: string | null;
      is_required: boolean;
      created_at: string;
    }>(
      `SELECT
        document_type_id,
        manifest_id,
        created_by_organizer_id,
        document_name,
        description,
        is_required,
        created_at
       FROM manifest_required_document
       WHERE manifest_id = $1
       ORDER BY created_at ASC, document_name ASC`,
      [parsed.data.manifestId]
    );

    requiredDocuments = requiredDocumentsResult.rows;
  } catch {
    requiredDocuments = [];
  }

  let complianceDocuments: Array<{
    document_id: string;
    document_type_id: string;
    document_name: string;
    uploaded_file_url: string;
    verification_status: string;
    created_at: string;
  }> = [];
  if (manifestItemId) {
    try {
      const complianceDocumentsResult = await query<{
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
         INNER JOIN manifest_required_document t ON t.document_type_id = d.document_type_id
         WHERE d.manifest_item_id = $1
         ORDER BY d.created_at DESC, t.document_name ASC`,
        [manifestItemId]
      );

      complianceDocuments = complianceDocumentsResult.rows;
    } catch {
      complianceDocuments = [];
    }
  }

  return sendSuccess(res, {
    requirements: {
      manifestId: parsed.data.manifestId,
      manifestItemId,
      trailMaterials,
      requiredDocuments,
      complianceDocuments,
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

  const result = await getTrailMaterialsForManifest(parsed.data.manifestId);

  return sendSuccess(res, {
    trailMaterials: result,
    count: result.length,
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

  let trailId = parsed.data.trailId?.trim() ?? "";
  const manifestId = parsed.data.manifestId?.trim() ?? "";

  if (!trailId && manifestId) {
    trailId = (await resolveManifestTrailId(manifestId)) ?? "";
  }

  if (!trailId) {
    return sendError(res, "Trail not found", 404);
  }

  const materialId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO trail_resource_material (
      trail_material_id,
      trail_id,
      manifest_id,
      lgu_official_id,
      title,
      material_type,
      resource_url,
      description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      materialId,
      trailId,
      manifestId || null,
      authReq.auth.userId,
      parsed.data.title,
      parsed.data.materialType,
      parsed.data.resourceUrl ?? null,
      parsed.data.description ?? null,
    ]
  );

  return sendSuccess(res, { trailMaterial: result.rows[0] }, 201);
}
