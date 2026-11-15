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
  SubmitPracticeAnswerResponse
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

// Database helper: Reset mastery records for a subject
export async function resetSubjectMastery(
  db: Database,
  userId: string,
  subjectCode: string
): Promise<{ message: string }> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

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

  return { message: `Practice progress for subject ${subjectCode} has been reset.` };
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
