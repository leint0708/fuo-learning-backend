import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyAccessToken, type TokenPayload } from "../core/security";
import type { Env } from "../types/env";

export interface AuthContext {
  Variables: {
    user: TokenPayload;
  };
  Bindings: Env;
}

export const authGuard = createMiddleware<AuthContext>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7).trim();
  const jwtSecret = c.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new HTTPException(500, { message: "Server JWT secret is not configured" });
  }

  const user = await verifyAccessToken(token, jwtSecret);
  if (!user) {
    throw new HTTPException(401, { message: "Invalid or expired access token" });
  }

  c.set("user", user);
  await next();
});
