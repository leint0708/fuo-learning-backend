import { describe, it, expect } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";
import { createDb } from "../../src/db";
import { subjects, exams, questions, exam_attempts, attempt_answers } from "../../src/db/schema";

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

  it("should return all questions (>50) in a subject when all=true or higher count is requested without breaking capped queries", async () => {
    const now = new Date().toISOString();
    await db.insert(subjects).values({
      id: "subj_drill65",
      code: "DRILL65",
      title: "Full Bank Drill Subject",
      description: "Full bank drill test",
      icon_url: null,
      created_at: now,
    });
    await db.insert(exams).values({
      id: "exam_drill65_full",
      subject_id: "subj_drill65",
      code: "DRILL65_FE",
      title: "DRILL65 Full Exam",
      description: null,
      duration_minutes: 60,
      total_questions: 65,
      passing_score_percentage: 70,
      is_published: true,
      created_at: now,
    });
    await db.insert(questions).values(
      Array.from({ length: 65 }, (_, idx) => ({
        id: `drill65_q_${idx + 1}`,
        subject_id: "subj_drill65",
        exam_id: "exam_drill65_full",
        question_number: idx + 1,
        question_id_code: `Q${idx + 1}`,
        question_text: `DRILL65 question ${idx + 1}`,
        image_file: null,
        question_type: "single_choice",
        options: { A: "A", B: "B", C: "C", D: "D" },
        correct_answer: "A",
        ai_explanation: "Explanation",
        option_by_option_analysis: null,
        community_stats: null,
        created_at: now,
      }))
    );

    const allRes = await app.request(
      "/api/v1/questions/drills?subject_code=DRILL65&all=true&count=10000",
      { method: "GET" },
      env
    );
    expect(allRes.status).toBe(200);
    const allItems = (await allRes.json()) as Array<{ question_id: string }>;
    expect(allItems).toHaveLength(65);

    const explicit65Res = await app.request(
      "/api/v1/questions/drills?subject_code=DRILL65&count=65",
      { method: "GET" },
      env
    );
    expect(explicit65Res.status).toBe(200);
    const explicit65Items = (await explicit65Res.json()) as Array<{ question_id: string }>;
    expect(explicit65Items).toHaveLength(65);

    const explicit5Res = await app.request(
      "/api/v1/questions/drills?subject_code=DRILL65&count=5",
      { method: "GET" },
      env
    );
    expect(explicit5Res.status).toBe(200);
    const explicit5Items = (await explicit5Res.json()) as Array<{ question_id: string }>;
    expect(explicit5Items).toHaveLength(5);
  });
});
