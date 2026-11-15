import { describe, it, expect } from "vitest";
import { calculateCramJitter } from "../../src/services/practice-service";

describe("Cram Mode Jitter Algorithm Unit Tests (US2)", () => {
  it("should generate jitter offset strictly between 2 and 4", () => {
    for (let i = 0; i < 100; i++) {
      const { jitterOffset } = calculateCramJitter(0, 10);
      expect(jitterOffset).toBeGreaterThanOrEqual(2);
      expect(jitterOffset).toBeLessThanOrEqual(4);
    }
  });

  it("should clamp targetIndex to queueLength when pointer + offset exceeds queue size", () => {
    // Current pointer at 8 in queue of 9
    const { targetIndex } = calculateCramJitter(8, 9);
    expect(targetIndex).toBe(9);
  });

  it("should calculate targetIndex as pointer + jitterOffset when within bounds", () => {
    const { jitterOffset, targetIndex } = calculateCramJitter(1, 10);
    expect(targetIndex).toBe(1 + jitterOffset);
    expect(targetIndex).toBeLessThanOrEqual(10);
  });
});
