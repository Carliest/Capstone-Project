import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { sendError } from "../utils/response";

export function requireSuperAdminKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!env.superAdminApiKey) {
    return sendError(res, "SUPER_ADMIN_API_KEY is not configured", 500);
  }

  const providedKey = req.header("x-super-admin-key");
  if (!providedKey || providedKey !== env.superAdminApiKey) {
    return sendError(res, "Forbidden", 403);
  }

  return next();
}
