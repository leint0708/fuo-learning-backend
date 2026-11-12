import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import { exams, questions, exam_attempts, attempt_answers } from "../db/schema";
import type { AttemptReviewResponse, ReviewQuestionItem } from "../schemas/review";

export async function getAttemptReview(
  db: Database,
  userId: string,
  attemptId: string
): Promise<AttemptReviewResponse> {
  const attempt = await db
    .select()
    .from(exam_attempts)
    .where(eq(exam_attempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new HTTPException(404, { message: "Attempt not found" });
  }

  if (attempt.user_id !== userId) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  if (attempt.status === "in_progress") {
    throw new HTTPException(400, {
      message: "Attempt is still in progress; review not permitted until finalized"
    });
  }

  const exam = await db.select().from(exams).where(eq(exams.id, attempt.exam_id)).get();
  const examQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.exam_id, attempt.exam_id))
    .all();

  const recordedAnswers = await db
    .select()
    .from(attempt_answers)
    .where(eq(attempt_answers.attempt_id, attemptId))
    .all();

  const answerMap = new Map(recordedAnswers.map((a) => [a.question_id, a]));

  const reviewedQuestions: ReviewQuestionItem[] = examQuestions.map((q) => {
    let parsedOptions: Record<string, string> = {};
    try {
      parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    } catch {
      parsedOptions = { A: "Option A", B: "Option B", C: "Option C", D: "Option D" };
    }

    let parsedAnalysis: Record<string, string> | null = null;
    if (q.option_by_option_analysis) {
      try {
        parsedAnalysis =
          typeof q.option_by_option_analysis === "string"
            ? JSON.parse(q.option_by_option_analysis)
            : q.option_by_option_analysis;
      } catch {
        parsedAnalysis = null;
      }
    }

    const recorded = answerMap.get(q.id);

    return {
      question_id: q.id,
      question_number: q.question_number,
      question_id_code: q.question_id_code,
      question_type: q.question_type as "single_choice" | "multiple_choice",
      question_text: q.question_text,
      image_url: q.image_file,
      options: parsedOptions,
      selected_options: recorded ? recorded.selected_options : null,
      correct_answer: q.correct_answer,
      is_correct: recorded ? recorded.is_correct : false,
      ai_explanation: q.ai_explanation,
      option_by_option_analysis: parsedAnalysis
    };
  });

  return {
    attempt_id: attempt.id,
    exam_title: exam?.title || "",
    status: attempt.status as "completed" | "timed_out",
    percentage_score: attempt.percentage_score,
    is_passed: attempt.is_passed,
    submitted_at: attempt.submitted_at,
    duration_seconds: attempt.duration_seconds,
    questions: reviewedQuestions
  };
}
