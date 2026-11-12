import { z } from "zod";

export const SubjectSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon_url: z.string().nullable(),
  total_exams: z.number()
});

export const SubjectDetailSchema = SubjectSummarySchema.extend({
  created_at: z.string()
});

export const ExamSummarySchema = z.object({
  id: z.string(),
  subject_code: z.string(),
  code: z.string(),
  title: z.string(),
  duration_minutes: z.number(),
  total_questions: z.number(),
  passing_score_percentage: z.number()
});

export const ExamDetailSchema = ExamSummarySchema.extend({
  description: z.string().nullable(),
  is_published: z.boolean(),
  created_at: z.string()
});

export type SubjectSummary = z.infer<typeof SubjectSummarySchema>;
export type SubjectDetail = z.infer<typeof SubjectDetailSchema>;
export type ExamSummary = z.infer<typeof ExamSummarySchema>;
export type ExamDetail = z.infer<typeof ExamDetailSchema>;
