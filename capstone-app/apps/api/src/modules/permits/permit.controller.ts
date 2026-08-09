import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { generatePermitSignature } from "../../utils/qr_crypto";
import { sendError, sendSuccess } from "../../utils/response";

const issueSchema = z.object({
  manifestId: z.string().min(1),
  userId: z.string().min(1),
});

export async function issuePermit(req: Request, res: Response) {
  const parsed = issueSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid permit payload", 400, parsed.error.flatten());
  }

  const manifestResult = await query<{
    manifest_id: string;
    manifest_room_code: string;
  }>(
    "SELECT manifest_id, manifest_room_code FROM expedition_manifest WHERE manifest_id = $1 LIMIT 1",
    [parsed.data.manifestId]
  );

  const manifest = manifestResult.rows[0];
  if (!manifest) {
    return sendError(res, "Manifest not found", 404);
  }

  const issuedAt = new Date();
  const validFrom = issuedAt;
  const validUntil = new Date(issuedAt.getTime() + 1000 * 60 * 60 * 24 * 30);
  const permitPayload = JSON.stringify({
    manifestId: manifest.manifest_id,
    roomCode: manifest.manifest_room_code,
    issuedAt: issuedAt.toISOString(),
  });

  const signature = generatePermitSignature(permitPayload);
  const permitId = crypto.randomUUID();

  const result = await query(
    `INSERT INTO digital_permit (
      permit_id,
      manifest_id,
      user_id,
      qr_cryptographic_signature,
      issued_at,
      valid_from,
      valid_until,
      permit_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      permitId,
      manifest.manifest_id,
      parsed.data.userId,
      signature,
      issuedAt,
      validFrom,
      validUntil,
      "active",
    ]
  );

  return sendSuccess(res, {
    permit: result.rows[0],
    permitVerificationUrl: env.qrHmacSecret ? signature : null,
  }, 201);
}
