import { eq, and, sql, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import {
  subjects,
  questions,
  practice_sessions,
  user_card_mastery
} from "../db/schema";
import type {
  CramSessionData,
  LearnSessionData,
  PracticeSessionData,
  RoundAuditItem,
  LearnRoundSummary
} from "../types/practice";
import type {
  PracticeSessionResponse,
  PracticeCard,
  SubmitPracticeAnswerResponse,
  SubjectPracticeProgressResponse,
  SyncPracticeProgressRequest,
  PracticeProgressSummaryItem,
  CardMasteryStat,
  CramActiveBatch
} from "../schemas/practice";
import { normalizeAnswer, gradeQuestion } from "./grading-service";

// Utility: Fisher-Yates shuffle
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Utility: Jitter calculation for Cram Mode
export function calculateCramJitter(
  currentPointer: number,
  queueLength: number
): { jitterOffset: number; targetIndex: number } {
  // J = 2 + random(0, 2) => J in {2, 3, 4}
  const jitterOffset = 2 + Math.floor(Math.random() * 3);
  const targetIndex = Math.min(currentPointer + jitterOffset, queueLength);
  return { jitterOffset, targetIndex };
}

// Utility: Calculate Learn Mode error rate and feedback tier
export function calculateLearnFeedback(errorRate: number): {
  headline: string;
  visualTone: "emerald" | "amber" | "blue" | "indigo";
} {
  if (errorRate === 0) {
    return { headline: "Xuất sắc! Hoàn hảo! 🌟", visualTone: "emerald" };
  }
  if (errorRate < 0.3) {
    return { headline: "Rất tốt! Tiếp tục nào! 🔥", visualTone: "amber" };
  }
  if (errorRate < 0.6) {
    return { headline: "Cố lên! Bạn đang tiến bộ! 💪", visualTone: "blue" };
  }
  return { headline: "Đừng nản! Lặp lại là chìa khóa! 🧠", visualTone: "indigo" };
}

// Helper: Check if question is multi-select
export function isQuestionMultiSelect(correctAnswer: string): boolean {
  const cleaned = correctAnswer.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.length > 1;
}

// Helper: Format question entity into client-safe PracticeCard (masks answer keys)
export function formatPracticeCard(q: any): PracticeCard {
  let parsedOptions: any = {};
  try {
    parsedOptions = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
  } catch {
    parsedOptions = {};
  }

  let formattedOptions: { key: string; text: string }[] = [];
  if (Array.isArray(parsedOptions)) {
    formattedOptions = parsedOptions.map((opt: any) => ({
      key: opt.key || opt.option_key || "",
      text: opt.text || opt.option_text || ""
    }));
  } else if (parsedOptions && typeof parsedOptions === "object") {
    formattedOptions = Object.entries(parsedOptions).map(([key, text]) => ({
      key,
      text: String(text)
    }));
  }

  return {
    id: q.id,
    question_number: q.question_number,
    question_id_code: q.question_id_code,
    question_text: q.question_text,
    image_file: q.image_file,
    question_type: q.question_type,
    is_multi_select: isQuestionMultiSelect(q.correct_answer),
    options: formattedOptions
  };
}

// Database helper: Get or create user card mastery records
export async function getUserCardMastery(
  db: Database,
  userId: string,
  questionId: string
) {
  return await db
    .select()
    .from(user_card_mastery)
    .where(
      and(
        eq(user_card_mastery.user_id, userId),
        eq(user_card_mastery.question_id, questionId)
      )
    )
    .get();
}

// Database helper: Upsert card mastery record
export async function upsertCardMastery(
  db: Database,
  userId: string,
  subjectId: string,
  questionId: string,
  updates: Partial<typeof user_card_mastery.$inferInsert>
) {
  const existing = await getUserCardMastery(db, userId, questionId);
  const nowIso = new Date().toISOString();

  if (existing) {
    await db
      .update(user_card_mastery)
      .set({
        ...updates,
        updated_at: nowIso
      })
      .where(eq(user_card_mastery.id, existing.id));
    return { ...existing, ...updates, updated_at: nowIso };
  }

  const id = crypto.randomUUID();
  const newRecord = {
    id,
    user_id: userId,
    subject_id: subjectId,
    question_id: questionId,
    cram_mastered: updates.cram_mastered ?? false,
    learn_state: updates.learn_state ?? "not_yet_learned",
    consecutive_correct: updates.consecutive_correct ?? 0,
    wrong_attempts: updates.wrong_attempts ?? 0,
    total_attempts: updates.total_attempts ?? 0,
    updated_at: nowIso
  };

  await db.insert(user_card_mastery).values(newRecord);
  return newRecord;
}

// Database helper: Reset mastery records for a subject (optionally scoped to cram or learn)
export async function resetSubjectMastery(
  db: Database,
  userId: string,
  subjectCode: string,
  mode?: "cram" | "learn"
): Promise<{ message: string }> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const nowIso = new Date().toISOString();

  if (mode === "cram") {
    await db
      .update(user_card_mastery)
      .set({
        cram_mastered: false,
        updated_at: nowIso
      })
      .where(
        and(
          eq(user_card_mastery.user_id, userId),
          eq(user_card_mastery.subject_id, subject.id)
        )
      );

    await db
      .update(practice_sessions)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(practice_sessions.user_id, userId),
          eq(practice_sessions.subject_id, subject.id),
          eq(practice_sessions.mode, "cram"),
          eq(practice_sessions.status, "in_progress")
        )
      );
  } else if (mode === "learn") {
    await db
      .update(user_card_mastery)
      .set({
        learn_state: "not_yet_learned",
        consecutive_correct: 0,
        wrong_attempts: 0,
        total_attempts: 0,
        updated_at: nowIso
      })
      .where(
        and(
          eq(user_card_mastery.user_id, userId),
          eq(user_card_mastery.subject_id, subject.id)
        )
      );

    await db
      .update(practice_sessions)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(practice_sessions.user_id, userId),
          eq(practice_sessions.subject_id, subject.id),
          eq(practice_sessions.mode, "learn"),
          eq(practice_sessions.status, "in_progress")
        )
      );
  } else {
    // Delete all user card mastery records for this subject
    await db
      .delete(user_card_mastery)
      .where(
        and(
          eq(user_card_mastery.user_id, userId),
          eq(user_card_mastery.subject_id, subject.id)
        )
      );

    // Mark any active practice sessions as abandoned
    await db
      .update(practice_sessions)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(practice_sessions.user_id, userId),
          eq(practice_sessions.subject_id, subject.id),
          eq(practice_sessions.status, "in_progress")
        )
      );
  }

  return { message: `Practice progress for subject ${subjectCode} has been reset.` };
}

export async function getUserPracticeProgressSummary(
  db: Database,
  userId: string
): Promise<PracticeProgressSummaryItem[]> {
  const rows = await db
    .select({
      subject_code: subjects.code,
      cram_mastered: user_card_mastery.cram_mastered,
      learn_state: user_card_mastery.learn_state
    })
    .from(user_card_mastery)
    .innerJoin(subjects, eq(user_card_mastery.subject_id, subjects.id))
    .where(eq(user_card_mastery.user_id, userId))
    .all();

  const bySubject = new Map<string, { cram_count: number; learn_count: number }>();
  for (const row of rows) {
    const entry = bySubject.get(row.subject_code) ?? { cram_count: 0, learn_count: 0 };
    if (row.cram_mastered) {
      entry.cram_count += 1;
    }
    if (row.learn_state === "learned") {
      entry.learn_count += 1;
    }
    bySubject.set(row.subject_code, entry);
  }

  return Array.from(bySubject.entries()).map(([subject_code, counts]) => ({
    subject_code,
    cram_count: counts.cram_count,
    learn_count: counts.learn_count
  }));
}

function extractCramActiveBatchFromSession(sessionRow: any): CramActiveBatch | null {
  if (!sessionRow) return null;
  let sessionData: any = null;
  try {
    sessionData =
      typeof sessionRow.session_data === "string"
        ? JSON.parse(sessionRow.session_data)
        : sessionRow.session_data;
  } catch {
    return null;
  }
  if (!sessionData || sessionData.mode !== "cram") return null;

  const activeQueueIds: string[] = Array.isArray(sessionData.active_queue)
    ? sessionData.active_queue.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  const masteredInBatchIds: string[] = Array.isArray(sessionData.mastered_in_batch)
    ? sessionData.mastered_in_batch.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  const batchQuestionIds: string[] = Array.isArray(sessionData.batch_question_ids)
    ? sessionData.batch_question_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : Array.from(new Set([...masteredInBatchIds, ...activeQueueIds]));

  if (batchQuestionIds.length === 0 || activeQueueIds.length === 0) {
    return null;
  }

  return {
    scope: sessionData.scope === "mistakes" ? "mistakes" : "deck",
    scoped_question_ids: Array.isArray(sessionData.scoped_question_ids)
      ? sessionData.scoped_question_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : undefined,
    batch_question_ids: batchQuestionIds,
    active_queue_ids: activeQueueIds,
    queue_pointer: Math.max(0, Math.min(Number(sessionData.current_pointer) || 0, activeQueueIds.length - 1)),
    mastered_in_batch_ids: masteredInBatchIds,
    missed_ids: Array.isArray(sessionData.missed_ids)
      ? sessionData.missed_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [],
    updated_at:
      typeof sessionData.updated_at === "string" && sessionData.updated_at
        ? sessionData.updated_at
        : String(sessionRow.started_at || new Date().toISOString())
  };
}

export async function getSubjectPracticeProgress(
  db: Database,
  userId: string,
  subjectCode: string
): Promise<SubjectPracticeProgressResponse> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const rows = await db
    .select()
    .from(user_card_mastery)
    .where(
      and(
        eq(user_card_mastery.user_id, userId),
        eq(user_card_mastery.subject_id, subject.id)
      )
    )
    .all();

  const cramMasteredIds: string[] = [];
  const learnMasteredIds: string[] = [];
  const cardStats: Record<string, CardMasteryStat> = {};

  for (const row of rows) {
    if (row.cram_mastered) {
      cramMasteredIds.push(row.question_id);
    }
    if (row.learn_state === "learned") {
      learnMasteredIds.push(row.question_id);
    }
    if (row.learn_state === "learned" || row.learn_state === "learning" || row.total_attempts > 0) {
      cardStats[row.question_id] = {
        question_id: row.question_id,
        consecutive_correct: row.consecutive_correct,
        wrong_attempts: row.wrong_attempts,
        total_attempts: row.total_attempts,
        status: row.learn_state === "learned" ? "learned" : "learning",
        last_answered_at: row.updated_at
      };
    }
  }

  const activeCramSession = await db
    .select()
    .from(practice_sessions)
    .where(
      and(
        eq(practice_sessions.user_id, userId),
        eq(practice_sessions.subject_id, subject.id),
        eq(practice_sessions.mode, "cram"),
        eq(practice_sessions.status, "in_progress")
      )
    )
    .get();

  const cramActiveBatch = extractCramActiveBatchFromSession(activeCramSession);

  return {
    subject_code: subject.code,
    cram_mastered_ids: cramMasteredIds,
    learn_mastered_ids: learnMasteredIds,
    card_stats: cardStats,
    cram_active_batch: cramActiveBatch
  };
}

export async function syncSubjectPracticeProgress(
  db: Database,
  userId: string,
  subjectCode: string,
  payload: SyncPracticeProgressRequest
): Promise<SubjectPracticeProgressResponse> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const validQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.subject_id, subject.id))
    .all();
  const validQuestionSet = new Set(validQuestions.map((q) => q.id));

  const existingRows = await db
    .select()
    .from(user_card_mastery)
    .where(
      and(
        eq(user_card_mastery.user_id, userId),
        eq(user_card_mastery.subject_id, subject.id)
      )
    )
    .all();
  const existingByQuestion = new Map(existingRows.map((r) => [r.question_id, r]));

  const incomingCramSet = new Set(
    (payload.cram_mastered_ids ?? []).filter((id) => validQuestionSet.has(id))
  );
  const incomingLearnSet = new Set(
    (payload.learn_mastered_ids ?? []).filter((id) => validQuestionSet.has(id))
  );
  const incomingStatsMap = payload.card_stats ?? {};

  const touchedQuestionIds = new Set<string>([
    ...incomingCramSet,
    ...incomingLearnSet,
    ...Object.keys(incomingStatsMap).filter((id) => validQuestionSet.has(id))
  ]);

  const nowIso = new Date().toISOString();
  const toInsert: Array<typeof user_card_mastery.$inferInsert> = [];
  const toUpdate: Array<{
    id: string;
    cram_mastered: boolean;
    learn_state: "not_yet_learned" | "learning" | "learned";
    consecutive_correct: number;
    wrong_attempts: number;
    total_attempts: number;
    updated_at: string;
  }> = [];

  for (const questionId of touchedQuestionIds) {
    const existing = existingByQuestion.get(questionId);
    const incomingStat = incomingStatsMap[questionId];

    const mergedCram = Boolean(existing?.cram_mastered) || incomingCramSet.has(questionId);
    const isLearned =
      existing?.learn_state === "learned" ||
      incomingLearnSet.has(questionId) ||
      incomingStat?.status === "learned";
    const isLearning =
      !isLearned && (existing?.learn_state === "learning" || incomingStat?.status === "learning");
    const mergedLearnState: "not_yet_learned" | "learning" | "learned" = isLearned
      ? "learned"
      : isLearning
        ? "learning"
        : "not_yet_learned";

    const mergedWrong = Math.max(existing?.wrong_attempts ?? 0, incomingStat?.wrong_attempts ?? 0);
    const mergedTotal = Math.max(
      existing?.total_attempts ?? 0,
      incomingStat?.total_attempts ?? 0,
      mergedLearnState === "learned" ? 1 : 0
    );

    let mergedConsecutive = existing?.consecutive_correct ?? 0;
    if (mergedLearnState === "learned") {
      mergedConsecutive = Math.max(
        mergedConsecutive,
        incomingStat?.consecutive_correct ?? 0,
        mergedWrong > 0 ? 2 : 1
      );
    } else if (incomingStat && (incomingStat.total_attempts ?? 0) >= (existing?.total_attempts ?? 0)) {
      mergedConsecutive = incomingStat.consecutive_correct ?? mergedConsecutive;
    }

    const updatedAt = incomingStat?.last_answered_at || nowIso;

    if (!existing) {
      toInsert.push({
        id: crypto.randomUUID(),
        user_id: userId,
        subject_id: subject.id,
        question_id: questionId,
        cram_mastered: mergedCram,
        learn_state: mergedLearnState,
        consecutive_correct: mergedConsecutive,
        wrong_attempts: mergedWrong,
        total_attempts: mergedTotal,
        updated_at: updatedAt
      });
    } else {
      const changed =
        Boolean(existing.cram_mastered) !== mergedCram ||
        existing.learn_state !== mergedLearnState ||
        existing.consecutive_correct !== mergedConsecutive ||
        existing.wrong_attempts !== mergedWrong ||
        existing.total_attempts !== mergedTotal;

      if (changed) {
        toUpdate.push({
          id: existing.id,
          cram_mastered: mergedCram,
          learn_state: mergedLearnState,
          consecutive_correct: mergedConsecutive,
          wrong_attempts: mergedWrong,
          total_attempts: mergedTotal,
          updated_at: nowIso
        });
      }
    }
  }

  // Chunk multi-row inserts (9 columns per row -> 10 rows = 90 bind params, safe for D1/SQLite)
  for (let i = 0; i < toInsert.length; i += 10) {
    const chunk = toInsert.slice(i, i + 10);
    await db.insert(user_card_mastery).values(chunk);
  }

  for (const row of toUpdate) {
    await db
      .update(user_card_mastery)
      .set({
        cram_mastered: row.cram_mastered,
        learn_state: row.learn_state,
        consecutive_correct: row.consecutive_correct,
        wrong_attempts: row.wrong_attempts,
        total_attempts: row.total_attempts,
        updated_at: row.updated_at
      })
      .where(eq(user_card_mastery.id, row.id));
  }

  if (payload.cram_active_batch === null) {
    await db
      .update(practice_sessions)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(practice_sessions.user_id, userId),
          eq(practice_sessions.subject_id, subject.id),
          eq(practice_sessions.mode, "cram"),
          eq(practice_sessions.status, "in_progress")
        )
      );
  } else if (payload.cram_active_batch) {
    const incomingBatch = payload.cram_active_batch;
    const batchQuestionIds = incomingBatch.batch_question_ids.filter((id) => validQuestionSet.has(id));
    const masteredInBatchIds = incomingBatch.mastered_in_batch_ids.filter((id) =>
      validQuestionSet.has(id)
    );
    const activeQueueIds = incomingBatch.active_queue_ids.filter((id) => validQuestionSet.has(id));
    const missedIds = (incomingBatch.missed_ids ?? []).filter((id) => validQuestionSet.has(id));
    const scopedQuestionIds = incomingBatch.scoped_question_ids?.filter((id) =>
      validQuestionSet.has(id)
    );

    const existingSession = await db
      .select()
      .from(practice_sessions)
      .where(
        and(
          eq(practice_sessions.user_id, userId),
          eq(practice_sessions.subject_id, subject.id),
          eq(practice_sessions.mode, "cram"),
          eq(practice_sessions.status, "in_progress")
        )
      )
      .get();

    const existingBatch = extractCramActiveBatchFromSession(existingSession);
    const existingMs = existingBatch ? Date.parse(existingBatch.updated_at) || 0 : 0;
    const incomingMs = Date.parse(incomingBatch.updated_at) || 0;

    if (!existingBatch || incomingMs >= existingMs) {
      if (batchQuestionIds.length === 0 || activeQueueIds.length === 0) {
        if (existingSession) {
          await db
            .update(practice_sessions)
            .set({ status: "abandoned" })
            .where(eq(practice_sessions.id, existingSession.id));
        }
      } else {
        const clampedPointer = Math.max(
          0,
          Math.min(incomingBatch.queue_pointer, activeQueueIds.length - 1)
        );
        const sessionPayload = {
          mode: "cram" as const,
          batch_size: Math.max(10, batchQuestionIds.length),
          batch_index: 0,
          total_batches: 1,
          active_queue: activeQueueIds,
          current_pointer: clampedPointer,
          mastered_in_batch: masteredInBatchIds,
          remaining_deck: [],
          completed_batches: 0,
          scope: incomingBatch.scope ?? "deck",
          scoped_question_ids: scopedQuestionIds,
          batch_question_ids: batchQuestionIds,
          missed_ids: missedIds,
          updated_at: incomingBatch.updated_at || nowIso
        };

        if (existingSession) {
          await db
            .update(practice_sessions)
            .set({
              mastered_cards: masteredInBatchIds.length,
              total_cards: batchQuestionIds.length,
              session_data: JSON.stringify(sessionPayload)
            })
            .where(eq(practice_sessions.id, existingSession.id));
        } else {
          await db.insert(practice_sessions).values({
            id: crypto.randomUUID(),
            user_id: userId,
            subject_id: subject.id,
            mode: "cram",
            status: "in_progress",
            is_unlimited: true,
            duration_minutes: null,
            started_at: incomingBatch.updated_at || nowIso,
            completed_at: null,
            total_cards: batchQuestionIds.length,
            mastered_cards: masteredInBatchIds.length,
            session_data: JSON.stringify(sessionPayload)
          });
        }
      }
    }
  }

  return getSubjectPracticeProgress(db, userId, subject.code);
}

// Filter unmastered question IDs for subject
export async function getUnmasteredQuestionsForSubject(
  db: Database,
  userId: string,
  subjectId: string,
  mode: "cram" | "learn"
): Promise<string[]> {
  const allSubjectQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.subject_id, subjectId))
    .all();

  const allQuestionIds = allSubjectQuestions.map((q) => q.id);
  if (allQuestionIds.length === 0) return [];

  const userMasteryList = await db
    .select()
    .from(user_card_mastery)
    .where(
      and(
        eq(user_card_mastery.user_id, userId),
        eq(user_card_mastery.subject_id, subjectId)
      )
    )
    .all();

  const masteredSet = new Set<string>();
  for (const m of userMasteryList) {
    if (mode === "cram" && m.cram_mastered) {
      masteredSet.add(m.question_id);
    } else if (mode === "learn" && m.learn_state === "learned") {
      masteredSet.add(m.question_id);
    }
  }

  return allQuestionIds.filter((id) => !masteredSet.has(id));
}

// Start or resume practice session
export async function startOrResumePracticeSession(
  db: Database,
  userId: string,
  subjectCode: string,
  options: { mode: "cram" | "learn"; is_unlimited?: boolean; duration_minutes?: number | null }
): Promise<PracticeSessionResponse> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  // Look for existing active session with matching mode
  const activeSession = await db
    .select()
    .from(practice_sessions)
    .where(
      and(
        eq(practice_sessions.user_id, userId),
        eq(practice_sessions.subject_id, subject.id),
        eq(practice_sessions.mode, options.mode),
        eq(practice_sessions.status, "in_progress")
      )
    )
    .get();

  if (activeSession) {
    return formatPracticeSessionResponse(db, activeSession);
  }

  // Query unmastered questions
  const unmasteredIds = await getUnmasteredQuestionsForSubject(
    db,
    userId,
    subject.id,
    options.mode
  );

  const totalCards = unmasteredIds.length;
  const nowIso = new Date().toISOString();
  const sessionId = crypto.randomUUID();

  let initialSessionData: PracticeSessionData;

  if (options.mode === "cram") {
    const batchSize = Math.min(10, totalCards);
    const shuffledPool = shuffleArray(unmasteredIds);
    const activeBatch = shuffledPool.slice(0, batchSize);
    const remainingDeck = shuffledPool.slice(batchSize);

    initialSessionData = {
      mode: "cram",
      batch_size: 10,
      batch_index: 0,
      total_batches: Math.ceil(totalCards / 10),
      active_queue: activeBatch,
      current_pointer: 0,
      mastered_in_batch: [],
      remaining_deck: remainingDeck,
      completed_batches: 0
    };
  } else {
    // Learn mode: pool capacity 7
    const poolCapacity = 7;
    const shuffledDeck = shuffleArray(unmasteredIds);
    const initialPool = shuffledDeck.slice(0, Math.min(poolCapacity, totalCards));
    const waitingDeck = shuffledDeck.slice(initialPool.length);
    const roundQueue = shuffleArray(initialPool);

    initialSessionData = {
      mode: "learn",
      pool_capacity: poolCapacity,
      round_number: 1,
      round_queue: roundQueue,
      current_pointer: 0,
      active_pool: initialPool,
      waiting_deck: waitingDeck,
      graduated_deck: [],
      round_audit: [],
      last_round_summary: null
    };

    // Mark initial active pool as 'learning' state in user_card_mastery
    for (const qId of initialPool) {
      await upsertCardMastery(db, userId, subject.id, qId, {
        learn_state: "learning"
      });
    }
  }

  const newSessionRecord = {
    id: sessionId,
    user_id: userId,
    subject_id: subject.id,
    mode: options.mode,
    status: (totalCards === 0 ? "completed" : "in_progress") as "in_progress" | "completed" | "abandoned",
    is_unlimited: options.is_unlimited ?? true,
    duration_minutes: options.duration_minutes ?? null,
    started_at: nowIso,
    completed_at: totalCards === 0 ? nowIso : null,
    total_cards: totalCards,
    mastered_cards: 0,
    session_data: JSON.stringify(initialSessionData)
  };

  await db.insert(practice_sessions).values(newSessionRecord);
  return formatPracticeSessionResponse(db, newSessionRecord);
}

// Format PracticeSessionResponse
export async function formatPracticeSessionResponse(
  db: Database,
  sessionRecord: any
): Promise<PracticeSessionResponse> {
  const sessionData: PracticeSessionData =
    typeof sessionRecord.session_data === "string"
      ? JSON.parse(sessionRecord.session_data)
      : sessionRecord.session_data;

  let currentCard: PracticeCard | null = null;

  if (sessionRecord.status === "in_progress") {
    let currentQId: string | null = null;
    if (sessionData.mode === "cram") {
      if (sessionData.active_queue.length > 0) {
        currentQId = sessionData.active_queue[sessionData.current_pointer] || sessionData.active_queue[0];
      }
    } else {
      if (sessionData.round_queue.length > 0 && sessionData.current_pointer < sessionData.round_queue.length) {
        currentQId = sessionData.round_queue[sessionData.current_pointer];
      }
    }

    if (currentQId) {
      const q = await db
        .select()
        .from(questions)
        .where(eq(questions.id, currentQId))
        .get();
      if (q) {
        currentCard = formatPracticeCard(q);
      }
    }
  }

  const baseResponse: PracticeSessionResponse = {
    id: sessionRecord.id,
    user_id: sessionRecord.user_id,
    subject_id: sessionRecord.subject_id,
    mode: sessionRecord.mode,
    status: sessionRecord.status,
    is_unlimited: Boolean(sessionRecord.is_unlimited),
    duration_minutes: sessionRecord.duration_minutes,
    started_at: sessionRecord.started_at,
    completed_at: sessionRecord.completed_at,
    total_cards: sessionRecord.total_cards,
    mastered_cards: sessionRecord.mastered_cards,
    current_card: currentCard
  };

  if (sessionData.mode === "cram") {
    baseResponse.cram_state = {
      batch_index: sessionData.batch_index,
      total_batches: sessionData.total_batches,
      remaining_in_batch: sessionData.active_queue.length,
      is_batch_complete: sessionData.active_queue.length === 0
    };
  } else {
    baseResponse.learn_state = {
      round_number: sessionData.round_number,
      active_pool_count: sessionData.active_pool.length,
      learned_count: sessionData.graduated_deck.length,
      waiting_deck_count: sessionData.waiting_deck.length,
      is_round_complete:
        sessionData.round_queue.length === 0 ||
        sessionData.current_pointer >= sessionData.round_queue.length,
      round_summary: sessionData.last_round_summary || null
    };
  }

  return baseResponse;
}

// Get session state
export async function getPracticeSessionState(
  db: Database,
  userId: string,
  sessionId: string
): Promise<PracticeSessionResponse> {
  const session = await db
    .select()
    .from(practice_sessions)
    .where(eq(practice_sessions.id, sessionId))
    .get();

  if (!session) {
    throw new HTTPException(404, { message: "Practice session not found" });
  }

  if (session.user_id !== userId) {
    throw new HTTPException(403, { message: "Access forbidden" });
  }

  return formatPracticeSessionResponse(db, session);
}

// Process Cram Mode answer
export async function processCramAnswer(
  db: Database,
  session: any,
  sessionData: CramSessionData,
  question: any,
  selectedOptions: string
): Promise<SubmitPracticeAnswerResponse> {
  const isCorrect = gradeQuestion(
    question.question_type,
    selectedOptions,
    question.correct_answer
  ).isCorrect;

  let cramAction: "mastered" | "jittered" | "retried" = "jittered";
  let jitterOffset: number | null = null;

  if (isCorrect) {
    cramAction = "mastered";
    // 1. Remove from active queue
    sessionData.active_queue = sessionData.active_queue.filter((id) => id !== question.id);
    // 2. Add to mastered in batch
    if (!sessionData.mastered_in_batch.includes(question.id)) {
      sessionData.mastered_in_batch.push(question.id);
    }
    // 3. Increment session mastered_cards
    session.mastered_cards += 1;
    // 4. Persist in user_card_mastery
    await upsertCardMastery(db, session.user_id, session.subject_id, question.id, {
      cram_mastered: true
    });
    // Adjust pointer
    if (sessionData.current_pointer >= sessionData.active_queue.length) {
      sessionData.current_pointer = 0;
    }
  } else {
    // Incorrect answer
    const currentQueue = sessionData.active_queue;
    if (currentQueue.length <= 1) {
      // Only 1 card in batch
      cramAction = "retried";
      sessionData.current_pointer = 0;
    } else {
      cramAction = "jittered";
      // Remove from current position
      sessionData.active_queue = currentQueue.filter((id) => id !== question.id);
      // Calculate jitter offset (2..4)
      const jitterCalc = calculateCramJitter(
        sessionData.current_pointer,
        sessionData.active_queue.length
      );
      jitterOffset = jitterCalc.jitterOffset;
      // Re-insert at target index
      sessionData.active_queue.splice(jitterCalc.targetIndex, 0, question.id);
      // Advance pointer
      sessionData.current_pointer = (sessionData.current_pointer + 1) % sessionData.active_queue.length;
    }
  }

  const isBatchComplete = sessionData.active_queue.length === 0;
  if (isBatchComplete && sessionData.remaining_deck.length === 0) {
    session.status = "completed";
    session.completed_at = new Date().toISOString();
  }

  // Update session record
  await db
    .update(practice_sessions)
    .set({
      mastered_cards: session.mastered_cards,
      status: session.status,
      completed_at: session.completed_at,
      session_data: JSON.stringify(sessionData)
    })
    .where(eq(practice_sessions.id, session.id));

  const updatedSessionResponse = await formatPracticeSessionResponse(db, session);

  let parsedAnalysis: any = null;
  try {
    parsedAnalysis =
      typeof question.option_by_option_analysis === "string"
        ? JSON.parse(question.option_by_option_analysis)
        : question.option_by_option_analysis;
  } catch {
    parsedAnalysis = null;
  }

  return {
    is_correct: isCorrect,
    selected_options: selectedOptions,
    correct_answer: question.correct_answer,
    explanation: question.ai_explanation || "No explanation provided.",
    option_by_option_analysis: parsedAnalysis,
    cram_action: {
      action: cramAction,
      jitter_offset: jitterOffset,
      batch_complete: isBatchComplete
    },
    session_update: updatedSessionResponse
  };
}

// Process Learn Mode answer
export async function processLearnAnswer(
  db: Database,
  session: any,
  sessionData: LearnSessionData,
  question: any,
  selectedOptions: string
): Promise<SubmitPracticeAnswerResponse> {
  const isCorrect = gradeQuestion(
    question.question_type,
    selectedOptions,
    question.correct_answer
  ).isCorrect;

  const currentMastery = await getUserCardMastery(db, session.user_id, question.id);
  const prevWrongAttempts = currentMastery?.wrong_attempts ?? 0;
  const prevConsecutive = currentMastery?.consecutive_correct ?? 0;

  let graduated = false;
  let newConsecutive = prevConsecutive;
  let newWrongAttempts = prevWrongAttempts;
  let retentionStatus: "learned" | "progressing" | "repeating" = "repeating";

  if (isCorrect) {
    newConsecutive = prevConsecutive + 1;
    // Asymmetric graduation rule
    if (prevWrongAttempts === 0) {
      // Pristine card graduates on 1st correct answer
      graduated = true;
    } else if (newConsecutive >= 2) {
      // Previously missed card graduates on 2nd consecutive correct
      graduated = true;
    }

    retentionStatus = graduated ? "learned" : "progressing";
  } else {
    // Streak wipeout rule
    newConsecutive = 0;
    newWrongAttempts = prevWrongAttempts + 1;
    retentionStatus = "repeating";
  }

  // Update card mastery in database
  await upsertCardMastery(db, session.user_id, session.subject_id, question.id, {
    learn_state: graduated ? "learned" : "learning",
    consecutive_correct: newConsecutive,
    wrong_attempts: newWrongAttempts,
    total_attempts: (currentMastery?.total_attempts ?? 0) + 1
  });

  if (graduated) {
    session.mastered_cards += 1;
    // Remove from active pool, add to graduated deck
    sessionData.active_pool = sessionData.active_pool.filter((id) => id !== question.id);
    if (!sessionData.graduated_deck.includes(question.id)) {
      sessionData.graduated_deck.push(question.id);
    }
  }

  // Record into round audit log
  sessionData.round_audit.push({
    question_id: question.id,
    question_text: question.question_text,
    image_file: question.image_file,
    selected_options: selectedOptions,
    correct_answer: question.correct_answer,
    is_correct: isCorrect,
    retention_status: retentionStatus
  });

  // Advance pointer in round queue
  sessionData.current_pointer += 1;

  // Check if round is complete
  const isRoundComplete = sessionData.current_pointer >= sessionData.round_queue.length;
  if (isRoundComplete) {
    // Generate Round Summary Dashboard
    const totalReviewed = sessionData.round_audit.length;
    const incorrectCount = sessionData.round_audit.filter((a) => !a.is_correct).length;
    const errorRate = totalReviewed > 0 ? incorrectCount / totalReviewed : 0;
    const feedback = calculateLearnFeedback(errorRate);

    sessionData.last_round_summary = {
      round_number: sessionData.round_number,
      total_reviewed: totalReviewed,
      incorrect_count: incorrectCount,
      error_rate: Math.round(errorRate * 100) / 100,
      headline: feedback.headline,
      visual_tone: feedback.visualTone,
      audit_gallery: [...sessionData.round_audit]
    };

    // If both active pool and waiting deck are empty, entire deck is mastered!
    if (sessionData.active_pool.length === 0 && sessionData.waiting_deck.length === 0) {
      session.status = "completed";
      session.completed_at = new Date().toISOString();
    }
  }

  // Update session record
  await db
    .update(practice_sessions)
    .set({
      mastered_cards: session.mastered_cards,
      status: session.status,
      completed_at: session.completed_at,
      session_data: JSON.stringify(sessionData)
    })
    .where(eq(practice_sessions.id, session.id));

  const updatedSessionResponse = await formatPracticeSessionResponse(db, session);

  let parsedAnalysis: any = null;
  try {
    parsedAnalysis =
      typeof question.option_by_option_analysis === "string"
        ? JSON.parse(question.option_by_option_analysis)
        : question.option_by_option_analysis;
  } catch {
    parsedAnalysis = null;
  }

  return {
    is_correct: isCorrect,
    selected_options: selectedOptions,
    correct_answer: question.correct_answer,
    explanation: question.ai_explanation || "No explanation provided.",
    option_by_option_analysis: parsedAnalysis,
    learn_action: {
      card_status: graduated ? "learned" : "learning",
      consecutive_correct: newConsecutive,
      wrong_attempts: newWrongAttempts,
      graduated,
      round_complete: isRoundComplete
    },
    session_update: updatedSessionResponse
  };
}

// Advance Cram Batch
export async function advanceCramBatch(
  db: Database,
  userId: string,
  sessionId: string
): Promise<PracticeSessionResponse> {
  const session = await db
    .select()
    .from(practice_sessions)
    .where(eq(practice_sessions.id, sessionId))
    .get();

  if (!session) {
    throw new HTTPException(404, { message: "Practice session not found" });
  }
  if (session.user_id !== userId) {
    throw new HTTPException(403, { message: "Access forbidden" });
  }

  const sessionData: CramSessionData =
    typeof session.session_data === "string"
      ? JSON.parse(session.session_data)
      : session.session_data;

  if (sessionData.active_queue.length > 0) {
    throw new HTTPException(400, {
      message: "Current batch is not completed yet"
    });
  }

  if (sessionData.remaining_deck.length === 0) {
    session.status = "completed";
    session.completed_at = new Date().toISOString();
    await db
      .update(practice_sessions)
      .set({
        status: "completed",
        completed_at: session.completed_at
      })
      .where(eq(practice_sessions.id, sessionId));
    return formatPracticeSessionResponse(db, session);
  }

  // Slice next 10 cards
  const nextSlice = sessionData.remaining_deck.slice(0, 10);
  const remaining = sessionData.remaining_deck.slice(10);
  const shuffledSlice = shuffleArray(nextSlice);

  sessionData.batch_index += 1;
  sessionData.completed_batches += 1;
  sessionData.active_queue = shuffledSlice;
  sessionData.current_pointer = 0;
  sessionData.mastered_in_batch = [];
  sessionData.remaining_deck = remaining;

  await db
    .update(practice_sessions)
    .set({
      session_data: JSON.stringify(sessionData)
    })
    .where(eq(practice_sessions.id, sessionId));

  return formatPracticeSessionResponse(db, session);
}

// Advance Learn Round
export async function advanceLearnRound(
  db: Database,
  userId: string,
  sessionId: string
): Promise<PracticeSessionResponse> {
  const session = await db
    .select()
    .from(practice_sessions)
    .where(eq(practice_sessions.id, sessionId))
    .get();

  if (!session) {
    throw new HTTPException(404, { message: "Practice session not found" });
  }
  if (session.user_id !== userId) {
    throw new HTTPException(403, { message: "Access forbidden" });
  }

  const sessionData: LearnSessionData =
    typeof session.session_data === "string"
      ? JSON.parse(session.session_data)
      : session.session_data;

  if (sessionData.current_pointer < sessionData.round_queue.length && sessionData.round_queue.length > 0) {
    throw new HTTPException(400, {
      message: "Current round is not completed yet"
    });
  }

  // Refill pool up to 7 cards from waiting_deck
  const openSlots = sessionData.pool_capacity - sessionData.active_pool.length;
  if (openSlots > 0 && sessionData.waiting_deck.length > 0) {
    const refillCards = sessionData.waiting_deck.slice(0, openSlots);
    sessionData.waiting_deck = sessionData.waiting_deck.slice(openSlots);
    sessionData.active_pool.push(...refillCards);

    for (const qId of refillCards) {
      await upsertCardMastery(db, userId, session.subject_id, qId, {
        learn_state: "learning"
      });
    }
  }

  if (sessionData.active_pool.length === 0) {
    // Session is complete!
    session.status = "completed";
    session.completed_at = new Date().toISOString();
    await db
      .update(practice_sessions)
      .set({
        status: "completed",
        completed_at: session.completed_at,
        session_data: JSON.stringify(sessionData)
      })
      .where(eq(practice_sessions.id, sessionId));
    return formatPracticeSessionResponse(db, session);
  }

  // Assemble next round queue
  sessionData.round_number += 1;
  sessionData.round_queue = shuffleArray(sessionData.active_pool);
  sessionData.current_pointer = 0;
  sessionData.round_audit = [];

  await db
    .update(practice_sessions)
    .set({
      session_data: JSON.stringify(sessionData)
    })
    .where(eq(practice_sessions.id, sessionId));

  return formatPracticeSessionResponse(db, session);
}

// Submit answer for active question in session
export async function submitPracticeSessionAnswer(
  db: Database,
  userId: string,
  sessionId: string,
  questionId: string,
  selectedOptions: string
): Promise<SubmitPracticeAnswerResponse> {
  const session = await db
    .select()
    .from(practice_sessions)
    .where(eq(practice_sessions.id, sessionId))
    .get();

  if (!session) {
    throw new HTTPException(404, { message: "Practice session not found" });
  }
  if (session.user_id !== userId) {
    throw new HTTPException(403, { message: "Access forbidden" });
  }
  if (session.status !== "in_progress") {
    throw new HTTPException(400, { message: "Practice session is no longer active" });
  }

  const question = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .get();

  if (!question) {
    throw new HTTPException(404, { message: "Question not found" });
  }

  const sessionData: PracticeSessionData =
    typeof session.session_data === "string"
      ? JSON.parse(session.session_data)
      : session.session_data;

  if (sessionData.mode === "cram") {
    return processCramAnswer(db, session, sessionData, question, selectedOptions);
  } else {
    return processLearnAnswer(db, session, sessionData, question, selectedOptions);
  }
}
