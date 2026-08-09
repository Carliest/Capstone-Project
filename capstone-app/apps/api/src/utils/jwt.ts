import crypto from "crypto";

type JwtPayload = Record<string, unknown> & {
  sub?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

const encodeBase64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const decodeBase64Url = (input: string) =>
  Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );

export function signJwt(
  payload: JwtPayload,
  secret: string,
  expiresInSeconds = 60 * 60 * 24
) {
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerPart = encodeBase64Url(JSON.stringify(header));
  const payloadPart = encodeBase64Url(JSON.stringify(fullPayload));
  const data = `${headerPart}.${payloadPart}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64");

  const signaturePart = signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${data}.${signaturePart}`;
}

export function verifyJwt(token: string, secret: string) {
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const [headerPart, payloadPart, signaturePart] = token.split(".");

  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("Invalid token format");
  }

  const data = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (signaturePart !== expectedSignature) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(decodeBase64Url(payloadPart)) as JwtPayload;
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token has expired");
  }

  return payload;
}
