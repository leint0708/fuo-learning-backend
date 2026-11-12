import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("User Statistics & Attempt History API (US5)", () => {
  const env = createTestEnv(true);

  let token = "";
  let examId = "";

  beforeAll(async () => {
    // Register user
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "stats_student@fpt.edu.vn",
          password: "StatsPassword123!",
          full_name: "Stats Student"
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

  it("should return zero-state statistics for a new user with zero attempts", async () => {
    const res = await app.request(
      "/api/v1/users/me/stats",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.total_attempts_count).toBe(0);
    expect(data.total_exams_passed).toBe(0);
    expect(data.overall_pass_rate).toBe(0);
    expect(data.overall_average_score).toBe(0);
    expect(data.total_practice_duration_minutes).toBe(0);
    expect(Array.isArray(data.subject_breakdowns)).toBe(true);
    expect(data.subject_breakdowns.length).toBeGreaterThanOrEqual(4);

    const mad = data.subject_breakdowns.find((s: any) => s.subject_code === "MAD101");
    expect(mad).toBeDefined();
    expect(mad.attempts_count).toBe(0);
    expect(mad.total_exams_in_subject).toBeGreaterThan(0);
  });

  it("should return empty attempt history for a new user", async () => {
    const res = await app.request(
      "/api/v1/users/me/attempts",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("should update statistics and attempt history after completing an exam attempt", async () => {
    // Start attempt
    const startRes = await app.request(
      `/api/v1/exams/${examId}/attempts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(startRes.status).toBe(201);
    const startData = (await startRes.json()) as any;
    const attemptId = startData.attempt_id;

    // Submit attempt immediately
    const submitRes = await app.request(
      `/api/v1/attempts/${attemptId}/submit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(submitRes.status).toBe(200);

    // Verify statistics are updated
    const statsRes = await app.request(
      "/api/v1/users/me/stats",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(statsRes.status).toBe(200);
    const statsData = (await statsRes.json()) as any;
    expect(statsData.total_attempts_count).toBe(1);
    expect(typeof statsData.overall_average_score).toBe("number");
    expect(typeof statsData.overall_pass_rate).toBe("number");

    const mad = statsData.subject_breakdowns.find((s: any) => s.subject_code === "MAD101");
    expect(mad).toBeDefined();
    expect(mad.attempts_count).toBe(1);

    // Verify attempt history includes the completed attempt
    const historyRes = await app.request(
      "/api/v1/users/me/attempts",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(historyRes.status).toBe(200);
    const historyData = (await historyRes.json()) as any[];
    expect(historyData.length).toBe(1);
    expect(historyData[0].attempt_id).toBe(attemptId);
    expect(historyData[0].subject_code).toBe("MAD101");
    expect(historyData[0].status).toBe("completed");
    expect(typeof historyData[0].percentage_score).toBe("number");
  });

  it("should support filtering attempt history by subject_code and pagination", async () => {
    // Query with matching subject_code
    const matchRes = await app.request(
      "/api/v1/users/me/attempts?subject_code=MAD101&limit=10&skip=0",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(matchRes.status).toBe(200);
    const matchData = (await matchRes.json()) as any[];
    expect(matchData.length).toBe(1);

    // Query with non-matching subject_code
    const noMatchRes = await app.request(
      "/api/v1/users/me/attempts?subject_code=NWC204",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(noMatchRes.status).toBe(200);
    const noMatchData = (await noMatchRes.json()) as any[];
    expect(noMatchData.length).toBe(0);
  });

  it("should reject unauthenticated access to statistics and attempt history with 401", async () => {
    const statsRes = await app.request("/api/v1/users/me/stats", { method: "GET" }, env);
    expect(statsRes.status).toBe(401);

    const historyRes = await app.request("/api/v1/users/me/attempts", { method: "GET" }, env);
    expect(historyRes.status).toBe(401);
  });
});
