import { describe, it, expect } from "vitest";
import { normalizeAnswer, gradeQuestion, isAttemptExpired, getRemainingSeconds } from "../../src/services/grading-service";

describe("Grading Service & All-or-Nothing Scoring (T028)", () => {
  describe("normalizeAnswer", () => {
    it("should uppercase and trim single choice answers", () => {
      expect(normalizeAnswer(" c ")).toBe("C");
      expect(normalizeAnswer("a")).toBe("A");
    });

    it("should sort and deduplicate multiple choice answers", () => {
      expect(normalizeAnswer("B, A, D")).toBe("ABD");
      expect(normalizeAnswer("DAB")).toBe("ABD");
      expect(normalizeAnswer("A-C-D")).toBe("ACD");
    });
  });

  describe("gradeQuestion", () => {
    it("should award 1 point for single_choice exact match", () => {
      const result = gradeQuestion("single_choice", "C", "C");
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(1.0);
    });

    it("should award 0 points for single_choice incorrect answer", () => {
      const result = gradeQuestion("single_choice", "B", "C");
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0.0);
    });

    it("should award 1 point for multiple_choice exact match regardless of input order", () => {
      const result = gradeQuestion("multiple_choice", "DCA", "ACD");
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(1.0);
    });

    it("should award 0 points (no partial credit) for subset of multiple_choice options", () => {
      const result = gradeQuestion("multiple_choice", "AC", "ACD");
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0.0);
    });

    it("should award 0 points for empty answer", () => {
      const result = gradeQuestion("single_choice", "", "A");
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0.0);
    });
  });

  describe("Timer validation", () => {
    it("should detect expired attempt correctly", () => {
      const pastTime = new Date(Date.now() - 5000).toISOString();
      expect(isAttemptExpired(pastTime)).toBe(true);
      expect(getRemainingSeconds(pastTime)).toBe(0);
    });

    it("should detect active attempt and calculate remaining seconds", () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();
      expect(isAttemptExpired(futureTime)).toBe(false);
      expect(getRemainingSeconds(futureTime)).toBeGreaterThan(50);
    });
  });
});
