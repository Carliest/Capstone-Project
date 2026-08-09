import crypto from "crypto";

const iterations = 120_000;
const keyLength = 64;
const digest = "sha512";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, keyLength, digest)
    .toString("hex");

  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto
    .pbkdf2Sync(password, salt, iterations, keyLength, digest)
    .toString("hex");

  const hashBuffer = Buffer.from(hash);
  const candidateBuffer = Buffer.from(candidate);

  if (hashBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
}
