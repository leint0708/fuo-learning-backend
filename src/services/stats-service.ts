import { eq, and, sql, desc } from "drizzle-orm";
import type { Database } from "../db";
import { exam_attempts, exams, subjects, user_statistics } from "../db/schema";
import type {
  SubjectStatsItem,
  UserStatisticsResponse,
  AttemptHistoryItem
} from "../schemas/stats";

export interface CalculateStatsInput {
  completedAttempts: Array<{
    id: string;
    exam_id: string;
    percentage_score: number;
    is_passed: boolean;
    duration_seconds: number;
  }>;
  allSubjects: Array<{
    id: string;
    code: string;
    title: string;
  }>;
  allExams: Array<{
    id: string;
    subject_id: string;
    code: string;
    title: string;
    passing_score_percentage: number;
  }>;
}

export function calculateBestAttemptStats(input: CalculateStatsInput): UserStatisticsResponse {
  const { completedAttempts, allSubjects, allExams } = input;
  const totalAttempts = completedAttempts.length;

  const examsBySubject = new Map<string, Array<typeof allExams[0]>>();
  const examById = new Map<string, typeof allExams[0]>();
  for (const ex of allExams) {
    examById.set(ex.id, ex);
    const existing = examsBySubject.get(ex.subject_id) || [];
    existing.push(ex);
    examsBySubject.set(ex.subject_id, existing);
  }

  if (totalAttempts === 0) {
    const emptyBreakdowns: SubjectStatsItem[] = allSubjects.map((s) => ({
      subject_code: s.code,
      subject_title: s.title,
      attempts_count: 0,
      average_score: 0.0,
      highest_score: 0.0,
      passed_exams_count: 0,
      total_exams_in_subject: (examsBySubject.get(s.id) || []).length
    }));

    return {
      total_attempts_count: 0,
      total_exams_passed: 0,
      overall_pass_rate: 0.0,
      overall_average_score: 0.0,
      total_practice_duration_minutes: 0,
      subject_breakdowns: emptyBreakdowns
    };
  }

  const totalDurationSeconds = completedAttempts.reduce(
    (acc, a) => acc + (a.duration_seconds || 0),
    0
  );
  const totalScoreSum = completedAttempts.reduce(
    (acc, a) => acc + (a.percentage_score || 0),
    0
  );
  const overallAvg = Number((totalScoreSum / totalAttempts).toFixed(2));
  const totalPracticeMinutes = Math.floor(totalDurationSeconds / 60);

  // Best score per unique exam
  const bestAttemptPerExam = new Map<
    string,
    { bestScore: number; isPassed: boolean }
  >();

  for (const a of completedAttempts) {
    const existing = bestAttemptPerExam.get(a.exam_id);
    if (!existing || a.percentage_score > existing.bestScore) {
      bestAttemptPerExam.set(a.exam_id, {
        bestScore: a.percentage_score,
        isPassed: a.is_passed
      });
    }
  }

  const uniqueExamsAttemptedCount = bestAttemptPerExam.size;
  const uniquePassedExamsCount = Array.from(bestAttemptPerExam.values()).filter(
    (e) => e.isPassed
  ).length;

  const overallPassRate =
    uniqueExamsAttemptedCount > 0
      ? Number((uniquePassedExamsCount / uniqueExamsAttemptedCount).toFixed(4))
      : 0.0;

  // Breakdown per subject
  const breakdowns: SubjectStatsItem[] = allSubjects.map((s) => {
    const subjectExams = examsBySubject.get(s.id) || [];
    const subjectExamIdSet = new Set(subjectExams.map((e) => e.id));
    const subjectAttempts = completedAttempts.filter((a) =>
      subjectExamIdSet.has(a.exam_id)
    );

    const attemptsCount = subjectAttempts.length;
    let avgScore = 0.0;
    let highestScore = 0.0;

    if (attemptsCount > 0) {
      const subjectScoreSum = subjectAttempts.reduce(
        (acc, a) => acc + (a.percentage_score || 0),
        0
      );
      avgScore = Number((subjectScoreSum / attemptsCount).toFixed(2));
      highestScore = Number(
        Math.max(...subjectAttempts.map((a) => a.percentage_score)).toFixed(2)
      );
    }

    // Passed exams count in this subject using best attempt
    let passedCount = 0;
    for (const ex of subjectExams) {
      const best = bestAttemptPerExam.get(ex.id);
      if (best && best.isPassed) {
        passedCount++;
      }
    }

    return {
      subject_code: s.code,
      subject_title: s.title,
      attempts_count: attemptsCount,
      average_score: avgScore,
      highest_score: highestScore,
      passed_exams_count: passedCount,
      total_exams_in_subject: subjectExams.length
    };
  });

  return {
    total_attempts_count: totalAttempts,
    total_exams_passed: uniquePassedExamsCount,
    overall_pass_rate: overallPassRate,
    overall_average_score: overallAvg,
    total_practice_duration_minutes: totalPracticeMinutes,
    subject_breakdowns: breakdowns
  };
}

export async function recalculateUserStatsOnSubmit(
  db: Database,
  userId: string
): Promise<UserStatisticsResponse> {
  const completedAttempts = await db
    .select({
      id: exam_attempts.id,
      exam_id: exam_attempts.exam_id,
      percentage_score: exam_attempts.percentage_score,
      is_passed: exam_attempts.is_passed,
      duration_seconds: exam_attempts.duration_seconds
    })
    .from(exam_attempts)
    .where(
      and(
        eq(exam_attempts.user_id, userId),
        sql`${exam_attempts.status} IN ('completed', 'timed_out')`
      )
    )
    .all();

  const allSubjects = await db.select().from(subjects).all();
  const allExams = await db.select().from(exams).all();

  const stats = calculateBestAttemptStats({
    completedAttempts,
    allSubjects,
    allExams
  });

  const nowIso = new Date().toISOString();
  await db
    .insert(user_statistics)
    .values({
      user_id: userId,
      total_attempts_count: stats.total_attempts_count,
      total_exams_passed: stats.total_exams_passed,
      overall_pass_rate: stats.overall_pass_rate,
      overall_average_score: stats.overall_average_score,
      total_practice_seconds: stats.total_practice_duration_minutes * 60,
      subject_breakdowns: JSON.stringify(stats.subject_breakdowns),
      updated_at: nowIso
    })
    .onConflictDoUpdate({
      target: user_statistics.user_id,
      set: {
        total_attempts_count: stats.total_attempts_count,
        total_exams_passed: stats.total_exams_passed,
        overall_pass_rate: stats.overall_pass_rate,
        overall_average_score: stats.overall_average_score,
        total_practice_seconds: stats.total_practice_duration_minutes * 60,
        subject_breakdowns: JSON.stringify(stats.subject_breakdowns),
        updated_at: nowIso
      }
    });

  return stats;
}

export async function getUserStatistics(
  db: Database,
  userId: string
): Promise<UserStatisticsResponse> {
  return recalculateUserStatsOnSubmit(db, userId);
}

export async function getUserAttemptHistory(
  db: Database,
  userId: string,
  options?: { subject_code?: string; skip?: number; limit?: number }
): Promise<AttemptHistoryItem[]> {
  const skip = options?.skip ?? 0;
  const limit = Math.min(options?.limit ?? 20, 100);

  const query = db
    .select({
      attempt_id: exam_attempts.id,
      exam_id: exam_attempts.exam_id,
      exam_code: exams.code,
      exam_title: exams.title,
      subject_code: subjects.code,
      started_at: exam_attempts.started_at,
      submitted_at: exam_attempts.submitted_at,
      status: exam_attempts.status,
      percentage_score: exam_attempts.percentage_score,
      is_passed: exam_attempts.is_passed,
      duration_seconds: exam_attempts.duration_seconds
    })
    .from(exam_attempts)
    .innerJoin(exams, eq(exam_attempts.exam_id, exams.id))
    .innerJoin(subjects, eq(exams.subject_id, subjects.id))
    .where(
      options?.subject_code
        ? and(
            eq(exam_attempts.user_id, userId),
            eq(subjects.code, options.subject_code)
          )
        : eq(exam_attempts.user_id, userId)
    )
    .orderBy(desc(exam_attempts.started_at))
    .limit(limit)
    .offset(skip);

  const rows = await query.all();
  return rows;
}
