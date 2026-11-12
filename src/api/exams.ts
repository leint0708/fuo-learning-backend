import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { getExamById } from "../services/catalog-service";

export const examsRouter = new Hono<{ Bindings: Env }>();

examsRouter.get("/:exam_id", async (c) => {
  const examId = c.req.param("exam_id");
  const db = createDb(c.env.DB);
  const exam = await getExamById(db, examId);
  return c.json(exam, 200);
});
