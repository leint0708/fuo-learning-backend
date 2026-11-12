export function normalizeAnswer(raw: string): string {
  if (!raw) return "";
  // Strip spaces, punctuation, commas, split into characters, sort and join
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const chars = Array.from(new Set(cleaned.split(""))).sort();
  return chars.join("");
}

export interface QuestionGradingResult {
  isCorrect: boolean;
  pointsAwarded: number;
}

export function gradeQuestion(
  questionType: string,
  submittedAnswer: string,
  correctAnswer: string
): QuestionGradingResult {
  const normSubmitted = normalizeAnswer(submittedAnswer);
  const normCorrect = normalizeAnswer(correctAnswer);

  if (!normSubmitted) {
    return { isCorrect: false, pointsAwarded: 0.0 };
  }

  // All-or-Nothing Scoring for both single_choice and multiple_choice
  const isMatch = normSubmitted === normCorrect;

  return {
    isCorrect: isMatch,
    pointsAwarded: isMatch ? 1.0 : 0.0
  };
}

export function isAttemptExpired(expiresAtIso: string): boolean {
  const expirationTime = new Date(expiresAtIso).getTime();
  return Date.now() >= expirationTime;
}

export function getRemainingSeconds(expiresAtIso: string): number {
  const diffMs = new Date(expiresAtIso).getTime() - Date.now();
  return Math.max(0, Math.floor(diffMs / 1000));
}
