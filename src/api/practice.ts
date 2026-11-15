import { Hono } from "hono";
import { createDb } from "../db";
import { authGuard, type AuthContext } from "../middleware/auth";
import {
  StartPracticeRequestSchema,
  SubmitPracticeAnswerRequestSchema
} from "../schemas/practice";
import {
  startOrResumePracticeSession,
  getPracticeSessionState,
  submitPracticeSessionAnswer,
  advanceCramBatch,
  advanceLearnRound,
  resetSubjectMastery
} from "../services/practice-service";

// Router for subject practice endpoints: /api/v1/subjects/:code/practice
export const subjectPracticeRouter = new Hono<AuthContext>();
subjectPracticeRouter.use("*", authGuard);

// POST /api/v1/subjects/:code/practice/sessions
subjectPracticeRouter.post("/:code/practice/sessions", async (c) => {
  const user = c.get("user");
  const code = c.req.param("code");
  const body = await c.req.json();
  const input = StartPracticeRequestSchema.parse(body);
  const db = createDb(c.env.DB);

  const session = await startOrResumePracticeSession(db, user.sub, code, input);
  return c.json(session, 201);
});

// POST /api/v1/subjects/:code/practice/reset
subjectPracticeRouter.post("/:code/practice/reset", async (c) => {
  const user = c.get("user");
  const code = c.req.param("code");
  const db = createDb(c.env.DB);

  const result = await resetSubjectMastery(db, user.sub, code);
  return c.json(result, 200);
});

// Router for practice session interactions: /api/v1/practice/sessions
export const practiceSessionRouter = new Hono<AuthContext>();
practiceSessionRouter.use("*", authGuard);

// GET /api/v1/practice/sessions/:session_id
practiceSessionRouter.get("/:session_id", async (c) => {
  const user = c.get("user");
  const sessionId = c.req.param("session_id");
  const db = createDb(c.env.DB);

  const session = await getPracticeSessionState(db, user.sub, sessionId);
  return c.json(session, 200);
});

// POST /api/v1/practice/sessions/:session_id/answer
practiceSessionRouter.post("/:session_id/answer", async (c) => {
  const user = c.get("user");
  const sessionId = c.req.param("session_id");
  const body = await c.req.json();
  const input = SubmitPracticeAnswerRequestSchema.parse(body);
  const db = createDb(c.env.DB);

  const result = await submitPracticeSessionAnswer(
    db,
    user.sub,
    sessionId,
    input.question_id,
    input.selected_options
  );
  return c.json(result, 200);
});

// POST /api/v1/practice/sessions/:session_id/next-batch
practiceSessionRouter.post("/:session_id/next-batch", async (c) => {
  const user = c.get("user");
  const sessionId = c.req.param("session_id");
  const db = createDb(c.env.DB);

  const session = await advanceCramBatch(db, user.sub, sessionId);
  return c.json(session, 200);
});

// POST /api/v1/practice/sessions/:session_id/next-round
practiceSessionRouter.post("/:session_id/next-round", async (c) => {
  const user = c.get("user");
  const sessionId = c.req.param("session_id");
  const db = createDb(c.env.DB);

  const session = await advanceLearnRound(db, user.sub, sessionId);
  return c.json(session, 200);
});
