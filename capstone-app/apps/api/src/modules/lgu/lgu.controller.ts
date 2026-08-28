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

const createCheckpointStationSchema = z.object({
  trailId: z.string().uuid(),
  checkpointName: z.string().min(1),
  sequenceNumber: z.number().int().positive(),
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

const buildStaticQrPayload = (data: {
  checkpointId: string;
  trailId: string;
  checkpointName: string;
  sequenceNumber: number;
}) =>
  JSON.stringify({
    checkpointId: data.checkpointId,
    trailId: data.trailId,
    checkpointName: data.checkpointName,
    sequenceNumber: data.sequenceNumber,
  });

const updateLguCredentialsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

const trailMaterialSchema = z.object({
  title: z.string().min(1),
  materialType: z.enum(["video", "pdf", "file", "link"]).optional(),
  resourceUrl: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
});

let trailMaterialSchemaReady: Promise<void> | null = null;

function ensureTrailMaterialSchema() {
  if (!trailMaterialSchemaReady) {
    trailMaterialSchemaReady = (async () => {
      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS trail_material_id UUID;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS trail_id UUID;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS lgu_official_id UUID;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS file_name TEXT;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS mime_type TEXT;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS file_url TEXT;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ADD COLUMN IF NOT EXISTS file_data BYTEA;
      `);

      await query(`
        ALTER TABLE trail_resource_material
          ALTER COLUMN manifest_id DROP NOT NULL;
      `);
    })().catch((error) => {
      trailMaterialSchemaReady = null;
      throw error;
    });
  }

  return trailMaterialSchemaReady;
}

function normalizeMaterialType(
  providedType: string | undefined,
  mimeType: string | undefined,
  fileName: string | undefined,
  resourceUrl: string | undefined
) {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  const normalizedName = fileName?.trim().toLowerCase() ?? "";
  const normalizedUrl = resourceUrl?.trim().toLowerCase() ?? "";

  if (providedType === "link" || /^https?:\/\//i.test(normalizedUrl)) {
    return "link" as const;
  }

  if (
    normalizedMimeType.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|avi|mkv|wmv|3gp|mpe?g)$/i.test(normalizedName)
  ) {
    return "video" as const;
  }

  if (
    normalizedMimeType === "application/pdf" ||
    /\.pdf$/i.test(normalizedName)
  ) {
    return "pdf" as const;
  }

  if (
    normalizedMimeType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i.test(normalizedName)
  ) {
    return "file" as const;
  }

  return providedType ?? "file";
}

function getPublicMaterialFileUrl(req: Request, materialId: string) {
  const host = req.get("host")?.trim();
  if (!host) {
    return `/api/lgu/materials/${materialId}/file`;
  }

  const protocol = req.protocol || "https";
  return `${protocol}://${host}/api/lgu/materials/${materialId}/file`;
}

type ParsedUploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type ParsedMultipartBody = {
  fields: Record<string, string>;
  file: ParsedUploadedFile | null;
};

function getMultipartBoundary(contentType: string) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? null;
}

function parseMultipartBody(body: Buffer, contentType: string): ParsedMultipartBody | null {
  const boundary = getMultipartBoundary(contentType);
  if (!boundary) {
    return null;
  }

  const payload = body.toString("latin1");
  const delimiter = `--${boundary}`;
  const rawParts = payload.split(delimiter);
  const fields: Record<string, string> = {};
  let file: ParsedUploadedFile | null = null;

  for (const rawPart of rawParts) {
    const trimmedPart = rawPart.trim();
    if (!trimmedPart || trimmedPart === "--") {
      continue;
    }

    const part = trimmedPart.startsWith("\r\n") ? trimmedPart.slice(2) : trimmedPart;
    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex < 0) {
      continue;
    }

    const headerLines = part.slice(0, headerEndIndex).split("\r\n");
    const bodySection = part.slice(headerEndIndex + 4).replace(/\r\n$/, "");
    const dispositionLine = headerLines.find((line) =>
      /^content-disposition:/i.test(line)
    );

    if (!dispositionLine) {
      continue;
    }

    const dispositionValue = dispositionLine.split(":").slice(1).join(":").trim();
    const nameMatch = /name="([^"]+)"/i.exec(dispositionValue);
    if (!nameMatch?.[1]) {
      continue;
    }

    const filenameMatch = /filename="([^"]*)"/i.exec(dispositionValue);
    const contentTypeLine = headerLines.find((line) => /^content-type:/i.test(line));
    const partBuffer = Buffer.from(bodySection, "latin1");

    if (filenameMatch?.[1]) {
      file = {
        originalname: filenameMatch[1],
        mimetype: contentTypeLine
          ? contentTypeLine.split(":").slice(1).join(":").trim()
          : "application/octet-stream",
        buffer: partBuffer,
      };
      continue;
    }

    fields[nameMatch[1]] = partBuffer.toString("utf8");
  }

  return { fields, file };
}

function readTrailMaterialPayload(req: Request) {
  const contentType = req.get("content-type") ?? "";
  const body = req.body;

  if (Buffer.isBuffer(body) && /multipart\/form-data/i.test(contentType)) {
    const multipart = parseMultipartBody(body, contentType);
    if (!multipart) {
      return { data: {}, file: null as ParsedUploadedFile | null };
    }

    return { data: multipart.fields, file: multipart.file };
  }

  return {
    data: body && typeof body === "object" ? body : {},
    file: null as ParsedUploadedFile | null,
  };
}

function normalizeOptionalTrailMaterialField(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function ensureLguProfileExists(userId: string) {
  const existingProfile = await query<{ lgu_official_id: string }>(
    "SELECT lgu_official_id FROM lgu_profile WHERE lgu_official_id = $1 LIMIT 1",
    [userId]
  );
  if (existingProfile.rows[0]) {
    return;
  }

  const userResult = await query<{
    first_name: string;
    last_name: string;
    email: string;
    address: string;
  }>(
    "SELECT first_name, last_name, email, address FROM users WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new Error("LGU account not found");
  }

  await query(
    `INSERT INTO lgu_profile (
      lgu_official_id,
      lgu_name,
      province,
      municipality_city,
      office_name,
      contact_person,
      contact_number,
      office_address,
      is_active
    ) VALUES ($1, $2, NULL, NULL, $3, $4, NULL, $5, TRUE)
    ON CONFLICT (lgu_official_id) DO NOTHING`,
    [
      userId,
      `${user.first_name} ${user.last_name}`.trim() || user.email,
      `${user.first_name} ${user.last_name}`.trim() || user.email,
      `${user.first_name} ${user.last_name}`.trim() || user.email,
      user.address,
    ]
  );
}

async function ensureLguAccessRequestTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS lgu_access_request (
      request_id UUID PRIMARY KEY,
      email VARCHAR NOT NULL,
      lgu_name VARCHAR NOT NULL,
      province VARCHAR,
      municipality_city VARCHAR,
      office_name VARCHAR,
      contact_person VARCHAR,
      contact_number VARCHAR,
      office_address TEXT,
      message TEXT,
      status VARCHAR NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
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

export async function listTrailMaterials(req: Request, res: Response) {
  await ensureTrailMaterialSchema();

  const trailId = String(req.params.trailId ?? "").trim();
  if (!trailId) {
    return sendError(res, "Trail ID is required", 400);
  }

  const trailResult = await query<{ trail_id: string }>(
    "SELECT trail_id FROM trail WHERE trail_id = $1 LIMIT 1",
    [trailId]
  );
  if (!trailResult.rows[0]) {
    return sendError(res, "Trail not found", 404);
  }

  const result = await query(
    `SELECT
      trail_material_id,
      trail_id,
      manifest_id,
      lgu_official_id,
      title,
      material_type,
      file_name,
      mime_type,
      file_url,
      resource_url,
      description,
      created_at
     FROM trail_resource_material
     WHERE trail_id = $1
     ORDER BY created_at ASC, title ASC`,
    [trailId]
  );

  return sendSuccess(res, {
    trailMaterials: result.rows,
    count: result.rows.length,
  });
}

export async function createTrailMaterial(req: Request, res: Response) {
  await ensureTrailMaterialSchema();

  const payload = readTrailMaterialPayload(req);
  const rawData = payload.data as Record<string, unknown>;
  const parsed = trailMaterialSchema.safeParse({
    title: typeof rawData.title === "string" ? rawData.title.trim() : rawData.title,
    materialType: normalizeOptionalTrailMaterialField(rawData.materialType),
    resourceUrl: normalizeOptionalTrailMaterialField(rawData.resourceUrl),
    description: normalizeOptionalTrailMaterialField(rawData.description),
    fileName: normalizeOptionalTrailMaterialField(rawData.fileName),
    mimeType: normalizeOptionalTrailMaterialField(rawData.mimeType),
  });
  if (!parsed.success) {
    return sendError(res, "Invalid trail material payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  try {
    await ensureLguProfileExists(authReq.auth.userId);
  } catch (error) {
    return sendError(
      res,
      error instanceof Error ? error.message : "Unable to provision LGU profile",
      400
    );
  }

  const trailId = String(req.params.trailId ?? "").trim();
  if (!trailId) {
    return sendError(res, "Trail ID is required", 400);
  }

  const trailResult = await query<{ trail_id: string }>(
    "SELECT trail_id FROM trail WHERE trail_id = $1 LIMIT 1",
    [trailId]
  );
  if (!trailResult.rows[0]) {
    return sendError(res, "Trail not found", 404);
  }

  const materialId = crypto.randomUUID();
  const materialType = normalizeMaterialType(
    parsed.data.materialType,
    parsed.data.mimeType,
    parsed.data.fileName,
    parsed.data.resourceUrl
  );
  const uploadedFile = payload.file;
  const publicFileUrl = getPublicMaterialFileUrl(req, materialId);
  const normalizedFileName = parsed.data.fileName ?? uploadedFile?.originalname ?? null;
  const normalizedMimeType = parsed.data.mimeType ?? uploadedFile?.mimetype ?? null;
  const fileBuffer = uploadedFile?.buffer ?? null;

  if (materialType !== "link" && !uploadedFile) {
    return sendError(res, "A file upload is required for this material type", 400);
  }

  let result;
  try {
    result = await query(
      `INSERT INTO trail_resource_material (
        trail_material_id,
        trail_id,
        manifest_id,
        lgu_official_id,
        title,
        material_type,
        file_name,
        mime_type,
        file_url,
        file_data,
        resource_url,
        description
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        materialId,
        trailId,
        authReq.auth.userId,
        parsed.data.title,
        materialType,
        normalizedFileName,
        normalizedMimeType,
        publicFileUrl,
        fileBuffer,
        parsed.data.resourceUrl ?? null,
        parsed.data.description ?? null,
      ]
    );
  } catch (error) {
    return sendError(
      res,
      error instanceof Error ? error.message : "Unable to save trail material",
      500
    );
  }

  return sendSuccess(res, { trailMaterial: result.rows[0] }, 201);
}

export async function getTrailMaterialFile(req: Request, res: Response) {
  await ensureTrailMaterialSchema();

  const materialId = String(req.params.materialId ?? "").trim();
  if (!materialId) {
    return sendError(res, "Material ID is required", 400);
  }

  const result = await query<{
    trail_material_id: string;
    file_name: string | null;
    mime_type: string | null;
    file_data: Buffer | null;
    resource_url: string | null;
  }>(
    `SELECT trail_material_id, file_name, mime_type, file_data, resource_url
     FROM trail_resource_material
     WHERE trail_material_id = $1
     LIMIT 1`,
    [materialId]
  );

  const material = result.rows[0];
  if (!material) {
    return sendError(res, "Material not found", 404);
  }

  if (!material.file_data) {
    if (material.resource_url) {
      return res.redirect(material.resource_url);
    }

    return sendError(res, "No file is attached to this material", 404);
  }

  res.setHeader("Content-Type", material.mime_type ?? "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${(material.file_name ?? "file").replace(/"/g, '\\"')}"`
  );
  return res.send(material.file_data);
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

export async function listCheckpointStations(_req: Request, res: Response) {
  const result = await query(
    `SELECT checkpoint_id, trail_id, checkpoint_name, sequence_number, static_qr_payload
     FROM checkpoint_station
     ORDER BY trail_id ASC, sequence_number ASC`
  );

  return sendSuccess(res, {
    checkpointStations: result.rows,
    count: result.rows.length,
  });
}

export async function createCheckpointStation(req: Request, res: Response) {
  const parsed = createCheckpointStationSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      "Invalid checkpoint station payload",
      400,
      parsed.error.flatten()
    );
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const trailResult = await query<{ trail_id: string }>(
    "SELECT trail_id FROM trail WHERE trail_id = $1 LIMIT 1",
    [parsed.data.trailId]
  );
  if (!trailResult.rows[0]) {
    return sendError(res, "Trail not found", 404);
  }

  const checkpointId = crypto.randomUUID();
  const staticQrPayload = buildStaticQrPayload({
    checkpointId,
    trailId: parsed.data.trailId,
    checkpointName: parsed.data.checkpointName,
    sequenceNumber: parsed.data.sequenceNumber,
  });

  const result = await query(
    `INSERT INTO checkpoint_station (
      checkpoint_id,
      trail_id,
      checkpoint_name,
      sequence_number,
      static_qr_payload
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      checkpointId,
      parsed.data.trailId,
      parsed.data.checkpointName,
      parsed.data.sequenceNumber,
      staticQrPayload,
    ]
  );

  return sendSuccess(res, { checkpointStation: result.rows[0] }, 201);
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

  await ensureLguAccessRequestTable();

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
