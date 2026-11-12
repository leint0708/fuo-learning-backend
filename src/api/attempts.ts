import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { SubmitAnswerRequestSchema } from "../schemas/attempts";
import {
  startAttempt,
  getAttemptSession,
  saveAnswer,
  submitAttempt
} from "../services/attempt-service";
import { getAttemptReview } from "../services/review-service";
import { authGuard, type AuthContext } from "../middleware/auth";

export const attemptsRouter = new Hono<AuthContext>();

attemptsRouter.use("*", authGuard);

// Start an attempt for an exam: POST /api/v1/exams/:exam_id/attempts
// (can be mounted under /api/v1 as well, or handled directly)
export const examAttemptsRouter = new Hono<AuthContext>();
examAttemptsRouter.use("*", authGuard);
examAttemptsRouter.post("/:exam_id/attempts", async (c) => {
  const user = c.get("user");
  const examId = c.req.param("exam_id");
  const db = createDb(c.env.DB);

  const session = await startAttempt(db, user.sub, examId);
  return c.json(session, 201);
});

// Attempts operations: /api/v1/attempts/:attempt_id
attemptsRouter.get("/:attempt_id", async (c) => {
  const user = c.get("user");
  const attemptId = c.req.param("attempt_id");
  const db = createDb(c.env.DB);

  const session = await getAttemptSession(db, user.sub, attemptId);
  return c.json(session, 200);
});

attemptsRouter.put("/:attempt_id/answers", async (c) => {
  const user = c.get("user");
  const attemptId = c.req.param("attempt_id");
  const body = await c.req.json();
  const input = SubmitAnswerRequestSchema.parse(body);
  const db = createDb(c.env.DB);

  const result = await saveAnswer(
    db,
    user.sub,
    attemptId,
    input.question_id,
    input.selected_options
  );
  return c.json(result, 200);
});

attemptsRouter.post("/:attempt_id/submit", async (c) => {
  const user = c.get("user");
  const attemptId = c.req.param("attempt_id");
  const db = createDb(c.env.DB);

  const result = await submitAttempt(db, user.sub, attemptId);
  return c.json(result, 200);
});

attemptsRouter.get("/:attempt_id/review", async (c) => {
  const user = c.get("user");
  const attemptId = c.req.param("attempt_id");
  const db = createDb(c.env.DB);

  const review = await getAttemptReview(db, user.sub, attemptId);
  return c.json(review, 200);
});
