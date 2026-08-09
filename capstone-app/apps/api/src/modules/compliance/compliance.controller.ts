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

export async function uploadComplianceDocument(req: Request, res: Response) {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid compliance payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
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
