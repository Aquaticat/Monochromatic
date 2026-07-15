/**
 * PR + review seeding for Phase 2. Pulled out of `generate-phase2.ts`
 * so the orchestrator stays under the max-lines budget.
 */

import {
  createPullRequestWithEvent,
  submitReviewWithEvent,
} from '@monochromatic-dev/webapp-forge-server/ts/data/queries';

import {
  synthesizeBody,
  synthesizeTitle,
} from './content.ts';
import {
  deterministicId,
  fakeSha,
  PR_NUMBER_BASE,
} from './generate-phase2-helpers.ts';
import {
  rngInt,
  rngPick,
} from './rng.ts';

/**
 * Recognised review states (and their relative weights for sampling).
 */
const REVIEW_STATES: readonly string[] = [
  'approved',
  'commented',
  'changes_requested',
];

/**
 * Maximum PRs per repo (sampled per-repo).
 */
const MAX_PRS_PER_REPO = 5;

/**
 * Maximum reviews per PR.
 */
const MAX_REVIEWS_PER_PR = 4;

/**
 * PR title word-count range.
 */
const PR_TITLE_WORDS_LO = 3;

/**
 * PR title word-count high.
 */
const PR_TITLE_WORDS_HI = 6;

/**
 * PR body word-count range.
 */
const PR_BODY_WORDS_LO = 12;

/**
 * PR body word-count high.
 */
const PR_BODY_WORDS_HI = 80;

/**
 * Review body word-count range.
 */
const REVIEW_BODY_WORDS_LO = 4;

/**
 * Review body word-count high.
 */
const REVIEW_BODY_WORDS_HI = 30;

/**
 * RNG offset to derive PR-body word counts.
 */
const PR_BODY_OFFSET = 117;

/**
 * RNG offset for SHA derivation.
 */
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
  /**
   * PR count drawn from the seed; bounds the insertion loop.
   */
  const count = rngInt({
    seed: row.seed,
    lo: 0,
    hi: MAX_PRS_PER_REPO + 1,
  },);
  /**
   * Collected PR issue ids returned to the caller for downstream review seeding.
   */
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    /**
     * Per-PR sub-seed reused for author, body, and SHA derivation.
     */
    const prSeed = row.seed
      + i;
    /**
     * Composed PR-issue id reused by the insert and the returned id list.
     */
    const issueId = deterministicId({
      prefix: `pr-${row.repoId}`,
      index: i,
    },);
    /**
     * Deterministic user-table index used to pick the PR author.
     */
    const authorIndex = rngInt({
      seed: prSeed,
      lo: 0,
      hi: row.userCount,
    },);
    /**
     * Composed author id mapped through the user namespace offset.
     */
    const authorId = deterministicId({
      prefix: 'user',
      index: row.userBaseSeed
        + authorIndex,
    },);
    /**
     * Body word-count target drawn from the seed; passed to the synthesiser.
     */
    const bodyWords = rngInt({
      seed: prSeed + PR_BODY_OFFSET,
      lo: PR_BODY_WORDS_LO,
      hi: PR_BODY_WORDS_HI + 1,
    },);
    void PR_TITLE_WORDS_LO;
    void PR_TITLE_WORDS_HI;
    // oxlint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
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
      createdAt: row.baseTimestamp
        + i,
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
  /**
   * Running review count returned to the caller after the per-PR loops finish.
   */
  let total = 0;
  for (const [index, prIssueId,] of row.prIssueIds
    .entries()) {
    /**
     * Per-PR review count drawn from the seed; bounds the inner loop.
     */
    const reviewCount = rngInt({
      seed: row.seed
        + index,
      lo: 0,
      hi: MAX_REVIEWS_PER_PR + 1,
    },);
    for (let r = 0; r < reviewCount; r += 1) {
      /**
       * Per-review sub-seed offset so each review draws unique reviewer/state/body.
       */
      const reviewSeed = row.seed
        + (index * MAX_REVIEWS_PER_PR)
        + r;
      /**
       * Deterministic user-table index used to pick the reviewer.
       */
      const reviewerIndex = rngInt({
        seed: reviewSeed,
        lo: 0,
        hi: row.userCount,
      },);
      /**
       * Composed reviewer id mapped through the user namespace offset.
       */
      const reviewerId = deterministicId({
        prefix: 'user',
        index: row.userBaseSeed
          + reviewerIndex,
      },);
      /**
       * Review state sampled from the allowed set, defaulted to commented when picking fails.
       */
      const state = rngPick({
        seed: reviewSeed,
        items: REVIEW_STATES,
      },)
        ?? 'commented';
      /**
       * Review body word-count target drawn from the seed; passed to the synthesiser.
       */
      const bodyWords = rngInt({
        seed: reviewSeed,
        lo: REVIEW_BODY_WORDS_LO,
        hi: REVIEW_BODY_WORDS_HI + 1,
      },);
      // oxlint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
      await submitReviewWithEvent({
        id: deterministicId({
          prefix: `review-${prIssueId}`,
          index: r,
        },),
        prIssueId,
        reviewerId,
        state,
        body: synthesizeBody({
          seed: reviewSeed,
          targetWordCount: bodyWords,
        },),
        createdAt: row.baseTimestamp
          + index
          + r,
      },);
      total += 1;
    }
  }
  return total;
}
