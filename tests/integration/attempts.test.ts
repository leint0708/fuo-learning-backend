import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Exam Attempts & Auto-Grading API (US3)", () => {
  const env = createTestEnv(true);

  let token = "";
  let examId = "";
  let attemptId = "";
  let questionId = "";

  beforeAll(async () => {
    // Register test user
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "exam_taker@fpt.edu.vn",
          password: "ExamPassword123!",
          full_name: "Test Taker"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;

    // Get an exam ID from catalog
    const examsRes = await app.request(
      "/api/v1/subjects/MAD101/exams",
      { method: "GET" },
      env
    );
    const examsList = (await examsRes.json()) as any[];
    examId = examsList[0].id;
  });

  it("should start a new exam attempt and return masked questions", async () => {
    const res = await app.request(
      `/api/v1/exams/${examId}/attempts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.attempt_id).toBeDefined();
    expect(data.status).toBe("in_progress");
    expect(data.time_remaining_seconds).toBeGreaterThan(0);
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBeGreaterThan(0);

    const firstQuestion = data.questions[0];
    expect(firstQuestion.question_id).toBeDefined();
    expect(firstQuestion.options).toBeDefined();
    // Verify answer keys are masked
    expect(firstQuestion.correct_answer).toBeUndefined();
    expect(firstQuestion.ai_explanation).toBeUndefined();

    attemptId = data.attempt_id;
    questionId = firstQuestion.question_id;
  });

  it("should reject starting duplicate active attempt on same exam", async () => {
    const res = await app.request(
      `/api/v1/exams/${examId}/attempts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.message).toContain("already has an ongoing active attempt");
  });

  it("should record and update an answer during active attempt", async () => {
    const res = await app.request(
      `/api/v1/attempts/${attemptId}/answers`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: questionId,
          selected_options: "C"
        })
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.question_id).toBe(questionId);
    expect(data.selected_options).toBe("C");
    expect(data.saved_at).toBeDefined();
  });

  it("should submit attempt and auto-grade results", async () => {
    const res = await app.request(
      `/api/v1/attempts/${attemptId}/submit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.attempt_id).toBe(attemptId);
    expect(data.status).toBe("completed");
    expect(data.total_questions).toBeGreaterThan(0);
    expect(typeof data.percentage_score).toBe("number");
    expect(typeof data.is_passed).toBe("boolean");
    expect(data.submitted_at).toBeDefined();
  });

  it("should reject re-submitting an already completed attempt", async () => {
    const res = await app.request(
      `/api/v1/attempts/${attemptId}/submit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(400);
  });
});
