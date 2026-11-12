import { describe, it, expect } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Documentation and System Health Endpoints", () => {
  const env = createTestEnv(false);

  it("should return healthy status on GET /health", async () => {
    const res = await app.request("/health", { method: "GET" }, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe("healthy");
    expect(data.timestamp).toBeDefined();
  });

  it("should serve OpenAPI specification on GET /docs/openapi.json", async () => {
    const res = await app.request("/docs/openapi.json", { method: "GET" }, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.openapi).toBe("3.1.0");
    expect(data.info.title).toContain("FUO Exam Practice Backend API");
    expect(data.paths).toBeDefined();
  });

  it("should serve Swagger UI on GET /ui", async () => {
    const res = await app.request("/ui", { method: "GET" }, env);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("SwaggerUIBundle");
  });
});
