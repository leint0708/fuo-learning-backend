export interface RoundAuditItem {
  question_id: string;
  question_text: string;
  image_file?: string | null;
  selected_options: string;
  correct_answer: string;
  is_correct: boolean;
  retention_status: "learned" | "progressing" | "repeating";
}

export interface CramSessionData {
  mode: "cram";
  batch_size: number;
  batch_index: number;
  total_batches: number;
  active_queue: string[];
  current_pointer: number;
  mastered_in_batch: string[];
  remaining_deck: string[];
  completed_batches: number;
}

export interface LearnRoundSummary {
  round_number: number;
  total_reviewed: number;
  incorrect_count: number;
  error_rate: number;
  headline: string;
  visual_tone: "emerald" | "amber" | "blue" | "indigo";
  audit_gallery: RoundAuditItem[];
}

export interface LearnSessionData {
  mode: "learn";
  pool_capacity: number;
  round_number: number;
  round_queue: string[];
  current_pointer: number;
  active_pool: string[];
  waiting_deck: string[];
  graduated_deck: string[];
  round_audit: RoundAuditItem[];
  last_round_summary?: LearnRoundSummary | null;
}

export type PracticeSessionData = CramSessionData | LearnSessionData;
