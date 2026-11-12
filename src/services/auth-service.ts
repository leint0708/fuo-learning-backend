import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import { users, user_statistics } from "../db/schema";
import { hashPassword, verifyPassword, createAccessToken } from "../core/security";
import type { RegisterRequest, LoginRequest, AuthResponse, UserProfileResponse } from "../schemas/auth";

export async function registerUser(
  db: Database,
  jwtSecret: string,
  input: RegisterRequest
): Promise<AuthResponse> {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .get();

  if (existingUser) {
    throw new HTTPException(400, { message: "Email is already registered" });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();

  await db.insert(users).values({
    id: userId,
    email: input.email.toLowerCase(),
    password_hash: passwordHash,
    full_name: input.full_name,
    is_active: true,
    created_at: now,
    updated_at: now
  });

  // Initialize zero-state user statistics
  await db.insert(user_statistics).values({
    user_id: userId,
    total_attempts_count: 0,
    total_exams_passed: 0,
    overall_pass_rate: 0.0,
    overall_average_score: 0.0,
    total_practice_seconds: 0,
    subject_breakdowns: "{}",
    updated_at: now
  });

  const token = await createAccessToken(
    { sub: userId, email: input.email.toLowerCase(), name: input.full_name },
    jwtSecret
  );

  return {
    access_token: token,
    token_type: "bearer",
    user: {
      id: userId,
      email: input.email.toLowerCase(),
      full_name: input.full_name,
      created_at: now
    }
  };
}

export async function loginUser(
  db: Database,
  jwtSecret: string,
  input: LoginRequest
): Promise<AuthResponse> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .get();

  if (!user || !user.is_active) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  const isValid = await verifyPassword(input.password, user.password_hash);
  if (!isValid) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  const token = await createAccessToken(
    { sub: user.id, email: user.email, name: user.full_name },
    jwtSecret
  );

  return {
    access_token: token,
    token_type: "bearer",
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at
    }
  };
}

export async function getUserProfile(db: Database, userId: string): Promise<UserProfileResponse> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    created_at: user.created_at
  };
}
