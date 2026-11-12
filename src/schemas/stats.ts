import { z } from "zod";

export const SubjectStatsItemSchema = z.object({
  subject_code: z.string(),
  subject_title: z.string(),
  attempts_count: z.number().int(),
  average_score: z.number(),
  highest_score: z.number(),
  passed_exams_count: z.number().int(),
  total_exams_in_subject: z.number().int()
});

export const UserStatisticsResponseSchema = z.object({
  total_attempts_count: z.number().int(),
  total_exams_passed: z.number().int(),
  overall_pass_rate: z.number(),
  overall_average_score: z.number(),
  total_practice_duration_minutes: z.number().int(),
  subject_breakdowns: z.array(SubjectStatsItemSchema)
});

export const AttemptHistoryItemSchema = z.object({
  attempt_id: z.string(),
  exam_id: z.string(),
  exam_code: z.string(),
  exam_title: z.string(),
  subject_code: z.string(),
  started_at: z.string(),
  submitted_at: z.string().nullable(),
  status: z.string(),
  percentage_score: z.number(),
  is_passed: z.boolean(),
  duration_seconds: z.number().int()
});

export type SubjectStatsItem = z.infer<typeof SubjectStatsItemSchema>;
export type UserStatisticsResponse = z.infer<typeof UserStatisticsResponseSchema>;
export type AttemptHistoryItem = z.infer<typeof AttemptHistoryItemSchema>;
