import { z } from "zod";

export const PracticeQuestionSchema = z.object({
  question_id: z.string(),
  subject_code: z.string(),
  question_type: z.enum(["single_choice", "multiple_choice"]),
  question_text: z.string(),
  image_url: z.string().nullable(),
  options: z.record(z.string())
});

export const CommunityStatsSchema = z.object({
  total_comments: z.number(),
  valid_vote_count: z.number(),
  top_answer_votes: z.number(),
  agreement_ratio: z.number(),
  community_answer: z.string().nullable()
});

export const DrillCheckRequestSchema = z.object({
  selected_options: z.string().min(1, "At least one option must be selected"),
  benchmark_mode: z.enum(["ai", "community"]).optional().default("ai")
});

export const DrillCheckResponseSchema = z.object({
  question_id: z.string(),
  selected_options: z.string(),
  correct_answer: z.string(),
  is_correct: z.boolean(),
  ai_explanation: z.string().nullable(),
  option_by_option_analysis: z.record(z.string()).nullable(),
  benchmark_source: z.enum(["ai", "community"]).optional(),
  community_stats: CommunityStatsSchema.nullable().optional()
});

export type PracticeQuestion = z.infer<typeof PracticeQuestionSchema>;
export type DrillCheckRequest = z.infer<typeof DrillCheckRequestSchema>;
export type DrillCheckResponse = z.infer<typeof DrillCheckResponseSchema>;
