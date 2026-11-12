import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Attempt Review & Question Explanations API (US4)", () => {
  const env = createTestEnv(true);

  let token = "";
  let otherToken = "";
  let examId = "";
  let inProgressAttemptId = "";
  let completedAttemptId = "";

  beforeAll(async () => {
    // Register user 1
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "reviewer1@fpt.edu.vn",
          password: "ReviewPassword123!",
          full_name: "Reviewer One"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;

    // Register user 2
    const regRes2 = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "reviewer2@fpt.edu.vn",
          password: "ReviewPassword123!",
          full_name: "Reviewer Two"
        })
      },
      env
    );
    const regData2 = (await regRes2.json()) as any;
    otherToken = regData2.access_token;

    // Get an exam ID from catalog
    const examsRes = await app.request(
      "/api/v1/subjects/MAD101/exams",
      { method: "GET" },
      env
    );
    const examsList = (await examsRes.json()) as any[];
    examId = examsList[0].id;
  });

  it("should reject review request for an in-progress attempt", async () => {
    // Start attempt
    const startRes = await app.request(
      `/api/v1/exams/${examId}/attempts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    const startData = (await startRes.json()) as any;
    inProgressAttemptId = startData.attempt_id;

    // Attempt review before submission
    const reviewRes = await app.request(
      `/api/v1/attempts/${inProgressAttemptId}/review`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(reviewRes.status).toBe(400);
    const errData = (await reviewRes.json()) as any;
    expect(errData.error.message).toContain("still in progress");
  });

  it("should permit review and unmask answers once attempt is submitted", async () => {
    // Answer a question
    const sessionRes = await app.request(
      `/api/v1/attempts/${inProgressAttemptId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    const sessionData = (await sessionRes.json()) as any;
    const q1 = sessionData.questions[0];

    await app.request(
      `/api/v1/attempts/${inProgressAttemptId}/answers`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: q1.question_id,
          selected_options: "A"
        })
      },
      env
    );

    // Submit attempt
    const submitRes = await app.request(
      `/api/v1/attempts/${inProgressAttemptId}/submit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(submitRes.status).toBe(200);
    completedAttemptId = inProgressAttemptId;

    // Now request review
    const reviewRes = await app.request(
      `/api/v1/attempts/${completedAttemptId}/review`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(reviewRes.status).toBe(200);
    const reviewData = (await reviewRes.json()) as any;
    expect(reviewData.attempt_id).toBe(completedAttemptId);
    expect(reviewData.status).toBe("completed");
    expect(typeof reviewData.percentage_score).toBe("number");
    expect(typeof reviewData.is_passed).toBe("boolean");
    expect(Array.isArray(reviewData.questions)).toBe(true);
    expect(reviewData.questions.length).toBeGreaterThan(0);

    const question = reviewData.questions[0];
    // Correct answers and explanations unmasked
    expect(question.correct_answer).toBeDefined();
    expect(typeof question.correct_answer).toBe("string");
    expect(typeof question.is_correct).toBe("boolean");
    expect(question.options).toBeDefined();
    expect(question.selected_options).toBeDefined();
  });

  it("should prevent another user from reviewing this attempt (403)", async () => {
    const reviewRes = await app.request(
      `/api/v1/attempts/${completedAttemptId}/review`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${otherToken}` }
      },
      env
    );

    expect(reviewRes.status).toBe(403);
  });

  it("should return 404 for non-existent attempt review", async () => {
    const reviewRes = await app.request(
      `/api/v1/attempts/non-existent-attempt-id/review`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(reviewRes.status).toBe(404);
  });
});
