import { Hono } from "hono";
import { createDb } from "../db";
import { authGuard, type AuthContext } from "../middleware/auth";
import { getUserStatistics, getUserAttemptHistory } from "../services/stats-service";

export const statsRouter = new Hono<AuthContext>();

statsRouter.use("*", authGuard);

// GET /api/v1/users/me/stats
statsRouter.get("/stats", async (c) => {
  const user = c.get("user");
  const db = createDb(c.env.DB);
  const stats = await getUserStatistics(db, user.sub);
  return c.json(stats, 200);
});

// GET /api/v1/users/me/attempts
statsRouter.get("/attempts", async (c) => {
  const user = c.get("user");
  const subjectCode = c.req.query("subject_code");
  const skipStr = c.req.query("skip");
  const limitStr = c.req.query("limit");

  const skip = skipStr ? parseInt(skipStr, 10) : 0;
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  const db = createDb(c.env.DB);
  const history = await getUserAttemptHistory(db, user.sub, {
    subject_code: subjectCode,
    skip: isNaN(skip) ? 0 : skip,
    limit: isNaN(limit) ? 20 : limit
  });

  return c.json(history, 200);
});
