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

export const CardMasteryStatSchema = z.object({
  question_id: z.string(),
  consecutive_correct: z.number().int().min(0),
  wrong_attempts: z.number().int().min(0),
  total_attempts: z.number().int().min(0),
  status: z.enum(["learning", "learned"]),
  last_answered_at: z.string().optional()
});

export const CramActiveBatchSchema = z.object({
  scope: z.enum(["deck", "mistakes"]).default("deck"),
  scoped_question_ids: z.array(z.string()).optional(),
  batch_question_ids: z.array(z.string()),
  active_queue_ids: z.array(z.string()),
  queue_pointer: z.number().int().min(0),
  mastered_in_batch_ids: z.array(z.string()),
  missed_ids: z.array(z.string()).default([]),
  updated_at: z.string()
});

export const SubjectPracticeProgressResponseSchema = z.object({
  subject_code: z.string(),
  cram_mastered_ids: z.array(z.string()),
  learn_mastered_ids: z.array(z.string()),
  card_stats: z.record(CardMasteryStatSchema),
  cram_active_batch: CramActiveBatchSchema.nullable().optional()
});

export const SyncPracticeProgressRequestSchema = z.object({
  cram_mastered_ids: z.array(z.string()).optional(),
  learn_mastered_ids: z.array(z.string()).optional(),
  card_stats: z
    .record(
      z.object({
        question_id: z.string().optional(),
        consecutive_correct: z.number().int().min(0).optional(),
        wrong_attempts: z.number().int().min(0).optional(),
        total_attempts: z.number().int().min(0).optional(),
        status: z.enum(["learning", "learned"]).optional(),
        last_answered_at: z.string().optional()
      })
    )
    .optional(),
  cram_active_batch: CramActiveBatchSchema.nullable().optional()
});

export const PracticeProgressSummaryItemSchema = z.object({
  subject_code: z.string(),
  cram_count: z.number().int().min(0),
  learn_count: z.number().int().min(0)
});

export const ResetPracticeRequestSchema = z.object({
  mode: z.enum(["cram", "learn"]).optional()
});

export type CardMasteryStat = z.infer<typeof CardMasteryStatSchema>;
export type CramActiveBatch = z.infer<typeof CramActiveBatchSchema>;
export type SubjectPracticeProgressResponse = z.infer<typeof SubjectPracticeProgressResponseSchema>;
export type SyncPracticeProgressRequest = z.infer<typeof SyncPracticeProgressRequestSchema>;
export type PracticeProgressSummaryItem = z.infer<typeof PracticeProgressSummaryItemSchema>;
