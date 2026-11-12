import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import { subjects, exams } from "../db/schema";
import type { SubjectSummary, SubjectDetail, ExamSummary, ExamDetail } from "../schemas/catalog";

export async function listSubjects(db: Database): Promise<SubjectSummary[]> {
  const allSubjects = await db.select().from(subjects).all();

  const results: SubjectSummary[] = [];
  for (const s of allSubjects) {
    const examCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(exams)
      .where(eq(exams.subject_id, s.id))
      .get();

    results.push({
      id: s.id,
      code: s.code,
      title: s.title,
      description: s.description,
      icon_url: s.icon_url,
      total_exams: Number(examCountResult?.count || 0)
    });
  }

  return results;
}

export async function getSubjectByCode(db: Database, code: string): Promise<SubjectDetail> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, code.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${code}' not found` });
  }

  const examCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(exams)
    .where(eq(exams.subject_id, subject.id))
    .get();

  return {
    id: subject.id,
    code: subject.code,
    title: subject.title,
    description: subject.description,
    icon_url: subject.icon_url,
    total_exams: Number(examCountResult?.count || 0),
    created_at: subject.created_at
  };
}

export async function listExamsBySubject(db: Database, subjectCode: string): Promise<ExamSummary[]> {
  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.code, subjectCode.toUpperCase()))
    .get();

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const examList = await db
    .select()
    .from(exams)
    .where(eq(exams.subject_id, subject.id))
    .all();

  return examList.map((e) => ({
    id: e.id,
    subject_code: subject.code,
    code: e.code,
    title: e.title,
    duration_minutes: e.duration_minutes,
    total_questions: e.total_questions,
    passing_score_percentage: e.passing_score_percentage
  }));
}

export async function getExamById(db: Database, examId: string): Promise<ExamDetail> {
  const exam = await db
    .select()
    .from(exams)
    .where(eq(exams.id, examId))
    .get();

  if (!exam) {
    throw new HTTPException(404, { message: `Exam '${examId}' not found` });
  }

  const subject = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, exam.subject_id))
    .get();

  return {
    id: exam.id,
    subject_code: subject?.code || "",
    code: exam.code,
    title: exam.title,
    description: exam.description,
    duration_minutes: exam.duration_minutes,
    total_questions: exam.total_questions,
    passing_score_percentage: exam.passing_score_percentage,
    is_published: exam.is_published,
    created_at: exam.created_at
  };
}
