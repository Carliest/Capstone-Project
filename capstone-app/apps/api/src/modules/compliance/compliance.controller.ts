import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { query } from "../../config/database";
import { sendError, sendSuccess } from "../../utils/response";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

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
  documentName: z.string().min(1),
  description: z.string().min(1).optional(),
  isRequired: z.boolean().optional(),
});

export async function listDocumentTypes(_req: Request, res: Response) {
  const result = await query(
    `SELECT document_type_id, lgu_official_id, document_name, description,
            is_required, created_at
     FROM lgu_required_document
     ORDER BY document_name ASC`
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

  const documentTypeId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO lgu_required_document (
      document_type_id,
      lgu_official_id,
      document_name,
      description,
      is_required
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING document_type_id, lgu_official_id, document_name, description,
              is_required, created_at`,
    [
      documentTypeId,
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

  const documentType = await query<{ document_type_id: string }>(
    "SELECT document_type_id FROM lgu_required_document WHERE document_type_id = $1 LIMIT 1",
    [parsed.data.documentTypeId]
  );
  if (!documentType.rows[0]) {
    return sendError(res, "Document type not found", 404);
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
