import { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { hashPassword, verifyPassword } from "../../utils/password";
import { sendError, sendSuccess } from "../../utils/response";
import { signJwt } from "../../utils/jwt";
import type { UserRole } from "../../types/user";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["hiker", "organizer"]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().min(1),
  profilePicture: z.string().url().optional(),
  profile: z
    .object({
      emergencyContactName: z.string().min(1).optional(),
      emergencyContactNumber: z.string().min(1).optional(),
      climbingHistory: z.string().optional(),
      contactNumber: z.string().min(1).optional(),
      organizerName: z.string().min(1).optional(),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid registration payload", 400, parsed.error.flatten());
  }

  const { email, password, role, firstName, lastName, address, profilePicture } = parsed.data;
  const profile = parsed.data.profile ?? {};
  const passwordHash = hashPassword(password);
  const userId = crypto.randomUUID();

  const existing = await query<{ id: string }>(
    "SELECT user_id FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  if (existing.rows.length > 0) {
    return sendError(res, "Email is already registered", 409);
  }

  const userResult = await query<{
    user_id: string;
    email: string;
    role: UserRole;
    first_name: string;
    last_name: string;
    address: string;
    profile_picture: string | null;
  }>(
    `INSERT INTO users (
      user_id,
      email,
      password_hash,
      role,
      first_name,
      last_name,
      address,
      profile_picture
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING user_id, email, role, first_name, last_name, address, profile_picture`,
    [
      userId,
      email,
      passwordHash,
      role,
      firstName,
      lastName,
      address,
      profilePicture ?? null,
    ]
  );

  const user = userResult.rows[0];

  if (role === "hiker") {
    await query(
      `INSERT INTO hiker_profile (
        hiker_id,
        emergency_contact_name,
        emergency_contact_number,
        climbing_history
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (hiker_id) DO NOTHING`,
      [
        user.user_id,
        profile.emergencyContactName ?? `${firstName} ${lastName}`,
        profile.emergencyContactNumber ?? null,
        profile.climbingHistory ?? null,
      ]
    );
  }

  if (role === "organizer") {
    await query(
      `INSERT INTO organizer_profile (
        organizer_id,
        contact_number,
        organizer_name
      ) VALUES ($1, $2, $3)
      ON CONFLICT (organizer_id) DO NOTHING`,
      [
        user.user_id,
        profile.contactNumber ?? null,
        profile.organizerName ?? `${firstName} ${lastName}`,
      ]
    );
  }

  const token = signJwt(
    {
      sub: user.user_id,
      role,
    },
    env.jwtSecret
  );

  return sendSuccess(
    res,
    {
      user,
      token,
    },
    201
  );
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid login payload", 400, parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const result = await query<{
    user_id: string;
    email: string;
    role: UserRole;
    password_hash: string;
    first_name: string;
    last_name: string;
    address: string;
    profile_picture: string | null;
  }>(
    `SELECT user_id, email, role, password_hash, first_name, last_name, address, profile_picture
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return sendError(res, "Invalid credentials", 401);
  }

  const token = signJwt(
    {
      sub: user.user_id,
      role: user.role,
    },
    env.jwtSecret
  );

  return sendSuccess(res, {
    user: {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      address: user.address,
      profile_picture: user.profile_picture,
    },
    token,
  });
}
