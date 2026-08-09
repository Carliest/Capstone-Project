import { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({
    status: "ok",
    data,
  });
}

export function sendError(
  res: Response,
  message: string,
  status = 500,
  details?: unknown
) {
  return res.status(status).json({
    status: "error",
    message,
    ...(details === undefined ? {} : { details }),
  });
}
