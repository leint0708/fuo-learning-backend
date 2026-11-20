export type BenchmarkMode = "ai" | "community";

export interface CommunityStatsSummary {
  total_comments: number;
  valid_vote_count: number;
  top_answer_votes: number;
  agreement_ratio: number;
  community_answer: string | null;
}

function deriveTopAnswerFromDistribution(
  voteDistribution: unknown
): string | null {
  if (!voteDistribution || typeof voteDistribution !== "object" || Array.isArray(voteDistribution)) {
    return null;
  }

  let topAnswer: string | null = null;
  let topVotes = 0;

  for (const [answer, rawCount] of Object.entries(voteDistribution as Record<string, unknown>)) {
    const count = typeof rawCount === "number" ? rawCount : Number(rawCount);
    if (Number.isFinite(count) && count > topVotes) {
      topVotes = count;
      topAnswer = answer.trim().toUpperCase();
    }
  }

  return topAnswer;
}

export function parseCommunityStats(rawStats: unknown): CommunityStatsSummary | null {
  if (!rawStats) return null;

  let parsed: Record<string, unknown> | null = null;
  if (typeof rawStats === "string") {
    try {
      const obj = JSON.parse(rawStats);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        parsed = obj as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  } else if (typeof rawStats === "object" && !Array.isArray(rawStats)) {
    parsed = rawStats as Record<string, unknown>;
  }

  if (!parsed) return null;

  const totalComments = Number(parsed.total_comments ?? 0);
  const validVoteCount = Number(parsed.valid_vote_count ?? 0);
  const topAnswerVotes = Number(parsed.top_answer_votes ?? 0);
  const agreementRatio = Number(parsed.agreement_ratio ?? 0);

  let communityAnswer: string | null = null;
  if (typeof parsed.community_answer === "string" && parsed.community_answer.trim().length > 0) {
    communityAnswer = parsed.community_answer.trim().toUpperCase();
  } else if (validVoteCount > 0) {
    communityAnswer = deriveTopAnswerFromDistribution(parsed.vote_distribution);
  }

  return {
    total_comments: Number.isFinite(totalComments) ? totalComments : 0,
    valid_vote_count: Number.isFinite(validVoteCount) ? validVoteCount : 0,
    top_answer_votes: Number.isFinite(topAnswerVotes) ? topAnswerVotes : 0,
    agreement_ratio: Number.isFinite(agreementRatio) ? agreementRatio : 0,
    community_answer: validVoteCount > 0 ? communityAnswer : null
  };
}

export function resolveBenchmarkAnswer(
  aiCorrectAnswer: string,
  communityStats: CommunityStatsSummary | null,
  requestedMode: BenchmarkMode = "ai"
): { benchmarkSource: BenchmarkMode; correctAnswer: string } {
  if (
    requestedMode === "community" &&
    communityStats &&
    communityStats.valid_vote_count > 0 &&
    communityStats.community_answer
  ) {
    return {
      benchmarkSource: "community",
      correctAnswer: communityStats.community_answer
    };
  }

  return {
    benchmarkSource: "ai",
    correctAnswer: aiCorrectAnswer
  };
}
