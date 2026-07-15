/**
 * Deterministic seeding routines.
 *
 * Each function inserts data through the server's data layer so the
 * fragment-index, sequence counters, and event log all stay consistent.
 */

import {
  createCommentWithEvent,
  createIssueWithEvent,
  insertLabel,
  insertRepo,
  insertUser,
  labelIssueWithEvent,
} from '@monochromatic-dev/webapp-forge-server/ts/data/queries';

import {
  synthesizeBody,
  synthesizeTitle,
} from './content.ts';
import {
  sampleCommentCount,
  sampleIssueCount,
} from './distributions.ts';
import {
  rngInt,
  rngPick,
} from './rng.ts';

/**
 * A single entry in the default label palette.
 */
type DefaultLabel = {
  name: string;
  color: string;
};

/**
 * Default label palette seeded into every repo.
 */
const DEFAULT_LABELS: readonly DefaultLabel[] = [
  {
    name: 'bug',
    color: 'd73a4a',
  },
  {
    name: 'feature',
    color: 'a2eeef',
  },
  {
    name: 'docs',
    color: '0075ca',
  },
  {
    name: 'good-first-issue',
    color: '7057ff',
  },
];

/**
 * Number of issues per resource times this constant when generating issue seeds.
 */
const ISSUE_SEED_MULTIPLIER = 31;

/**
 * Number of comments per resource times this constant when generating comment seeds.
 */
const COMMENT_SEED_MULTIPLIER = 7;

/**
 * Per-repo seed offset used to keep different repos generating different rows.
 */
const REPO_SEED_FACTOR = 1_000_000;

/**
 * Per-user seed offset to space user ids out of the repo namespace.
 */
const USER_SEED_FACTOR = 1_000;

/**
 * Lower bound for issue body word counts.
 */
const ISSUE_BODY_WORD_LO = 8;

/**
 * Upper bound for issue body word counts.
 */
const ISSUE_BODY_WORD_HI = 80;

/**
 * Lower bound for comment body word counts.
 */
const COMMENT_BODY_WORD_LO = 4;

/**
 * Upper bound for comment body word counts.
 */
const COMMENT_BODY_WORD_HI = 30;

/**
 * Per-issue offset added to derive the comment-count seed.
 */
const ISSUE_TO_COMMENT_SEED_OFFSET = 3;

/**
 * Per-issue offset added to derive the label-pick seed.
 */
const ISSUE_TO_LABEL_SEED_OFFSET = 2;

/**
 * Per-call offset added to a seed when picking a target word count.
 */
const WORD_COUNT_SEED_OFFSET = 1;

/**
 * Composes a deterministic id from a prefix and seed number.
 *
 * @param row - human-readable id namespace and integer seed
 *
 * @returns id of the form `${prefix}-${seed}`
 *
 * @example
 * ```ts
 * deterministicId({ prefix: 'issue', seed: 5 }); // 'issue-5'
 * ```
 */
function deterministicId(row: {
  prefix: string;
  seed: number;
},): string {
  return `${row.prefix}-${String(row.seed,)}`;
}

/**
 * Inserts `userCount` users with deterministic ids and logins.
 *
 * @param row - seed and user count
 *
 * @returns number of users inserted
 *
 * @example
 * ```ts
 * await seedUsers({ seed: 1000, count: 10, baseTimestamp: Date.now() });
 * ```
 */
export async function seedUsers(row: {
  seed: number;
  count: number;
  baseTimestamp: number;
},): Promise<number> {
  for (let i = 0; i < row
    .count; i += 1) {
    // oxlint-disable-next-line no-await-in-loop -- libSQL prepared statement is not safe for concurrent re-execution
    await insertUser({
      id: deterministicId({
        prefix: 'user',
        seed: row.seed
          + i,
      },),
      login: `user-${String(row.seed
        + i,)}`,
      email: `user-${String(row.seed
        + i,)}@forge.test`,
      createdAt: row.baseTimestamp
        + i,
    },);
  }
  return row.count;
}

/**
 * Inserts `repoCount` repos owned by users seeded earlier.
 *
 * @param row - seed, repo count, and the user-id range
 *
 * @returns inserted repo ids
 *
 * @example
 * ```ts
 * const ids = await seedRepos({ seed: 0, repoCount: 1, userBaseSeed: 0, userCount: 1, baseTimestamp: 0 });
 * ```
 */
export async function seedRepos(row: {
  seed: number;
  repoCount: number;
  userBaseSeed: number;
  userCount: number;
  baseTimestamp: number;
},): Promise<string[]> {
  /**
   * Collected repo ids returned to the caller for downstream seeding.
   */
  const repoIds: string[] = [];
  for (let i = 0; i < row
    .repoCount; i += 1) {
    /**
     * Deterministic user-table index used to pick the repo owner.
     */
    const ownerIndex = rngInt({
      seed: row.seed
        + i,
      lo: 0,
      hi: row.userCount,
    },);
    /**
     * Composed owner id mapped through the user namespace offset.
     */
    const ownerId = deterministicId({
      prefix: 'user',
      seed: row.userBaseSeed
        + ownerIndex,
    },);
    /**
     * Composed repo id reused by the insert and the returned id list.
     */
    const repoId = deterministicId({
      prefix: 'repo',
      seed: row.seed
        + i,
    },);
    // oxlint-disable-next-line no-await-in-loop -- libSQL prepared statement is not safe for concurrent re-execution
    await insertRepo({
      id: repoId,
      ownerId,
      name: `repo-${String(row.seed
        + i,)}`,
      createdAt: row.baseTimestamp
        + i,
    },);
    repoIds.push(repoId,);
  }
  return repoIds;
}

/**
 * Result of {@link seedLabels}: total inserted plus per-repo lookup.
 */
export type SeedLabelsResult = {
  readonly totalLabels: number;
  readonly labelsByRepo: Map<string, string[]>;
};

/**
 * Inserts the default label palette into every repo and returns the
 * label-id list per repo.
 *
 * @param row - repo ids
 *
 * @returns total labels inserted and the per-repo label id lookup
 *
 * @example
 * ```ts
 * const { totalLabels, labelsByRepo } = await seedLabels({ repoIds: ['r1'], seed: 0 });
 * ```
 */
export async function seedLabels(row: {
  repoIds: readonly string[];
  seed: number;
},): Promise<SeedLabelsResult> {
  /**
   * Per-repo label lookup populated below and returned so callers can re-attach labels to issues.
   */
  const labelsByRepo = new Map<string, string[]>();
  for (const repoId of row.repoIds) {
    /**
     * Per-repo label id list accumulated and stored in the lookup map.
     */
    const labels: string[] = [];
    for (const [index, label,] of DEFAULT_LABELS.entries()) {
      /**
       * Composed label id reused by the insert and the per-repo list.
       */
      const labelId = deterministicId({
        prefix: `label-${repoId}`,
        seed: row.seed
          + index,
      },);
      // oxlint-disable-next-line no-await-in-loop -- libSQL prepared statement is not safe for concurrent re-execution
      await insertLabel({
        id: labelId,
        repoId,
        name: label.name,
        color: label.color,
      },);
      labels.push(labelId,);
    }
    labelsByRepo.set(
      repoId,
      labels,
    );
  }
  /**
   * Total label inserts summed from the per-repo lists; derived to avoid a function-root let accumulator.
   */
  const totalLabels = [...labelsByRepo.values(),].reduce(
    function sumLabelLengths(
      sum,
      labels,
    ) {
      return sum + labels
        .length;
    },
    0,
  );
  return {
    totalLabels,
    labelsByRepo,
  };
}

/**
 * Counts returned by {@link seedIssuesForRepo}.
 */
export type SeedIssuesResult = {
  readonly issues: number;
  readonly comments: number;
  readonly issueIds: readonly string[];
};

/**
 * Inserts issues + comments for a single repo, drawn from the long-tail
 * distribution.
 *
 * @param row - repo, seed, base timestamp, label palette, user pool
 *
 * @returns issue and comment counts inserted
 *
 * @example
 * ```ts
 * await seedIssuesForRepo({ repoId, seed, userBaseSeed, userCount, baseTimestamp, labelIds });
 * ```
 */
export async function seedIssuesForRepo(row: {
  repoId: string;
  seed: number;
  userBaseSeed: number;
  userCount: number;
  baseTimestamp: number;
  labelIds: readonly string[];
  maxIssues?: number;
},): Promise<SeedIssuesResult> {
  /**
   * Long-tail-distributed issue count drawn from the seed before any cap is applied.
   */
  const requested = sampleIssueCount(row.seed,);
  /**
   * Final per-repo issue count, capped by the optional maxIssues argument when set.
   */
  const issueCount = row.maxIssues
    === undefined
    ? requested
    : Math.min(
      requested,
      row.maxIssues,
    );
  /**
   * Collected issue ids returned so phase-2 PR seeding can target them.
   */
  const issueIds: string[] = [];
  /**
   * Per-issue comment counts collected during the loop; summed below to avoid a function-root let.
   */
  const commentCounts: number[] = [];
  for (let i = 0; i < issueCount; i += 1) {
    /**
     * Per-issue sub-seed multiplied to spread issues across the seed space.
     */
    const issueSeed = (row.seed
      * ISSUE_SEED_MULTIPLIER) + i;
    /**
     * Deterministic user-table index used to pick the issue author.
     */
    const authorIndex = rngInt({
      seed: issueSeed,
      lo: 0,
      hi: row.userCount,
    },);
    /**
     * Composed author id mapped through the user namespace offset.
     */
    const authorId = deterministicId({
      prefix: 'user',
      seed: row.userBaseSeed
        + authorIndex,
    },);
    /**
     * Composed issue id reused by the insert, the label call, and the returned id list.
     */
    const issueId = deterministicId({
      prefix: `issue-${row.repoId}`,
      seed: i,
    },);
    /**
     * One-based issue number used for the insert and not reused elsewhere.
     */
    const number = i + 1;
    /**
     * Synthesised issue title derived from the per-issue seed.
     */
    const title = synthesizeTitle(issueSeed,);
    /**
     * Synthesised issue body whose word count is drawn from the issue body range.
     */
    const body = synthesizeBody({
      seed: issueSeed,
      targetWordCount: rngInt({
        seed: issueSeed + WORD_COUNT_SEED_OFFSET,
        lo: ISSUE_BODY_WORD_LO,
        hi: ISSUE_BODY_WORD_HI,
      },),
    },);
    // oxlint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
    await createIssueWithEvent({
      id: issueId,
      repoId: row.repoId,
      number,
      authorId,
      title,
      body,
      createdAt: row.baseTimestamp
        + i,
    },);
    issueIds.push(issueId,);
    // Optionally pin a label.
    if (row.labelIds
      .length
      > 0) {
      /**
       * Optional label id picked from the per-repo palette; null/undefined skips the insert.
       */
      const labelId = rngPick({
        seed: issueSeed + ISSUE_TO_LABEL_SEED_OFFSET,
        items: row.labelIds,
      },);
      if (labelId !== undefined) {
        // oxlint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
        await labelIssueWithEvent({
          issueId,
          labelId,
          createdAt: row.baseTimestamp
            + i,
        },);
      }
    }
    /**
     * Per-issue comment count drawn from the long-tail distribution; bounds the comment loop.
     */
    const commentCount = sampleCommentCount(
      issueSeed + ISSUE_TO_COMMENT_SEED_OFFSET,
    );
    for (let c = 0; c < commentCount; c += 1) {
      /**
       * Per-comment sub-seed multiplied to spread comments across the seed space.
       */
      const commentSeed = (issueSeed * COMMENT_SEED_MULTIPLIER) + c;
      /**
       * Deterministic user-table index used to pick the comment author.
       */
      const commentAuthorIndex = rngInt({
        seed: commentSeed,
        lo: 0,
        hi: row.userCount,
      },);
      /**
       * Composed comment author id mapped through the user namespace offset.
       */
      const commentAuthorId = deterministicId({
        prefix: 'user',
        seed: row.userBaseSeed
          + commentAuthorIndex,
      },);
      /**
       * Composed comment id reused only by the insert.
       */
      const commentId = deterministicId({
        prefix: `comment-${issueId}`,
        seed: c,
      },);
      /**
       * Synthesised comment body whose word count is drawn from the comment body range.
       */
      const commentBody = synthesizeBody({
        seed: commentSeed,
        targetWordCount: rngInt({
          seed: commentSeed + WORD_COUNT_SEED_OFFSET,
          lo: COMMENT_BODY_WORD_LO,
          hi: COMMENT_BODY_WORD_HI,
        },),
      },);
      // oxlint-disable-next-line no-await-in-loop -- transactional sequence rules out parallel inserts
      await createCommentWithEvent({
        id: commentId,
        issueId,
        authorId: commentAuthorId,
        body: commentBody,
        createdAt: row.baseTimestamp
          + i
          + c,
      },);
    }
    commentCounts.push(commentCount,);
  }
  /**
   * Total comment inserts summed from per-issue counts to avoid a function-root let accumulator.
   */
  const totalComments = commentCounts.reduce(
    function sumCounts(
      sum,
      count,
    ) {
      return sum + count;
    },
    0,
  );
  return {
    issues: issueCount,
    comments: totalComments,
    issueIds,
  };
}
