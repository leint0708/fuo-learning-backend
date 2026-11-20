import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../src/index";
import { createTestEnv } from "../helpers/d1-mock";

describe("Practice Progress Cross-Device Sync API", () => {
  const env = createTestEnv(true);
  let token = "";
  let madQuestions: string[] = [];

  beforeAll(async () => {
    const regRes = await app.request(
      "/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "sync_learner@fpt.edu.vn",
          password: "SyncPassword123!",
          full_name: "Sync Learner"
        })
      },
      env
    );
    const regData = (await regRes.json()) as any;
    token = regData.access_token;

    const drillsRes = await app.request(
      "/api/v1/questions/drills?subject_code=MAD101&all=true&count=10000",
      { method: "GET" },
      env
    );
    const drillsData = (await drillsRes.json()) as any[];
    madQuestions = drillsData.map((q) => q.question_id);
  });

  it("merges PC and mobile Cram & Learn progress via union and exposes user summary", async () => {
    expect(madQuestions.length).toBeGreaterThanOrEqual(80);

    // Initial state is empty
    const initRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(initRes.status).toBe(200);
    const initData = (await initRes.json()) as any;
    expect(initData.cram_mastered_ids).toEqual([]);
    expect(initData.learn_mastered_ids).toEqual([]);

    // PC syncs 60 Cram mastered + 20 Learn mastered
    const pcCramIds = madQuestions.slice(0, 60);
    const pcLearnIds = madQuestions.slice(0, 20);
    const pcSyncRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cram_mastered_ids: pcCramIds,
          learn_mastered_ids: pcLearnIds,
          card_stats: {
            [pcLearnIds[0]!]: {
              question_id: pcLearnIds[0],
              consecutive_correct: 1,
              wrong_attempts: 0,
              total_attempts: 1,
              status: "learned"
            }
          }
        })
      },
      env
    );
    expect(pcSyncRes.status).toBe(200);
    const pcSyncData = (await pcSyncRes.json()) as any;
    expect(pcSyncData.cram_mastered_ids).toHaveLength(60);
    expect(pcSyncData.learn_mastered_ids).toHaveLength(20);

    // Mobile syncs 15 overlapping + 10 new Cram IDs, and 5 new Learn IDs
    const mobileCramIds = madQuestions.slice(45, 70);
    const mobileLearnIds = madQuestions.slice(15, 25);
    const mobileSyncRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cram_mastered_ids: mobileCramIds,
          learn_mastered_ids: mobileLearnIds
        })
      },
      env
    );
    expect(mobileSyncRes.status).toBe(200);
    const mobileSyncData = (await mobileSyncRes.json()) as any;
    expect(mobileSyncData.cram_mastered_ids).toHaveLength(70);
    expect(mobileSyncData.learn_mastered_ids).toHaveLength(25);

    // Summary endpoint reflects merged totals
    const summaryRes = await app.request(
      "/api/v1/users/me/practice-progress",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(summaryRes.status).toBe(200);
    const summary = (await summaryRes.json()) as any[];
    expect(summary).toEqual([
      {
        subject_code: "MAD101",
        cram_count: 70,
        learn_count: 25
      }
    ]);
  });

  it("supports mode-scoped reset without erasing the other practice mode", async () => {
    const resetCramRes = await app.request(
      "/api/v1/subjects/MAD101/practice/reset",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mode: "cram" })
      },
      env
    );
    expect(resetCramRes.status).toBe(200);

    const afterCramResetRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    const afterCramReset = (await afterCramResetRes.json()) as any;
    expect(afterCramReset.cram_mastered_ids).toHaveLength(0);
    expect(afterCramReset.learn_mastered_ids).toHaveLength(25);
    expect(afterCramReset.cram_active_batch).toBeNull();
  });

  it("persists and clears in-progress cram_active_batch across reloads and devices", async () => {
    const batchIds = madQuestions.slice(0, 10);
    const doneIds = batchIds.slice(0, 7);
    const remainingIds = batchIds.slice(7, 10);

    const saveRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cram_mastered_ids: doneIds,
          cram_active_batch: {
            scope: "deck",
            batch_question_ids: batchIds,
            active_queue_ids: remainingIds,
            queue_pointer: 0,
            mastered_in_batch_ids: doneIds,
            missed_ids: [remainingIds[0]],
            updated_at: "2026-11-19T14:00:00.000Z"
          }
        })
      },
      env
    );
    expect(saveRes.status).toBe(200);
    const saveData = (await saveRes.json()) as any;
    expect(saveData.cram_active_batch).toEqual({
      scope: "deck",
      batch_question_ids: batchIds,
      active_queue_ids: remainingIds,
      queue_pointer: 0,
      mastered_in_batch_ids: doneIds,
      missed_ids: [remainingIds[0]],
      updated_at: "2026-11-19T14:00:00.000Z"
    });

    // Reload / fetch on another device returns exact same 10-card batch & 7 done IDs
    const getRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      },
      env
    );
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as any;
    expect(getData.cram_active_batch.batch_question_ids).toEqual(batchIds);
    expect(getData.cram_active_batch.mastered_in_batch_ids).toEqual(doneIds);
    expect(getData.cram_active_batch.active_queue_ids).toEqual(remainingIds);

    // Clearing active batch when batch completes sets cram_active_batch back to null
    const clearRes = await app.request(
      "/api/v1/subjects/MAD101/practice/progress",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cram_mastered_ids: batchIds,
          cram_active_batch: null
        })
      },
      env
    );
    expect(clearRes.status).toBe(200);
    const clearData = (await clearRes.json()) as any;
    expect(clearData.cram_active_batch).toBeNull();
  });
});
