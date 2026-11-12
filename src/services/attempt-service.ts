import { eq, and, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import { exams, questions, exam_attempts, attempt_answers } from "../db/schema";
import {
  normalizeAnswer,
  gradeQuestion,
  isAttemptExpired,
  getRemainingSeconds
} from "./grading-service";
import { recalculateUserStatsOnSubmit } from "./stats-service";
import type {
  AttemptSessionResponse,
  AnswerSavedResponse,
  AttemptResultResponse,
  AttemptQuestion
} from "../schemas/attempts";

export async function startAttempt(
  db: Database,
  userId: string,
  examId: string
): Promise<AttemptSessionResponse> {
  const exam = await db.select().from(exams).where(eq(exams.id, examId)).get();
  if (!exam) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

  // Check for existing active, unexpired attempt
  const now = Date.now();
  const existingAttempts = await db
    .select()
    .from(exam_attempts)
    .where(
      and(
        eq(exam_attempts.user_id, userId),
        eq(exam_attempts.exam_id, examId),
        eq(exam_attempts.status, "in_progress")
      )
    )
    .all();

  const activeAttempt = existingAttempts.find(
    (a) => new Date(a.expires_at).getTime() > now
  );

  if (activeAttempt) {
    throw new HTTPException(400, {
      message: "User already has an ongoing active attempt on this exam"
    });
  }

  const attemptId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const expiresIso = new Date(now + exam.duration_minutes * 60 * 1000).toISOString();

  await db.insert(exam_attempts).values({
    id: attemptId,
    user_id: userId,
    exam_id: examId,
    status: "in_progress",
    started_at: nowIso,
    expires_at: expiresIso,
    total_questions: exam.total_questions,
    correct_answers_count: 0,
    total_score: 0.0,
    percentage_score: 0.0,
    is_passed: false,
    duration_seconds: 0
  });

  return getAttemptSession(db, userId, attemptId);
}

export async function getAttemptSession(
  db: Database,
  userId: string,
  attemptId: string
): Promise<AttemptSessionResponse> {
  const attempt = await db
    .select()
    .from(exam_attempts)
    .where(eq(exam_attempts.id, attemptId))
    .get();

  if (!attempt) {
    throw new HTTPException(404, { message: "Attempt not found" });
  }

  if (attempt.user_id !== userId) {
    throw new HTTPException(403, { message: "Forbidden: Not the attempt owner" });
  }

  // Check auto-expiration
  if (attempt.status === "in_progress" && isAttemptExpired(attempt.expires_at)) {
    return (await submitAttempt(db, userId, attemptId, true)) as any;
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

  const answerMap = new Map(recordedAnswers.map((a) => [a.question_id, a.selected_options]));

  const maskedQuestions: AttemptQuestion[] = examQuestions.map((q) => {
    let parsedOptions: Record<string, string> = {};
    try {
      parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    } catch {
      parsedOptions = { A: "Option A", B: "Option B", C: "Option C", D: "Option D" };
    }

    return {
      question_id: q.id,
      question_number: q.question_number,
      question_id_code: q.question_id_code,
      question_type: q.question_type as "single_choice" | "multiple_choice",
      question_text: q.question_text,
      image_url: q.image_file,
      options: parsedOptions,
      selected_options: answerMap.get(q.id) || null
    };
  });

  return {
    attempt_id: attempt.id,
    exam_id: attempt.exam_id,
    exam_title: exam?.title || "",
    status: attempt.status as "in_progress" | "completed" | "timed_out",
    started_at: attempt.started_at,
    expires_at: attempt.expires_at,
    time_remaining_seconds: getRemainingSeconds(attempt.expires_at),
    questions: maskedQuestions
  };
}

export async function saveAnswer(
  db: Database,
  userId: string,
  attemptId: string,
  questionId: string,
  selectedOptions: string
): Promise<AnswerSavedResponse> {
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

  if (attempt.status !== "in_progress") {
    throw new HTTPException(400, { message: "Attempt is already finalized" });
  }

  if (isAttemptExpired(attempt.expires_at)) {
    await submitAttempt(db, userId, attemptId, true);
    throw new HTTPException(400, { message: "Attempt duration has expired and was auto-submitted" });
  }

  const normalized = normalizeAnswer(selectedOptions);
  const now = new Date().toISOString();

  const existingAnswer = await db
    .select()
    .from(attempt_answers)
    .where(
      and(
        eq(attempt_answers.attempt_id, attemptId),
        eq(attempt_answers.question_id, questionId)
      )
    )
    .get();

  if (existingAnswer) {
    await db
      .update(attempt_answers)
      .set({
        selected_options: normalized,
        answered_at: now
      })
      .where(eq(attempt_answers.id, existingAnswer.id));
  } else {
    await db.insert(attempt_answers).values({
      id: crypto.randomUUID(),
      attempt_id: attemptId,
      question_id: questionId,
      selected_options: normalized,
      is_correct: false,
      points_awarded: 0.0,
      answered_at: now
    });
  }

  return {
    question_id: questionId,
    selected_options: normalized,
    saved_at: now
  };
}

export async function submitAttempt(
  db: Database,
  userId: string,
  attemptId: string,
  isTimedOut: boolean = false
): Promise<AttemptResultResponse> {
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

  if (attempt.status === "completed" || attempt.status === "timed_out") {
    throw new HTTPException(400, { message: "Attempt already submitted" });
  }

  const exam = await db.select().from(exams).where(eq(exams.id, attempt.exam_id)).get();
  if (!exam) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

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

  let correctCount = 0;
  let totalScore = 0.0;

  for (const q of examQuestions) {
    const existingAns = answerMap.get(q.id);
    const submittedOptions = existingAns ? existingAns.selected_options : "";
    const grading = gradeQuestion(q.question_type, submittedOptions, q.correct_answer);

    if (grading.isCorrect) {
      correctCount++;
      totalScore += grading.pointsAwarded;
    }

    if (existingAns) {
      await db
        .update(attempt_answers)
        .set({
          is_correct: grading.isCorrect,
          points_awarded: grading.pointsAwarded
        })
        .where(eq(attempt_answers.id, existingAns.id));
    }
  }

  const totalQuestions = examQuestions.length > 0 ? examQuestions.length : exam.total_questions;
  const percentage = (correctCount / totalQuestions) * 100;
  const isPassed = percentage >= exam.passing_score_percentage;
  const now = new Date();
  const startedAt = new Date(attempt.started_at);
  const durationSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  const finalStatus = isTimedOut ? "timed_out" : "completed";
  const nowIso = now.toISOString();

  await db
    .update(exam_attempts)
    .set({
      status: finalStatus,
      submitted_at: nowIso,
      total_questions: totalQuestions,
      correct_answers_count: correctCount,
      total_score: totalScore,
      percentage_score: Number(percentage.toFixed(2)),
      is_passed: isPassed,
      duration_seconds: durationSeconds
    })
    .where(eq(exam_attempts.id, attemptId));

  // Recalculate stats for user
  await recalculateUserStatsOnSubmit(db, userId);

  return {
    attempt_id: attemptId,
    status: finalStatus,
    total_questions: totalQuestions,
    correct_answers_count: correctCount,
    total_score: totalScore,
    percentage_score: Number(percentage.toFixed(2)),
    is_passed: isPassed,
    submitted_at: nowIso,
    duration_seconds: durationSeconds
  };
}

export async function updateUserStatistics(db: Database, userId: string): Promise<void> {
  await recalculateUserStatsOnSubmit(db, userId);
}
