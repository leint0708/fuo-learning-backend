import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { DrillCheckRequestSchema } from "../schemas/questions";
import { getDrillQuestions, checkDrillAnswer } from "../services/drill-service";

export const questionsRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/questions/drills?subject_code=MAD101&count=10 (or all=true for full subject bank)
questionsRouter.get("/drills", async (c) => {
  const subjectCode = c.req.query("subject_code");
  if (!subjectCode) {
    throw new HTTPException(400, {
      message: "Missing required query parameter: subject_code"
    });
  }

  const allFlag = c.req.query("all");
  const includeAll = allFlag === "true" || allFlag === "1";
  const countStr = c.req.query("count");
  const parsedCount = countStr ? parseInt(countStr, 10) : 10;
  const resolvedCount = includeAll
    ? null
    : Number.isFinite(parsedCount) && parsedCount > 0
      ? parsedCount
      : 10;

  const db = createDb(c.env.DB);
  const drillQuestions = await getDrillQuestions(
    db,
    subjectCode,
    resolvedCount
  );

  return c.json(drillQuestions, 200);
});

// POST /api/v1/questions/:question_id/check
questionsRouter.post("/:question_id/check", async (c) => {
  const questionId = c.req.param("question_id");
  const body = await c.req.json();
  const input = DrillCheckRequestSchema.parse(body);

  const db = createDb(c.env.DB);
  const result = await checkDrillAnswer(
    db,
    questionId,
    input.selected_options,
    input.benchmark_mode
  );

  return c.json(result, 200);
});
