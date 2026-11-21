import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import { gradeQuestion, normalizeAnswer } from "./grading-service";
import {
  parseCommunityStats,
  resolveBenchmarkAnswer,
  type BenchmarkMode
} from "./community-stats";
import {
  getCachedSubjectByCode,
  getCachedQuestionsBySubjectId,
  getCachedQuestionById
} from "./static-cache";
import type {
  PracticeQuestion,
  DrillCheckResponse
} from "../schemas/questions";

export async function getDrillQuestions(
  db: Database,
  subjectCode: string,
  count: number | null = 10
): Promise<PracticeQuestion[]> {
  const subject = await getCachedSubjectByCode(db, subjectCode);

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const allSubjectQuestions = await getCachedQuestionsBySubjectId(db, subject.id);
  const drillQuestions =
    count === null
      ? allSubjectQuestions
      : allSubjectQuestions.slice(0, Math.max(1, Math.floor(count)));

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
  selectedOptions: string,
  benchmarkMode: BenchmarkMode = "ai"
): Promise<DrillCheckResponse> {
  const q = await getCachedQuestionById(db, questionId);

  if (!q) {
    throw new HTTPException(404, { message: "Question not found" });
  }

  const communityStats = parseCommunityStats(q.community_stats);
  const { benchmarkSource, correctAnswer } = resolveBenchmarkAnswer(
    q.correct_answer,
    communityStats,
    benchmarkMode
  );

  const normalizedSelection = normalizeAnswer(selectedOptions);
  const grading = gradeQuestion(q.question_type, normalizedSelection, correctAnswer);

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
    correct_answer: correctAnswer,
    is_correct: grading.isCorrect,
    ai_explanation: q.ai_explanation,
    option_by_option_analysis: parsedAnalysis,
    benchmark_source: benchmarkSource,
    community_stats: communityStats
  };
}
