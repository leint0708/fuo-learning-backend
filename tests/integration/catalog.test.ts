import { describe, it, expect } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Subject & Exam Catalog API (US2)", () => {
  // Pass true to seed real datasets from scripts/seed.sql
  const env = createTestEnv(true);

  it("should list all seeded academic subjects", async () => {
    const res = await app.request(
      "/api/v1/subjects",
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(4);

    const codes = data.map((s) => s.code);
    expect(codes).toContain("MAD101");
    expect(codes).toContain("NWC204");
    expect(codes).toContain("OSG202");
    expect(codes).toContain("PRO192");

    const mad101 = data.find((s) => s.code === "MAD101");
    expect(mad101.title).toBe("Discrete Mathematics");
    expect(mad101.total_exams).toBeGreaterThan(0);
  });

  it("should retrieve specific subject details by code", async () => {
    const res = await app.request(
      "/api/v1/subjects/MAD101",
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.code).toBe("MAD101");
    expect(data.title).toBe("Discrete Mathematics");
    expect(data.total_exams).toBeGreaterThan(0);
  });

  it("should return 404 for non-existent subject code", async () => {
    const res = await app.request(
      "/api/v1/subjects/UNKNOWN999",
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(404);
  });

  it("should list all exams categorized under a subject", async () => {
    const res = await app.request(
      "/api/v1/subjects/MAD101/exams",
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const firstExam = data[0];
    expect(firstExam.id).toBeDefined();
    expect(firstExam.code).toBeDefined();
    expect(firstExam.subject_code).toBe("MAD101");
    expect(firstExam.duration_minutes).toBe(60);
    expect(firstExam.total_questions).toBeGreaterThan(0);
  });

  it("should retrieve exam details by exam ID", async () => {
    // Get exams first
    const listRes = await app.request("/api/v1/subjects/PRO192/exams", { method: "GET" }, env);
    const examsList = (await listRes.json()) as any[];
    expect(examsList.length).toBeGreaterThan(0);

    const targetExamId = examsList[0].id;

    const res = await app.request(
      `/api/v1/exams/${targetExamId}`,
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe(targetExamId);
    expect(data.subject_code).toBe("PRO192");
    expect(data.passing_score_percentage).toBe(70.0);
  });

  it("should return 404 for invalid exam ID", async () => {
    const res = await app.request(
      "/api/v1/exams/non-existent-exam-id-999",
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(404);
  });
});
