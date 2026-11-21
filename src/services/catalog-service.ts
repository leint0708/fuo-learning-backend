import { HTTPException } from "hono/http-exception";
import type { Database } from "../db";
import type { SubjectSummary, SubjectDetail, ExamSummary, ExamDetail } from "../schemas/catalog";
import {
  getCachedAllSubjects,
  getCachedSubjectByCode,
  getCachedSubjectById,
  getCachedExamsBySubjectId,
  getCachedExamById
} from "./static-cache";

export async function listSubjects(db: Database): Promise<SubjectSummary[]> {
  const allSubjects = await getCachedAllSubjects(db);

  const results: SubjectSummary[] = [];
  for (const s of allSubjects) {
    const subjectExams = await getCachedExamsBySubjectId(db, s.id);
    results.push({
      id: s.id,
      code: s.code,
      title: s.title,
      description: s.description,
      icon_url: s.icon_url,
      total_exams: subjectExams.length
    });
  }

  return results;
}

export async function getSubjectByCode(db: Database, code: string): Promise<SubjectDetail> {
  const subject = await getCachedSubjectByCode(db, code);

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${code}' not found` });
  }

  const subjectExams = await getCachedExamsBySubjectId(db, subject.id);

  return {
    id: subject.id,
    code: subject.code,
    title: subject.title,
    description: subject.description,
    icon_url: subject.icon_url,
    total_exams: subjectExams.length,
    created_at: subject.created_at
  };
}

export async function listExamsBySubject(db: Database, subjectCode: string): Promise<ExamSummary[]> {
  const subject = await getCachedSubjectByCode(db, subjectCode);

  if (!subject) {
    throw new HTTPException(404, { message: `Subject '${subjectCode}' not found` });
  }

  const examList = await getCachedExamsBySubjectId(db, subject.id);

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
  const exam = await getCachedExamById(db, examId);

  if (!exam) {
    throw new HTTPException(404, { message: `Exam '${examId}' not found` });
  }

  const subject = await getCachedSubjectById(db, exam.subject_id);

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
