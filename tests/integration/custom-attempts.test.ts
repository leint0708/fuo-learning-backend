import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Custom Subject Exam Attempts (>50 Questions)", () => {
  const env = createTestEnv(true);
  let token = "";
  let firstExamId = "";

  beforeAll(async () => {
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "custom_exam_user@fpt.edu.vn",
          password: "CustomExamPassword123!",
          full_name: "Custom Exam User"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;

    const examsRes = await app.request("/api/v1/subjects/MAD101/exams", { method: "GET" }, env);
    const examsList = (await examsRes.json()) as any[];
    firstExamId = examsList[0].id;
  });

  it("creates a custom subject attempt with >50 questions (e.g. 120) and supports session, answer, submit, and review", async () => {
    const startRes = await app.request(
      "/api/v1/subjects/MAD101/attempts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_count: 120,
          duration_minutes: 90,
          is_unlimited: false
        })
      },
      env
    );

    expect(startRes.status).toBe(201);
    const startData = (await startRes.json()) as any;
    expect(startData.exam_title).toContain("MAD101");
    expect(startData.questions).toHaveLength(120);
    expect(startData.questions[0].question_number).toBe(1);
    expect(startData.questions[119].question_number).toBe(120);

    const uniqueIds = new Set(startData.questions.map((q: any) => q.question_id));
    expect(uniqueIds.size).toBe(120);

    const attemptId = startData.attempt_id;

    // Reload session via GET /attempts/:attemptId
    const getRes = await app.request(
      `/api/v1/attempts/${attemptId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as any;
    expect(getData.questions).toHaveLength(120);

    // Answer question 100
    const q100 = getData.questions[99];
    const saveRes = await app.request(
      `/api/v1/attempts/${attemptId}/answers`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: q100.question_id,
          selected_options: "A"
        })
      },
      env
    );
    expect(saveRes.status).toBe(200);

    // Submit and verify total_questions = 120
    const submitRes = await app.request(
      `/api/v1/attempts/${attemptId}/submit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(submitRes.status).toBe(200);
    const submitData = (await submitRes.json()) as any;
    expect(submitData.total_questions).toBe(120);

    // Review contains all 120 questions
    const reviewRes = await app.request(
      `/api/v1/attempts/${attemptId}/review`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(reviewRes.status).toBe(200);
    const reviewData = (await reviewRes.json()) as any;
    expect(reviewData.questions).toHaveLength(120);
    expect(reviewData.questions[99].selected_options).toBe("A");
  });

  it("supports question_count > 50 when posted directly to /api/v1/exams/:examId/attempts", async () => {
    const startRes = await app.request(
      `/api/v1/exams/${firstExamId}/attempts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_count: 85,
          duration_minutes: null,
          is_timed: false
        })
      },
      env
    );

    expect(startRes.status).toBe(201);
    const data = (await startRes.json()) as any;
    expect(data.questions).toHaveLength(85);
    expect(data.is_unlimited).toBe(true);
    expect(data.time_remaining_seconds).toBeNull();
  });
});
