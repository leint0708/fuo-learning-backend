import { describe, it, expect } from "vitest";
import {
  parseCommunityStats,
  resolveBenchmarkAnswer
} from "../../src/services/community-stats";

describe("community-stats parsing and benchmark resolution", () => {
  it("parses explicit community_answer and vote stats", () => {
    const stats = parseCommunityStats(
      JSON.stringify({
        total_comments: 7,
        valid_vote_count: 6,
        top_answer_votes: 5,
        agreement_ratio: 0.8333,
        community_answer: "c",
        vote_distribution: { C: 5, A: 1 }
      })
    );

    expect(stats).toEqual({
      total_comments: 7,
      valid_vote_count: 6,
      top_answer_votes: 5,
      agreement_ratio: 0.8333,
      community_answer: "C"
    });
  });

  it("derives community_answer from vote_distribution when not explicitly stored", () => {
    const stats = parseCommunityStats({
      total_comments: 6,
      valid_vote_count: 6,
      top_answer_votes: 4,
      agreement_ratio: 0.6667,
      vote_distribution: { A: 2, C: 4 }
    });

    expect(stats?.community_answer).toBe("C");
  });

  it("returns null community_answer when valid_vote_count is 0", () => {
    const stats = parseCommunityStats({
      total_comments: 0,
      valid_vote_count: 0,
      top_answer_votes: 0,
      agreement_ratio: 0,
      vote_distribution: {}
    });

    expect(stats?.community_answer).toBeNull();
  });

  it("uses community answer when benchmark_mode is community and valid votes exist", () => {
    const stats = parseCommunityStats({
      total_comments: 5,
      valid_vote_count: 5,
      top_answer_votes: 4,
      agreement_ratio: 0.8,
      community_answer: "C"
    });

    expect(resolveBenchmarkAnswer("A", stats, "community")).toEqual({
      benchmarkSource: "community",
      correctAnswer: "C"
    });

    expect(resolveBenchmarkAnswer("A", stats, "ai")).toEqual({
      benchmarkSource: "ai",
      correctAnswer: "A"
    });
  });

  it("falls back to AI when benchmark_mode is community but no valid votes exist", () => {
    const emptyStats = parseCommunityStats({
      total_comments: 0,
      valid_vote_count: 0,
      top_answer_votes: 0,
      agreement_ratio: 0
    });

    expect(resolveBenchmarkAnswer("A", emptyStats, "community")).toEqual({
      benchmarkSource: "ai",
      correctAnswer: "A"
    });
  });
});
