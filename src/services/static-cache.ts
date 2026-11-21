import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { subjects, exams, questions } from "../db/schema";

type SubjectRow = typeof subjects.$inferSelect;
type ExamRow = typeof exams.$inferSelect;
type QuestionRow = typeof questions.$inferSelect;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes per Worker isolate

let allSubjectsCache: CacheEntry<SubjectRow[]> | null = null;
const subjectByCodeCache = new Map<string, CacheEntry<SubjectRow>>();
const subjectByIdCache = new Map<string, CacheEntry<SubjectRow>>();
const examsBySubjectCache = new Map<string, CacheEntry<ExamRow[]>>();
const examByIdCache = new Map<string, CacheEntry<ExamRow>>();
const questionsBySubjectCache = new Map<string, CacheEntry<QuestionRow[]>>();
const questionIdsBySubjectCache = new Map<string, CacheEntry<Set<string>>>();
const questionByIdCache = new Map<string, CacheEntry<QuestionRow>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
  return Boolean(entry && Date.now() < entry.expiresAt);
}

function makeEntry<T>(value: T): CacheEntry<T> {
  return { value, expiresAt: Date.now() + DEFAULT_TTL_MS };
}

export function clearStaticCache(): void {
  allSubjectsCache = null;
  subjectByCodeCache.clear();
  subjectByIdCache.clear();
  examsBySubjectCache.clear();
  examByIdCache.clear();
  questionsBySubjectCache.clear();
  questionIdsBySubjectCache.clear();
  questionByIdCache.clear();
}

export async function getCachedAllSubjects(db: Database): Promise<SubjectRow[]> {
  if (isFresh(allSubjectsCache)) {
    return allSubjectsCache.value;
  }
  const rows = await db.select().from(subjects).all();
  if (rows.length > 0) {
    allSubjectsCache = makeEntry(rows);
    for (const s of rows) {
      subjectByCodeCache.set(s.code.toUpperCase(), makeEntry(s));
      subjectByIdCache.set(s.id, makeEntry(s));
    }
  }
  return rows;
}

export async function getCachedSubjectByCode(
  db: Database,
  code: string
): Promise<SubjectRow | undefined> {
  const key = code.toUpperCase();
  const cached = subjectByCodeCache.get(key);
  if (isFresh(cached)) {
    return cached.value;
  }
  const row = await db.select().from(subjects).where(eq(subjects.code, key)).get();
  if (row) {
    subjectByCodeCache.set(key, makeEntry(row));
    subjectByIdCache.set(row.id, makeEntry(row));
  }
  return row;
}

export async function getCachedSubjectById(
  db: Database,
  subjectId: string
): Promise<SubjectRow | undefined> {
  const cached = subjectByIdCache.get(subjectId);
  if (isFresh(cached)) {
    return cached.value;
  }
  const row = await db.select().from(subjects).where(eq(subjects.id, subjectId)).get();
  if (row) {
    subjectByIdCache.set(row.id, makeEntry(row));
    subjectByCodeCache.set(row.code.toUpperCase(), makeEntry(row));
  }
  return row;
}

export async function getCachedExamsBySubjectId(
  db: Database,
  subjectId: string
): Promise<ExamRow[]> {
  const cached = examsBySubjectCache.get(subjectId);
  if (isFresh(cached)) {
    return cached.value;
  }
  const rows = await db.select().from(exams).where(eq(exams.subject_id, subjectId)).all();
  if (rows.length > 0) {
    examsBySubjectCache.set(subjectId, makeEntry(rows));
    for (const e of rows) {
      examByIdCache.set(e.id, makeEntry(e));
    }
  }
  return rows;
}

export async function getCachedExamById(
  db: Database,
  examId: string
): Promise<ExamRow | undefined> {
  const cached = examByIdCache.get(examId);
  if (isFresh(cached)) {
    return cached.value;
  }
  const row = await db.select().from(exams).where(eq(exams.id, examId)).get();
  if (row) {
    examByIdCache.set(row.id, makeEntry(row));
  }
  return row;
}

export async function getCachedQuestionsBySubjectId(
  db: Database,
  subjectId: string
): Promise<QuestionRow[]> {
  const cached = questionsBySubjectCache.get(subjectId);
  if (isFresh(cached)) {
    return cached.value;
  }
  const rows = await db.select().from(questions).where(eq(questions.subject_id, subjectId)).all();
  if (rows.length > 0) {
    questionsBySubjectCache.set(subjectId, makeEntry(rows));
    questionIdsBySubjectCache.set(subjectId, makeEntry(new Set(rows.map((q) => q.id))));
    for (const q of rows) {
      questionByIdCache.set(q.id, makeEntry(q));
    }
  }
  return rows;
}

export async function getCachedQuestionIdsBySubjectId(
  db: Database,
  subjectId: string
): Promise<Set<string>> {
  const cached = questionIdsBySubjectCache.get(subjectId);
  if (isFresh(cached)) {
    return cached.value;
  }
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.subject_id, subjectId))
    .all();
  const idSet = new Set(rows.map((r) => r.id));
  if (idSet.size > 0) {
    questionIdsBySubjectCache.set(subjectId, makeEntry(idSet));
  }
  return idSet;
}

export async function getCachedQuestionById(
  db: Database,
  questionId: string
): Promise<QuestionRow | undefined> {
  const cached = questionByIdCache.get(questionId);
  if (isFresh(cached)) {
    return cached.value;
  }
  const row = await db.select().from(questions).where(eq(questions.id, questionId)).get();
  if (row) {
    questionByIdCache.set(row.id, makeEntry(row));
  }
  return row;
}
