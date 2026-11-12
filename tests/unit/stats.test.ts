import { describe, it, expect } from "vitest";
import { calculateBestAttemptStats } from "../../src/services/stats-service";

describe("Best Attempt Statistics Calculation (US5 Unit Tests)", () => {
  const mockSubjects = [
    { id: "subj-1", code: "MAD101", title: "Discrete Mathematics" },
    { id: "subj-2", code: "PRO192", title: "Java Programming" }
  ];

  const mockExams = [
    {
      id: "exam-1",
      subject_id: "subj-1",
      code: "MAD-EX1",
      title: "MAD Exam 1",
      passing_score_percentage: 70
    },
    {
      id: "exam-2",
      subject_id: "subj-1",
      code: "MAD-EX2",
      title: "MAD Exam 2",
      passing_score_percentage: 70
    },
    {
      id: "exam-3",
      subject_id: "subj-2",
      code: "PRO-EX1",
      title: "PRO Exam 1",
      passing_score_percentage: 60
    }
  ];

  it("should return zero-state statistics when user has zero completed attempts", () => {
    const result = calculateBestAttemptStats({
      completedAttempts: [],
      allSubjects: mockSubjects,
      allExams: mockExams
    });

    expect(result.total_attempts_count).toBe(0);
    expect(result.total_exams_passed).toBe(0);
    expect(result.overall_pass_rate).toBe(0);
    expect(result.overall_average_score).toBe(0);
    expect(result.total_practice_duration_minutes).toBe(0);
    expect(result.subject_breakdowns.length).toBe(2);

    const mad = result.subject_breakdowns.find((s) => s.subject_code === "MAD101");
    expect(mad).toBeDefined();
    expect(mad?.attempts_count).toBe(0);
    expect(mad?.passed_exams_count).toBe(0);
    expect(mad?.total_exams_in_subject).toBe(2);
  });

  it("should select the highest score for an exam to determine pass status (Best Attempt Model)", () => {
    // Student takes exam-1 twice: first 50% (fail), then 80% (pass)
    // Student takes exam-2 twice: first 40% (fail), then 65% (fail)
    // Student takes exam-3 once: 75% (pass)
    const attempts = [
      {
        id: "att-1",
        exam_id: "exam-1",
        percentage_score: 50,
        is_passed: false,
        duration_seconds: 1200
      },
      {
        id: "att-2",
        exam_id: "exam-1",
        percentage_score: 80,
        is_passed: true,
        duration_seconds: 1500
      },
      {
        id: "att-3",
        exam_id: "exam-2",
        percentage_score: 40,
        is_passed: false,
        duration_seconds: 900
      },
      {
        id: "att-4",
        exam_id: "exam-2",
        percentage_score: 65,
        is_passed: false,
        duration_seconds: 1100
      },
      {
        id: "att-5",
        exam_id: "exam-3",
        percentage_score: 75,
        is_passed: true,
        duration_seconds: 1800
      }
    ];

    const result = calculateBestAttemptStats({
      completedAttempts: attempts,
      allSubjects: mockSubjects,
      allExams: mockExams
    });

    // Total attempts across all sittings = 5
    expect(result.total_attempts_count).toBe(5);

    // Total practice time = (1200 + 1500 + 900 + 1100 + 1800) / 60 = 6500 / 60 = 108 minutes
    expect(result.total_practice_duration_minutes).toBe(108);

    // Overall average score = (50 + 80 + 40 + 65 + 75) / 5 = 310 / 5 = 62.0
    expect(result.overall_average_score).toBe(62.0);

    // Unique exams attempted: 3 (exam-1, exam-2, exam-3)
    // Best of exam-1: 80 (passed)
    // Best of exam-2: 65 (failed)
    // Best of exam-3: 75 (passed)
    // Passed unique exams = 2 (exam-1 and exam-3)
    expect(result.total_exams_passed).toBe(2);

    // Pass rate = 2 / 3 = 0.6667
    expect(result.overall_pass_rate).toBe(0.6667);

    // Check MAD101 subject breakdown
    const mad = result.subject_breakdowns.find((s) => s.subject_code === "MAD101")!;
    expect(mad.attempts_count).toBe(4);
    // Average score in MAD101 = (50 + 80 + 40 + 65) / 4 = 235 / 4 = 58.75
    expect(mad.average_score).toBe(58.75);
    // Highest score achieved in MAD101
    expect(mad.highest_score).toBe(80.0);
    // Unique exams passed in MAD101: exam-1 passed, exam-2 failed -> 1 passed
    expect(mad.passed_exams_count).toBe(1);
    expect(mad.total_exams_in_subject).toBe(2);

    // Check PRO192 subject breakdown
    const pro = result.subject_breakdowns.find((s) => s.subject_code === "PRO192")!;
    expect(pro.attempts_count).toBe(1);
    expect(pro.average_score).toBe(75.0);
    expect(pro.highest_score).toBe(75.0);
    expect(pro.passed_exams_count).toBe(1);
    expect(pro.total_exams_in_subject).toBe(1);
  });
});
