import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { sendError } from "../utils/response";
import { verifyJwt } from "../utils/jwt";
import type { UserRole } from "../types/user";

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    role: UserRole;
  };
};

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return sendError(res, "Missing bearer token", 401);
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyJwt(token, env.jwtSecret);
    if (!payload.sub || !payload.role) {
      return sendError(res, "Invalid token payload", 401);
    }

    req.auth = {
      userId: String(payload.sub),
      role: payload.role as UserRole,
    };
    return next();
  } catch (error) {
    return sendError(
      res,
      error instanceof Error ? error.message : "Invalid token",
      401
    );
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return sendError(res, "Authentication required", 401);
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return sendError(res, "Forbidden", 403);
    }

    return next();
  };
}
