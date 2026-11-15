import { z } from "zod";

export const StartPracticeRequestSchema = z.object({
  mode: z.enum(["cram", "learn"]),
  is_unlimited: z.boolean().default(true),
  duration_minutes: z.number().int().positive().nullable().optional()
});

export const PracticeCardOptionSchema = z.object({
  key: z.string(),
  text: z.string()
});

export const PracticeCardSchema = z.object({
  id: z.string(),
  question_number: z.number().int(),
  question_id_code: z.string(),
  question_text: z.string(),
  image_file: z.string().nullable().optional(),
  question_type: z.string(),
  is_multi_select: z.boolean(),
  options: z.array(PracticeCardOptionSchema)
});

export const RoundAuditItemSchema = z.object({
  question_id: z.string(),
  question_text: z.string(),
  image_file: z.string().nullable().optional(),
  selected_options: z.string(),
  correct_answer: z.string(),
  is_correct: z.boolean(),
  retention_status: z.enum(["learned", "progressing", "repeating"])
});

export const RoundSummarySchema = z.object({
  round_number: z.number().int(),
  total_reviewed: z.number().int(),
  incorrect_count: z.number().int(),
  error_rate: z.number(),
  headline: z.string(),
  visual_tone: z.enum(["emerald", "amber", "blue", "indigo"]),
  audit_gallery: z.array(RoundAuditItemSchema)
});

export const CramStateSchema = z.object({
  batch_index: z.number().int(),
  total_batches: z.number().int(),
  remaining_in_batch: z.number().int(),
  is_batch_complete: z.boolean()
});

export const LearnStateSchema = z.object({
  round_number: z.number().int(),
  active_pool_count: z.number().int(),
  learned_count: z.number().int(),
  waiting_deck_count: z.number().int(),
  is_round_complete: z.boolean(),
  round_summary: RoundSummarySchema.nullable().optional()
});

export const PracticeSessionResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  subject_id: z.string(),
  mode: z.enum(["cram", "learn"]),
  status: z.enum(["in_progress", "completed", "abandoned"]),
  is_unlimited: z.boolean(),
  duration_minutes: z.number().nullable().optional(),
  started_at: z.string(),
  completed_at: z.string().nullable().optional(),
  total_cards: z.number().int(),
  mastered_cards: z.number().int(),
  current_card: PracticeCardSchema.nullable().optional(),
  cram_state: CramStateSchema.optional(),
  learn_state: LearnStateSchema.optional()
});

export const SubmitPracticeAnswerRequestSchema = z.object({
  question_id: z.string(),
  selected_options: z.string()
});

export const SubmitPracticeAnswerResponseSchema = z.object({
  is_correct: z.boolean(),
  selected_options: z.string(),
  correct_answer: z.string(),
  explanation: z.string(),
  option_by_option_analysis: z.record(z.any()).nullable().optional(),
  cram_action: z
    .object({
      action: z.enum(["mastered", "jittered", "retried"]),
      jitter_offset: z.number().nullable().optional(),
      batch_complete: z.boolean()
    })
    .optional(),
  learn_action: z
    .object({
      card_status: z.enum(["learned", "learning"]),
      consecutive_correct: z.number(),
      wrong_attempts: z.number(),
      graduated: z.boolean(),
      round_complete: z.boolean()
    })
    .optional(),
  session_update: PracticeSessionResponseSchema
});

export type StartPracticeRequest = z.infer<typeof StartPracticeRequestSchema>;
export type PracticeCard = z.infer<typeof PracticeCardSchema>;
export type PracticeSessionResponse = z.infer<typeof PracticeSessionResponseSchema>;
export type SubmitPracticeAnswerRequest = z.infer<typeof SubmitPracticeAnswerRequestSchema>;
export type SubmitPracticeAnswerResponse = z.infer<typeof SubmitPracticeAnswerResponseSchema>;
