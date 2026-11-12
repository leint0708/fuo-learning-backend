import { describe, it, expect } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("User Authentication & Profile API (US1)", () => {
  const env = createTestEnv();

  const testUser = {
    email: `student_${Date.now()}@fpt.edu.vn`,
    password: "StrongPassword123!",
    full_name: "Nguyen Van A"
  };

  let token = "";

  it("should register a new user successfully", async () => {
    const res = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser)
      },
      env
    );

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.access_token).toBeDefined();
    expect(data.token_type).toBe("bearer");
    expect(data.user.email).toBe(testUser.email.toLowerCase());
    expect(data.user.full_name).toBe(testUser.full_name);
    expect(data.user.id).toBeDefined();

    token = data.access_token;
  });

  it("should reject duplicate registration with same email", async () => {
    const res = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser)
      },
      env
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.message).toContain("already registered");
  });

  it("should login registered user with valid credentials", async () => {
    const res = await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        })
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.access_token).toBeDefined();
    expect(data.user.email).toBe(testUser.email.toLowerCase());
  });

  it("should reject login with wrong password", async () => {
    const res = await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: "WrongPassword999!"
        })
      },
      env
    );

    expect(res.status).toBe(401);
  });

  it("should retrieve profile for authenticated user", async () => {
    const res = await app.request(
      "/api/v1/auth/me",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.email).toBe(testUser.email.toLowerCase());
    expect(data.full_name).toBe(testUser.full_name);
  });

  it("should reject profile request without token", async () => {
    const res = await app.request(
      "/api/v1/auth/me",
      {
        method: "GET"
      },
      env
    );

    expect(res.status).toBe(401);
  });
});
