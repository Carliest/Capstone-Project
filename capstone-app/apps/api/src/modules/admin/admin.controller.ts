import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { pool, query } from "../../config/database";
import { hashPassword } from "../../utils/password";
import { sendError, sendSuccess } from "../../utils/response";

const createLguAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().min(1),
  lguName: z.string().min(1),
  province: z.string().min(1).optional(),
  municipalityCity: z.string().min(1).optional(),
  officeName: z.string().min(1).optional(),
  contactPerson: z.string().min(1).optional(),
  contactNumber: z.string().min(1).optional(),
  officeAddress: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const updateLguCredentialsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export async function createLguAccount(req: Request, res: Response) {
  const parsed = createLguAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid LGU account payload", 400, parsed.error.flatten());
  }

  if (!pool) {
    return sendError(res, "DATABASE_URL is not configured", 500);
  }

  const existing = await query<{ user_id: string }>(
    "SELECT user_id FROM users WHERE email = $1 LIMIT 1",
    [parsed.data.email]
  );
  if (existing.rows[0]) {
    return sendError(res, "Email is already registered", 409);
  }

  const userId = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const passwordHash = hashPassword(parsed.data.password);

    await client.query(
      `INSERT INTO users (
        user_id,
        email,
        password_hash,
        role,
        first_name,
        last_name,
        address,
        profile_picture
      ) VALUES ($1, $2, $3, 'lgu_official', $4, $5, $6, NULL)`,
      [
        userId,
        parsed.data.email,
        passwordHash,
        parsed.data.firstName,
        parsed.data.lastName,
        parsed.data.address,
      ]
    );

    const lguResult = await client.query(
      `INSERT INTO lgu_profile (
        lgu_official_id,
        lgu_name,
        province,
        municipality_city,
        office_name,
        contact_person,
        contact_number,
        office_address,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        parsed.data.lguName,
        parsed.data.province ?? null,
        parsed.data.municipalityCity ?? null,
        parsed.data.officeName ?? parsed.data.lguName,
        parsed.data.contactPerson ?? `${parsed.data.firstName} ${parsed.data.lastName}`,
        parsed.data.contactNumber ?? null,
        parsed.data.officeAddress ?? parsed.data.address,
        parsed.data.isActive ?? true,
      ]
    );

    await client.query("COMMIT");

    return sendSuccess(
      res,
      {
        lguAccount: {
          user_id: userId,
          email: parsed.data.email,
          role: "lgu_official",
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          address: parsed.data.address,
          profile_picture: null,
          lgu_profile: lguResult.rows[0],
        },
        credentials: {
          email: parsed.data.email,
          password: parsed.data.password,
        },
      },
      201
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateLguCredentials(req: Request, res: Response) {
  const parsed = updateLguCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "Invalid credential payload", 400, parsed.error.flatten());
  }

  const lguId = req.params.lguId;
  if (!lguId) {
    return sendError(res, "LGU ID is required", 400);
  }

  if (!pool) {
    return sendError(res, "DATABASE_URL is not configured", 500);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (parsed.data.email) {
      const existing = await client.query<{ user_id: string }>(
        "SELECT user_id FROM users WHERE email = $1 AND user_id <> $2 LIMIT 1",
        [parsed.data.email, lguId]
      );
      if (existing.rows[0]) {
        await client.query("ROLLBACK");
        return sendError(res, "That email is already in use", 409);
      }

      await client.query(
        "UPDATE users SET email = $1 WHERE user_id = $2 AND role = 'lgu_official'",
        [parsed.data.email, lguId]
      );
    }

    if (parsed.data.password) {
      const passwordHash = hashPassword(parsed.data.password);
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE user_id = $2 AND role = 'lgu_official'",
        [passwordHash, lguId]
      );
    }

    const result = await client.query(
      `SELECT user_id, email, role, first_name, last_name, address, profile_picture
       FROM users
       WHERE user_id = $1 AND role = 'lgu_official'
       LIMIT 1`,
      [lguId]
    );

    await client.query("COMMIT");
    return sendSuccess(res, { lguAccount: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
