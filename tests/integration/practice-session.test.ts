import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Subject Practice Session API (US1)", () => {
  const env = createTestEnv(true);

  let token = "";

  beforeAll(async () => {
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "practicer@fpt.edu.vn",
          password: "PracticePassword123!",
          full_name: "Practice Learner"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;
  });

  it("should return 404 when starting practice session for non-existent subject", async () => {
    const res = await app.request(
      "/api/v1/subjects/NONEXISTENT/practice/sessions",
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

    expect(res.status).toBe(404);
  });

  it("should start a new Cram practice session for a valid subject", async () => {
    const res = await app.request(
      "/api/v1/subjects/MAD101/practice/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode: "cram", is_unlimited: true })
      },
      env
    );

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.id).toBeDefined();
    expect(data.mode).toBe("cram");
    expect(data.status).toBe("in_progress");
    expect(data.is_unlimited).toBe(true);
    expect(data.cram_state).toBeDefined();
    expect(data.cram_state.batch_index).toBe(0);
    expect(data.current_card).toBeDefined();
    expect(data.current_card.id).toBeDefined();
    expect(data.current_card.question_text).toBeDefined();
    // Answer key must be masked
    expect(data.current_card.correct_answer).toBeUndefined();
  });

  it("should resume an active Cram session when requested again", async () => {
    const res = await app.request(
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

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.id).toBeDefined();
    expect(data.mode).toBe("cram");
  });

  it("should retrieve ongoing practice session state by session ID", async () => {
    // Start or get session
    const createRes = await app.request(
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
    const createData = (await createRes.json()) as any;
    const sessionId = createData.id;

    const getRes = await app.request(
      `/api/v1/practice/sessions/${sessionId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as any;
    expect(getData.id).toBe(sessionId);
    expect(getData.mode).toBe("cram");
    expect(getData.current_card).toBeDefined();
  });
});
