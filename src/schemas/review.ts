import { z } from "zod";

export const ReviewQuestionItemSchema = z.object({
  question_id: z.string(),
  question_number: z.number(),
  question_id_code: z.string(),
  question_type: z.enum(["single_choice", "multiple_choice"]),
  question_text: z.string(),
  image_url: z.string().nullable(),
  options: z.record(z.string()),
  selected_options: z.string().nullable(),
  correct_answer: z.string(),
  is_correct: z.boolean(),
  ai_explanation: z.string().nullable(),
  option_by_option_analysis: z.record(z.string()).nullable()
});

export const AttemptReviewResponseSchema = z.object({
  attempt_id: z.string(),
  exam_title: z.string(),
  status: z.enum(["completed", "timed_out"]),
  percentage_score: z.number(),
  is_passed: z.boolean(),
  submitted_at: z.string().nullable(),
  duration_seconds: z.number(),
  questions: z.array(ReviewQuestionItemSchema)
});

export type ReviewQuestionItem = z.infer<typeof ReviewQuestionItemSchema>;
export type AttemptReviewResponse = z.infer<typeof AttemptReviewResponseSchema>;
