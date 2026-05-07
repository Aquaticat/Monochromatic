/**
 * PR + review seeding for Phase 2. Pulled out of `generate-phase2.ts`
 * so the orchestrator stays under the max-lines budget.
 */

import {
  createPullRequestWithEvent,
  submitReviewWithEvent,
} from '@monochromatic-dev/webapp-forge-server/ts/data/queries';

import {
  rngInt,
  rngPick,
} from './rng.ts';
import {
  synthesizeBody,
  synthesizeTitle,
} from './content.ts';
import {
  deterministicId,
  fakeSha,
  PR_NUMBER_BASE,
} from './generate-phase2-helpers.ts';

/** Recognised review states (and their relative weights for sampling). */
const REVIEW_STATES: readonly string[] = [
  'approved',
  'commented',
  'changes_requested',
];

/** Maximum PRs per repo (sampled per-repo). */
const MAX_PRS_PER_REPO = 5;

/** Maximum reviews per PR. */
const MAX_REVIEWS_PER_PR = 4;

/** PR title word-count range. */
const PR_TITLE_WORDS_LO = 3;

/** PR title word-count high. */
const PR_TITLE_WORDS_HI = 6;

/** PR body word-count range. */
const PR_BODY_WORDS_LO = 12;

/** PR body word-count high. */
const PR_BODY_WORDS_HI = 80;

/** Review body word-count range. */
const REVIEW_BODY_WORDS_LO = 4;

/** Review body word-count high. */
const REVIEW_BODY_WORDS_HI = 30;

/** RNG offset to derive PR-body word counts. */
const PR_BODY_OFFSET = 117;

/** RNG offset for SHA derivation. */
const SHA_SEED_OFFSET = 12_006;

/**
 * Inserts a deterministic batch of PRs per repo with synthesised
 * head/base refs and a random author drawn from the user pool.
 *
 * @param row - inputs
 *
 * @returns ids of created PR issues + total count
 *
 * @example
 * ```ts
 * const r = await seedPullRequestsForRepo({...});
 * ```
 */
export async function seedPullRequestsForRepo(row: {
  repoId: string;
  seed: number;
  userBaseSeed: number;
  userCount: number;
  baseTimestamp: number;
},): Promise<{
  count: number;
  issueIds: readonly string[];
}> {
  const count = rngInt({
    seed: row.seed,
    lo: 0,
    hi: MAX_PRS_PER_REPO + 1,
  },);
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const prSeed = row.seed + i;
    const issueId = deterministicId(
      `pr-${row.repoId}`,
      i,
    );
    const authorIndex = rngInt({
      seed: prSeed,
      lo: 0,
      hi: row.userCount,
    },);
    const authorId = deterministicId(
      'user',
      row.userBaseSeed + authorIndex,
    );
    const bodyWords = rngInt({
      seed: prSeed + PR_BODY_OFFSET,
      lo: PR_BODY_WORDS_LO,
      hi: PR_BODY_WORDS_HI + 1,
    },);
    void PR_TITLE_WORDS_LO;
    void PR_TITLE_WORDS_HI;
    // eslint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
    await createPullRequestWithEvent({
      issueId,
      repoId: row.repoId,
      number: PR_NUMBER_BASE + i,
      authorId,
      title: synthesizeTitle(prSeed,),
      body: synthesizeBody({
        seed: prSeed,
        targetWordCount: bodyWords,
      },),
      baseRef: 'refs/heads/main',
      headRef: `refs/heads/feat-${String(i,)}`,
      headSha: fakeSha(prSeed + SHA_SEED_OFFSET,),
      createdAt: row.baseTimestamp + i,
    },);
    ids.push(issueId,);
  }
  return {
    count,
    issueIds: ids,
  };
}

/**
 * Inserts reviews for an existing PR set.
 *
 * @param row - inputs
 *
 * @returns total inserted review count
 *
 * @example
 * ```ts
 * await seedReviewsForPrs({ prIssueIds: ['pr-1'], ... });
 * ```
 */
export async function seedReviewsForPrs(row: {
  prIssueIds: readonly string[];
  seed: number;
  userBaseSeed: number;
  userCount: number;
  baseTimestamp: number;
},): Promise<number> {
  let total = 0;
  for (const [index, prIssueId,] of row.prIssueIds.entries()) {
    const reviewCount = rngInt({
      seed: row.seed + index,
      lo: 0,
      hi: MAX_REVIEWS_PER_PR + 1,
    },);
    for (let r = 0; r < reviewCount; r += 1) {
      const reviewSeed = row.seed + index * MAX_REVIEWS_PER_PR + r;
      const reviewerIndex = rngInt({
        seed: reviewSeed,
        lo: 0,
        hi: row.userCount,
      },);
      const reviewerId = deterministicId(
        'user',
        row.userBaseSeed + reviewerIndex,
      );
      const state = rngPick({
        seed: reviewSeed,
        items: REVIEW_STATES,
      },) ?? 'commented';
      const bodyWords = rngInt({
        seed: reviewSeed,
        lo: REVIEW_BODY_WORDS_LO,
        hi: REVIEW_BODY_WORDS_HI + 1,
      },);
      // eslint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
      await submitReviewWithEvent({
        id: deterministicId(
          `review-${prIssueId}`,
          r,
        ),
        prIssueId,
        reviewerId,
        state,
        body: synthesizeBody({
          seed: reviewSeed,
          targetWordCount: bodyWords,
        },),
        createdAt: row.baseTimestamp + index + r,
      },);
      total += 1;
    }
  }
  return total;
}
