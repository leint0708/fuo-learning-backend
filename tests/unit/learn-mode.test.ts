import { describe, it, expect } from "vitest";
import { calculateLearnFeedback } from "../../src/services/practice-service";

describe("Learn Mode Logic Unit Tests (US3)", () => {
  describe("Feedback Tiers by Error Rate", () => {
    it("should return emerald tone and perfection headline for 0% error rate", () => {
      const feedback = calculateLearnFeedback(0);
      expect(feedback.visualTone).toBe("emerald");
      expect(feedback.headline).toContain("Xuất sắc");
    });

    it("should return amber tone for error rate < 30%", () => {
      const feedback = calculateLearnFeedback(0.2);
      expect(feedback.visualTone).toBe("amber");
      expect(feedback.headline).toContain("Rất tốt");
    });

    it("should return blue tone for 30% <= error rate < 60%", () => {
      const feedback = calculateLearnFeedback(0.4);
      expect(feedback.visualTone).toBe("blue");
      expect(feedback.headline).toContain("Cố lên");
    });

    it("should return indigo tone for error rate >= 60%", () => {
      const feedback = calculateLearnFeedback(0.75);
      expect(feedback.visualTone).toBe("indigo");
      expect(feedback.headline).toContain("Đừng nản");
    });
  });
});
