import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Learn Mode Integration Tests (US3)", () => {
  const env = createTestEnv(true);

  let token = "";
  let sessionId = "";

  beforeAll(async () => {
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "learn_student@fpt.edu.vn",
          password: "LearnPassword123!",
          full_name: "Learn Student"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;

    // Start Learn session
    const startRes = await app.request(
      "/api/v1/subjects/MAD101/practice/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode: "learn" })
      },
      env
    );
    expect(startRes.status).toBe(201);
    const startData = (await startRes.json()) as any;
    sessionId = startData.id;
  });

  it("should initialize active pool constrained to <= 7 cards", async () => {
    const sessionRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(sessionRes.status).toBe(200);
    const data = (await sessionRes.json()) as any;
    expect(data.mode).toBe("learn");
    expect(data.learn_state).toBeDefined();
    expect(data.learn_state.active_pool_count).toBeLessThanOrEqual(7);
    expect(data.learn_state.round_number).toBe(1);
  });

  it("should graduate pristine card on 1st correct answer", async () => {
    const sessionRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    const sessionData = (await sessionRes.json()) as any;
    const cardId = sessionData.current_card.id;

    // Probe for correct answer
    const probeRes = await app.request(
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
    const probeData = (await probeRes.json()) as any;

    if (probeData.is_correct) {
      // Pristine card answered correctly
      expect(probeData.learn_action.graduated).toBe(true);
      expect(probeData.learn_action.card_status).toBe("learned");
    } else {
      // Was wrong, now streak is 0 and wrong_attempts is 1
      expect(probeData.learn_action.graduated).toBe(false);
      expect(probeData.learn_action.card_status).toBe("learning");
      expect(probeData.learn_action.consecutive_correct).toBe(0);
      expect(probeData.learn_action.wrong_attempts).toBe(1);
    }
  });

  it("should reject advancing to next round when current round is still in progress", async () => {
    const nextRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}/next-round`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    // Current round not completed yet
    expect(nextRes.status).toBe(400);
  });
});
