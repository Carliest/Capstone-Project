import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { query } from "../../config/database";
import { sendError, sendSuccess } from "../../utils/response";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const listSchema = z.object({
  manifestId: z.string().min(1),
});

const uploadSchema = z.object({
  manifestItemId: z.string().min(1),
  documentTypeId: z.string().min(1),
  uploadedFileUrl: z.string().url(),
});

const verifySchema = z.object({
  documentId: z.string().min(1),
  verificationStatus: z.enum(["pending_review", "verified", "rejected"]),
});

const createDocumentTypeSchema = z.object({
  manifestId: z.string().min(1),
  documentName: z.string().min(1),
  description: z.string().min(1).optional(),
  isRequired: z.boolean().optional(),
});

async function assertManifestOwner(manifestId: string, userId: string) {
  const result = await query<{
    manifest_id: string;
    organizer_id: string;
  }>(
    `SELECT manifest_id, organizer_id
     FROM expedition_manifest
     WHERE manifest_id = $1
     LIMIT 1`,
    [manifestId]
  );

  const manifest = result.rows[0];
  if (!manifest) {
    return { ok: false as const, status: 404, message: "Manifest not found" };
  }

  if (manifest.organizer_id !== userId) {
    return {
      ok: false as const,
      status: 403,
      message: "Only the room creator can manage compliance templates",
    };
  }

  return { ok: true as const };
}

export async function listDocumentTypes(req: Request, res: Response) {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, "Manifest ID is required", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const ownershipCheck = await assertManifestOwner(parsed.data.manifestId, authReq.auth.userId);
  if (!ownershipCheck.ok) {
    return sendError(res, ownershipCheck.message, ownershipCheck.status);
  }

  const result = await query(
    `SELECT document_type_id, manifest_id, created_by_organizer_id, document_name, description,
            is_required, created_at
     FROM manifest_required_document
     WHERE manifest_id = $1
     ORDER BY document_name ASC`
    ,
    [parsed.data.manifestId]
  );

  return sendSuccess(res, {
    documentTypes: result.rows,
    count: result.rows.length,
  });
}

export async function createDocumentType(req: Request, res: Response) {
  const parsed = createDocumentTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid document type payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  if (authReq.auth.role !== "organizer") {
    return sendError(res, "Only organizers can create compliance templates", 403);
  }

  const ownershipCheck = await assertManifestOwner(
    parsed.data.manifestId,
    authReq.auth.userId
  );
  if (!ownershipCheck.ok) {
    return sendError(res, ownershipCheck.message, ownershipCheck.status);
  }

  const documentTypeId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO manifest_required_document (
      document_type_id,
      manifest_id,
      created_by_organizer_id,
      document_name,
      description,
      is_required
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING document_type_id, manifest_id, created_by_organizer_id, document_name, description,
              is_required, created_at`,
    [
      documentTypeId,
      parsed.data.manifestId,
      authReq.auth.userId,
      parsed.data.documentName,
      parsed.data.description ?? null,
      parsed.data.isRequired ?? true,
    ]
  );

  return sendSuccess(res, { documentType: result.rows[0] }, 201);
}

export async function uploadComplianceDocument(req: Request, res: Response) {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid compliance payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const membership = await query<{
    manifest_item_id: string;
    manifest_id: string;
  }>(
    `SELECT mh.manifest_item_id, mh.manifest_id
     FROM manifest_hiker mh
     WHERE mh.manifest_item_id = $1
       AND mh.hiker_id = $2
     LIMIT 1`,
    [parsed.data.manifestItemId, authReq.auth.userId]
  );
  if (!membership.rows[0]) {
    return sendError(res, "Manifest membership not found", 403);
  }

  const documentType = await query<{ document_type_id: string }>(
    `SELECT document_type_id
     FROM manifest_required_document
     WHERE document_type_id = $1
       AND manifest_id = $2
     LIMIT 1`,
    [parsed.data.documentTypeId, membership.rows[0].manifest_id]
  );
  if (!documentType.rows[0]) {
    return sendError(res, "Document type not found for this manifest", 404);
  }

  const result = await query(
    `INSERT INTO hiker_compliance_document (
      document_id,
      manifest_item_id,
      document_type_id,
      uploaded_file_url,
      verification_status
    ) VALUES ($1, $2, $3, $4, 'pending_review')
    RETURNING *`,
    [
      crypto.randomUUID(),
      parsed.data.manifestItemId,
      parsed.data.documentTypeId,
      parsed.data.uploadedFileUrl,
    ]
  );

  return sendSuccess(res, { document: result.rows[0] }, 201);
}

export async function verifyComplianceDocument(req: Request, res: Response) {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid verification payload", 400, parsed.error.flatten());
  }

  const result = await query(
    `UPDATE hiker_compliance_document
     SET verification_status = $2
     WHERE document_id = $1
     RETURNING *`,
    [
      parsed.data.documentId,
      parsed.data.verificationStatus,
    ]
  );

  return sendSuccess(res, { document: result.rows[0] });
}
