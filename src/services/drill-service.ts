import { eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import { subjects, exams, questions } from "../db/schema";
import { gradeQuestion, normalizeAnswer } from "./grading-service";
import type {
  PracticeQuestion,
  DrillCheckResponse
} from "../schemas/questions";

export async function getDrillQuestions(
  db: Database,
  subjectCode: string,
  count: number = 10
): Promise<PracticeQuestion[]> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const subjectExams = await db
    .select({ id: exams.id })
    .from(exams)
    .where(eq(exams.subject_id, subject.id))
    .all();

  if (subjectExams.length === 0) {
    return [];
  }

  const examIds = subjectExams.map((e) => e.id);
  const clampedCount = Math.max(1, Math.min(count, 50));

  const drillQuestions = await db
    .select()
    .from(questions)
    .where(inArray(questions.exam_id, examIds))
    .limit(clampedCount)
    .all();

  return drillQuestions.map((q) => {
    let parsedOptions: Record<string, string> = {};
    try {
      parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    } catch {
      parsedOptions = { A: "Option A", B: "Option B", C: "Option C", D: "Option D" };
    }

    return {
      question_id: q.id,
      subject_code: subject.code,
      question_type: q.question_type as "single_choice" | "multiple_choice",
      question_text: q.question_text,
      image_url: q.image_file,
      options: parsedOptions
    };
  });
}

export async function checkDrillAnswer(
  db: Database,
  questionId: string,
  selectedOptions: string
): Promise<DrillCheckResponse> {
  const q = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .get();

  if (!q) {
    throw new HTTPException(404, { message: "Question not found" });
  }

  const normalizedSelection = normalizeAnswer(selectedOptions);
  const grading = gradeQuestion(q.question_type, normalizedSelection, q.correct_answer);

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

  return {
    question_id: q.id,
    selected_options: normalizedSelection,
    correct_answer: q.correct_answer,
    is_correct: grading.isCorrect,
    ai_explanation: q.ai_explanation,
    option_by_option_analysis: parsedAnalysis
  };
}
