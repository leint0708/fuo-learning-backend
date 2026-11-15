import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Practice Persistence & Reset API (US6)", () => {
  const env = createTestEnv(true);

  let token = "";

  beforeAll(async () => {
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "persist_learner@fpt.edu.vn",
          password: "PersistPassword123!",
          full_name: "Persist Learner"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;
  });

  it("should reset practice mastery progress for a subject", async () => {
    // 1. Start a session
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
    const session = (await startRes.json()) as any;
    const cardId = session.current_card.id;

    // 2. Answer a card correctly to record mastery
    const answerRes = await app.request(
      `/api/v1/practice/sessions/${session.id}/answer`,
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
    const answerData = (await answerRes.json()) as any;
    // Submit known correct answer
    await app.request(
      `/api/v1/practice/sessions/${session.id}/answer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: cardId,
          selected_options: answerData.correct_answer
        })
      },
      env
    );

    // 3. Reset progress for MAD101
    const resetRes = await app.request(
      "/api/v1/subjects/MAD101/practice/reset",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(resetRes.status).toBe(200);
    const resetData = (await resetRes.json()) as any;
    expect(resetData.message).toContain("reset");

    // 4. Starting a new session now creates a fresh session
    const newSessionRes = await app.request(
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

    expect(newSessionRes.status).toBe(201);
    const newSession = (await newSessionRes.json()) as any;
    expect(newSession.id).not.toBe(session.id);
  });
});
