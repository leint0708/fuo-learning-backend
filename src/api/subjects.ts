import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { listSubjects, getSubjectByCode, listExamsBySubject } from "../services/catalog-service";

export const subjectsRouter = new Hono<{ Bindings: Env }>();

subjectsRouter.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const subjectsList = await listSubjects(db);
  return c.json(subjectsList, 200);
});

subjectsRouter.get("/:code", async (c) => {
  const code = c.req.param("code");
  const db = createDb(c.env.DB);
  const subject = await getSubjectByCode(db, code);
  return c.json(subject, 200);
});

subjectsRouter.get("/:code/exams", async (c) => {
  const code = c.req.param("code");
  const db = createDb(c.env.DB);
  const examsList = await listExamsBySubject(db, code);
  return c.json(examsList, 200);
});
