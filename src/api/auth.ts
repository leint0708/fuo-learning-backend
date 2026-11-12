import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { RegisterRequestSchema, LoginRequestSchema } from "../schemas/auth";
import { registerUser, loginUser, getUserProfile } from "../services/auth-service";
import { authGuard, type AuthContext } from "../middleware/auth";

export const authRouter = new Hono<{ Bindings: Env }>();

authRouter.post("/register", async (c) => {
  const body = await c.req.json();
  const input = RegisterRequestSchema.parse(body);
  const db = createDb(c.env.DB);
  const jwtSecret = c.env.JWT_SECRET;

  const result = await registerUser(db, jwtSecret, input);
  return c.json(result, 201);
});

authRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const input = LoginRequestSchema.parse(body);
  const db = createDb(c.env.DB);
  const jwtSecret = c.env.JWT_SECRET;

  const result = await loginUser(db, jwtSecret, input);
  return c.json(result, 200);
});

// Protected Profile Endpoint
const profileRouter = new Hono<AuthContext>();
profileRouter.use("/me", authGuard);
profileRouter.get("/me", async (c) => {
  const user = c.get("user");
  const db = createDb(c.env.DB);
  const profile = await getUserProfile(db, user.sub);
  return c.json(profile, 200);
});

authRouter.route("/", profileRouter);
