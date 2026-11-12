import { describe, it, expect } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";
import { createDb } from "../../src/db";
import { exam_attempts, attempt_answers } from "../../src/db/schema";

describe("Question Bank Topical Exploration API (US6)", () => {
  const env = createTestEnv(true);
  const db = createDb(env.DB);

  let sampleQuestionId = "";

  it("should retrieve topical practice questions without revealing answers", async () => {
    const res = await app.request(
      "/api/v1/questions/drills?subject_code=MAD101&count=5",
      { method: "GET" },
      env
    );

    expect(res.status).toBe(200);
    const questions = (await res.json()) as any[];
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(5);

    const q = questions[0];
    expect(q.question_id).toBeDefined();
    expect(q.subject_code).toBe("MAD101");
    expect(q.question_type).toBeDefined();
    expect(q.question_text).toBeDefined();
    expect(q.options).toBeDefined();
    expect(typeof q.options).toBe("object");

    // Must not expose answers or explanations in drill fetch
    expect(q.correct_answer).toBeUndefined();
    expect(q.ai_explanation).toBeUndefined();

    sampleQuestionId = q.question_id;
  });

  it("should reject drill request missing required subject_code parameter with 400", async () => {
    const res = await app.request("/api/v1/questions/drills", { method: "GET" }, env);
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.message).toContain("Missing required query parameter");
  });

  it("should return 404 when requesting drills for non-existent subject code", async () => {
    const res = await app.request(
      "/api/v1/questions/drills?subject_code=UNKNOWN123",
      { method: "GET" },
      env
    );
    expect(res.status).toBe(404);
  });

  it("should check answer ephemerally and reveal explanation without persisting attempt", async () => {
    // Record attempts count before check
    const attemptsBefore = await db.select().from(exam_attempts).all();
    const answersBefore = await db.select().from(attempt_answers).all();

    const res = await app.request(
      `/api/v1/questions/${sampleQuestionId}/check`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_options: "A"
        })
      },
      env
    );

    expect(res.status).toBe(200);
    const result = (await res.json()) as any;
    expect(result.question_id).toBe(sampleQuestionId);
    expect(result.selected_options).toBe("A");
    expect(result.correct_answer).toBeDefined();
    expect(typeof result.is_correct).toBe("boolean");
    expect(result.ai_explanation).toBeDefined();

    // Verify database remains untouched (ephemeral check)
    const attemptsAfter = await db.select().from(exam_attempts).all();
    const answersAfter = await db.select().from(attempt_answers).all();
    expect(attemptsAfter.length).toBe(attemptsBefore.length);
    expect(answersAfter.length).toBe(answersBefore.length);
  });

  it("should return 404 when checking answer for non-existent question", async () => {
    const res = await app.request(
      "/api/v1/questions/non-existent-q-id/check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_options: "B"
        })
      },
      env
    );

    expect(res.status).toBe(404);
  });
});
