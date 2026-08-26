import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { query } from "../../config/database";
import { sendError, sendSuccess } from "../../utils/response";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

const createSchema = z.object({
  manifestId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

const listSchema = z.object({
  manifestId: z.string().min(1).optional(),
});

export async function listAnnouncements(req: Request, res: Response) {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, "Invalid announcement filters", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  const manifestId = parsed.data.manifestId?.trim() ?? "";

  if (manifestId && !authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const result = manifestId
    ? await query(
        `SELECT
          a.*,
          organizer.first_name || ' ' || organizer.last_name AS organizer_name
         FROM announcement a
         LEFT JOIN users organizer ON organizer.user_id = a.organizer_id
         WHERE manifest_id = $1
         ORDER BY a.created_at DESC
         LIMIT 50`,
        [manifestId]
      )
    : await query(
        `SELECT
          a.*,
          organizer.first_name || ' ' || organizer.last_name AS organizer_name
         FROM announcement a
         LEFT JOIN users organizer ON organizer.user_id = a.organizer_id
         ORDER BY a.created_at DESC
         LIMIT 50`
      );

  return sendSuccess(res, { announcements: result.rows });
}

export async function createAnnouncement(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid announcement payload", 400, parsed.error.flatten());
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.auth) {
    return sendError(res, "Authentication required", 401);
  }

  const announcementId = crypto.randomUUID();
  const result = await query(
    `INSERT INTO announcement (announcement_id, manifest_id, organizer_id, title, content, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [
      announcementId,
      parsed.data.manifestId,
      authReq.auth.userId,
      parsed.data.title,
      parsed.data.content,
    ]
  );

  return sendSuccess(res, { announcement: result.rows[0] }, 201);
}
