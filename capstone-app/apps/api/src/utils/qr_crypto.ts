import crypto from "crypto";
import { env } from "../config/env";

export function generatePermitSignature(data: string) {
  if (!env.qrHmacSecret) {
    throw new Error("QR_HMAC_SECRET is not configured");
  }

  return crypto.createHmac("sha256", env.qrHmacSecret).update(data).digest("hex");
}

export function verifyPermitSignature(data: string, signature: string) {
  if (!env.qrHmacSecret) {
    throw new Error("QR_HMAC_SECRET is not configured");
  }

  const expected = generatePermitSignature(data);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
