import { z } from "zod";

export const AttemptQuestionSchema = z.object({
  question_id: z.string(),
  question_number: z.number(),
  question_id_code: z.string(),
  question_type: z.enum(["single_choice", "multiple_choice"]),
  question_text: z.string(),
  image_url: z.string().nullable(),
  options: z.record(z.string()),
  selected_options: z.string().nullable()
});

export const AttemptSessionResponseSchema = z.object({
  attempt_id: z.string(),
  exam_id: z.string(),
  exam_title: z.string(),
  status: z.enum(["in_progress", "completed", "timed_out", "abandoned"]),
  started_at: z.string(),
  expires_at: z.string(),
  time_remaining_seconds: z.number(),
  questions: z.array(AttemptQuestionSchema)
});

export const SubmitAnswerRequestSchema = z.object({
  question_id: z.string(),
  selected_options: z.string().min(1, "At least one option must be selected")
});

export const AnswerSavedResponseSchema = z.object({
  question_id: z.string(),
  selected_options: z.string(),
  saved_at: z.string()
});

export const AttemptResultResponseSchema = z.object({
  attempt_id: z.string(),
  status: z.enum(["completed", "timed_out"]),
  total_questions: z.number(),
  correct_answers_count: z.number(),
  total_score: z.number(),
  percentage_score: z.number(),
  is_passed: z.boolean(),
  submitted_at: z.string(),
  duration_seconds: z.number()
});

export type AttemptQuestion = z.infer<typeof AttemptQuestionSchema>;
export type AttemptSessionResponse = z.infer<typeof AttemptSessionResponseSchema>;
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequestSchema>;
export type AnswerSavedResponse = z.infer<typeof AnswerSavedResponseSchema>;
export type AttemptResultResponse = z.infer<typeof AttemptResultResponseSchema>;
