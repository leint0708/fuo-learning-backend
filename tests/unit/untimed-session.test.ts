import { describe, it, expect } from "vitest";
import { isAttemptExpired, getRemainingSeconds } from "../../src/services/grading-service";

describe("Untimed Sessions Unit Tests (US4)", () => {
  it("should treat null expires_at as non-expired", () => {
    expect(isAttemptExpired(null)).toBe(false);
  });

  it("should treat undefined expires_at as non-expired", () => {
    expect(isAttemptExpired(undefined)).toBe(false);
  });

  it("should return null for getRemainingSeconds when untimed", () => {
    expect(getRemainingSeconds(null)).toBeNull();
    expect(getRemainingSeconds(undefined)).toBeNull();
  });

  it("should still accurately evaluate normal timed expiration", () => {
    const expiredTime = new Date(Date.now() - 10000).toISOString();
    const activeTime = new Date(Date.now() + 60000).toISOString();

    expect(isAttemptExpired(expiredTime)).toBe(true);
    expect(isAttemptExpired(activeTime)).toBe(false);

    expect(getRemainingSeconds(expiredTime)).toBe(0);
    expect(getRemainingSeconds(activeTime)).toBeGreaterThan(50);
  });
});
