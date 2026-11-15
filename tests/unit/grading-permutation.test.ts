import { describe, it, expect } from "vitest";
import { normalizeAnswer, gradeQuestion } from "../../src/services/grading-service";
import { isQuestionMultiSelect } from "../../src/services/practice-service";

describe("Question Interaction & Permutation Invariance Unit Tests (US5)", () => {
  describe("isQuestionMultiSelect detection", () => {
    it("should identify single character answer as single-choice", () => {
      expect(isQuestionMultiSelect("A")).toBe(false);
      expect(isQuestionMultiSelect("D")).toBe(false);
    });

    it("should identify multiple characters as multi-select", () => {
      expect(isQuestionMultiSelect("AB")).toBe(true);
      expect(isQuestionMultiSelect("A, C, D")).toBe(true);
      expect(isQuestionMultiSelect("BCA")).toBe(true);
    });
  });

  describe("Permutation Invariance in Multi-Select Grading", () => {
    it("should evaluate scrambled option selections as correct", () => {
      // Key: "ACD" -> user selects "DCA"
      const res1 = gradeQuestion("multiple_choice", "DCA", "ACD");
      expect(res1.isCorrect).toBe(true);
      expect(res1.pointsAwarded).toBe(1.0);

      // Key: "B, D" -> user selects "d b"
      const res2 = gradeQuestion("multiple_choice", "d b", "B, D");
      expect(res2.isCorrect).toBe(true);

      // Key: "ABCD" -> user selects "d c b a"
      const res3 = gradeQuestion("multiple_choice", "d c b a", "ABCD");
      expect(res3.isCorrect).toBe(true);
    });

    it("should fail when options are missing or extraneous options are included", () => {
      const res1 = gradeQuestion("multiple_choice", "AC", "ACD");
      expect(res1.isCorrect).toBe(false);

      const res2 = gradeQuestion("multiple_choice", "ACDE", "ACD");
      expect(res2.isCorrect).toBe(false);
    });
  });
});
