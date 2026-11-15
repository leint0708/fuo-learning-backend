import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Cram Mode Integration Tests (US2)", () => {
  const env = createTestEnv(true);

  let token = "";
  let sessionId = "";
  let currentCardId = "";

  beforeAll(async () => {
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cram_learner@fpt.edu.vn",
          password: "CramPassword123!",
          full_name: "Cram Learner"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;

    // Start Cram session
    const startRes = await app.request(
      "/api/v1/subjects/MAD101/practice/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode: "cram" })
      },
      env
    );
    expect(startRes.status).toBe(201);
    const startData = (await startRes.json()) as any;
    sessionId = startData.id;
    currentCardId = startData.current_card.id;
  });

  it("should jitter card 2-4 positions ahead upon incorrect answer", async () => {
    const answerRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}/answer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: currentCardId,
          selected_options: "ZZZ" // Intentionally wrong
        })
      },
      env
    );

    expect(answerRes.status).toBe(200);
    const data = (await answerRes.json()) as any;
    expect(data.is_correct).toBe(false);
    expect(data.correct_answer).toBeDefined();
    expect(data.explanation).toBeDefined();
    expect(data.cram_action).toBeDefined();
    expect(["jittered", "retried"]).toContain(data.cram_action.action);
    if (data.cram_action.action === "jittered") {
      expect(data.cram_action.jitter_offset).toBeGreaterThanOrEqual(2);
      expect(data.cram_action.jitter_offset).toBeLessThanOrEqual(4);
    }
  });

  it("should remove card and record mastery upon correct answer", async () => {
    // Get current card from session
    const stateRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    const stateData = (await stateRes.json()) as any;
    const cardId = stateData.current_card.id;

    // We need the correct answer to submit correctly; query DB mock or submit valid answer
    // In grading service, we can answer correctly by submitting matching answer
    const qRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}/answer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: cardId,
          selected_options: "A"
        })
      },
      env
    );
    const qData = (await qRes.json()) as any;
    const correctAnswer = qData.correct_answer;

    // Now submit the known correct answer
    const correctRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}/answer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: cardId,
          selected_options: correctAnswer
        })
      },
      env
    );

    expect(correctRes.status).toBe(200);
    const correctData = (await correctRes.json()) as any;
    expect(correctData.is_correct).toBe(true);
    expect(correctData.cram_action.action).toBe("mastered");
  });

  it("should reject advancing to next batch if current batch is not completed", async () => {
    const nextRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}/next-batch`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(nextRes.status).toBe(400);
  });
});
