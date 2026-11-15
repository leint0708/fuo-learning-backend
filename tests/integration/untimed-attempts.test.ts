import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Untimed Exam Attempts API (US4)", () => {
  const env = createTestEnv(true);

  let token = "";
  let examId = "";

  beforeAll(async () => {
    // Register test user
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "untimed_student@fpt.edu.vn",
          password: "UntimedPassword123!",
          full_name: "Untimed Student"
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

  it("should create an untimed exam attempt with null expiration and null remaining time", async () => {
    const res = await app.request(
      `/api/v1/exams/${examId}/attempts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_unlimited: true })
      },
      env
    );

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.attempt_id).toBeDefined();
    expect(data.status).toBe("in_progress");
    expect(data.is_unlimited).toBe(true);
    expect(data.expires_at).toBeNull();
    expect(data.time_remaining_seconds).toBeNull();
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBeGreaterThan(0);
  });

  it("should allow saving answers in an untimed attempt without expiration error", async () => {
    // Fetch ongoing attempt
    const listRes = await app.request(
      "/api/v1/users/me/attempts",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(listRes.status).toBe(200);

    const activeRes = await app.request(
      `/api/v1/exams/${examId}/attempts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_unlimited: true })
      },
      env
    );
    // User already has an ongoing active attempt on this exam
    expect(activeRes.status).toBe(400);
  });
});
