/**
 * Deterministic seeding routines for Phase 2 resources: milestones,
 * pull requests, reviews, issue assignees, and repo members.
 *
 * The orchestrator lives here; per-resource helpers are split across
 * `generate-phase2-prs.ts` (PRs + reviews) and `generate-phase2-helpers.ts`
 * (id derivation + SHA helpers + shared constants) so each file stays
 * under the per-package max-lines budget.
 */

import {
  assignUserToIssue,
  insertMilestone,
  upsertRepoMember,
} from '@monochromatic-dev/webapp-forge-server/ts/data/queries';

import {
  rngInt,
  rngPick,
} from './rng.ts';
import { deterministicId, } from './generate-phase2-helpers.ts';
import {
  seedPullRequestsForRepo,
  seedReviewsForPrs,
} from './generate-phase2-prs.ts';

/** Allowed repo-member roles. */
const ROLES: readonly string[] = [
  'reader',
  'member',
  'owner',
];

/** Maximum milestones per repo (sampled per-repo). */
const MAX_MILESTONES_PER_REPO = 3;

/** Maximum assignees per issue. */
const MAX_ASSIGNEES_PER_ISSUE = 3;

/** Maximum members per repo (excluding owner). */
const MAX_MEMBERS_PER_REPO = 5;

/** RNG offset to derive milestone seeds from a repo seed. */
const MILESTONE_SEED_OFFSET = 7_001;

/** RNG offset to derive PR seeds from a repo seed. */
const PR_SEED_OFFSET = 8_002;

/** RNG offset to derive review seeds. */
const REVIEW_SEED_OFFSET = 9_003;

/** RNG offset to derive assignee seeds. */
const ASSIGNEE_SEED_OFFSET = 10_004;

/** RNG offset to derive member seeds. */
const MEMBER_SEED_OFFSET = 11_005;

/**
 * Result row from a Phase 2 repo seeding pass.
 */
export type Phase2RepoSeedResult = {
  milestones: number;
  prs: number;
  reviews: number;
  assignees: number;
  members: number;
};

/**
 * Adds Phase 2 resources to one already-seeded repo.
 *
 * @param row - per-repo seed inputs (mirrors `seedIssuesForRepo`)
 *
 * @returns counts per resource family
 *
 * @example
 * ```ts
 * const counts = await seedPhase2ForRepo({
 *   repoId: 'repo-1',
 *   seed: 17,
 *   userBaseSeed: 1000,
 *   userCount: 10,
 *   baseTimestamp: Date.now(),
 *   issueIds: ['issue-1', 'issue-2'],
 * });
 * ```
 */
export async function seedPhase2ForRepo(row: {
  repoId: string;
  seed: number;
  userBaseSeed: number;
  userCount: number;
  baseTimestamp: number;
  issueIds: readonly string[];
},): Promise<Phase2RepoSeedResult> {
  const milestones = await seedMilestones({
    repoId: row.repoId,
    seed: row.seed + MILESTONE_SEED_OFFSET,
    baseTimestamp: row.baseTimestamp,
  },);
  const prs = await seedPullRequestsForRepo({
    repoId: row.repoId,
    seed: row.seed + PR_SEED_OFFSET,
    userBaseSeed: row.userBaseSeed,
    userCount: row.userCount,
    baseTimestamp: row.baseTimestamp,
  },);
  const reviews = await seedReviewsForPrs({
    prIssueIds: prs.issueIds,
    seed: row.seed + REVIEW_SEED_OFFSET,
    userBaseSeed: row.userBaseSeed,
    userCount: row.userCount,
    baseTimestamp: row.baseTimestamp,
  },);
  const assignees = await seedAssigneesForIssues({
    issueIds: row.issueIds,
    seed: row.seed + ASSIGNEE_SEED_OFFSET,
    userBaseSeed: row.userBaseSeed,
    userCount: row.userCount,
  },);
  const members = await seedRepoMembers({
    repoId: row.repoId,
    seed: row.seed + MEMBER_SEED_OFFSET,
    userBaseSeed: row.userBaseSeed,
    userCount: row.userCount,
  },);
  return {
    milestones,
    prs: prs.count,
    reviews,
    assignees,
    members,
  };
}

/**
 * Inserts a small fixed-but-deterministic set of milestones per repo.
 *
 * @param row - inputs
 *
 * @returns inserted-milestone count
 *
 * @example
 * ```ts
 * await seedMilestones({ repoId: 'r1', seed: 1, baseTimestamp: 0 });
 * ```
 */
async function seedMilestones(row: {
  repoId: string;
  seed: number;
  baseTimestamp: number;
},): Promise<number> {
  const count = rngInt({
    seed: row.seed,
    lo: 0,
    hi: MAX_MILESTONES_PER_REPO + 1,
  },);
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- libSQL prepared statements run serially
    await insertMilestone({
      id: deterministicId(
        `milestone-${row.repoId}`,
        i,
      ),
      repoId: row.repoId,
      title: `v${String(i + 1,)}.0`,
      dueAt: row.baseTimestamp + (i + 1) * MILESTONE_SEED_OFFSET,
    },);
  }
  return count;
}

/**
 * Adds 0..N assignees to each issue.
 *
 * @param row - inputs
 *
 * @returns total assignment count
 *
 * @example
 * ```ts
 * await seedAssigneesForIssues({ issueIds: ['i1'], ... });
 * ```
 */
async function seedAssigneesForIssues(row: {
  issueIds: readonly string[];
  seed: number;
  userBaseSeed: number;
  userCount: number;
},): Promise<number> {
  let total = 0;
  for (const [index, issueId,] of row.issueIds.entries()) {
    const count = rngInt({
      seed: row.seed + index,
      lo: 0,
      hi: MAX_ASSIGNEES_PER_ISSUE + 1,
    },);
    for (let a = 0; a < count; a += 1) {
      const userIndex = rngInt({
        seed: row.seed + index + a,
        lo: 0,
        hi: row.userCount,
      },);
      const userId = deterministicId(
        'user',
        row.userBaseSeed + userIndex,
      );
      // eslint-disable-next-line no-await-in-loop -- libSQL prepared statements run serially
      await assignUserToIssue({
        issueId,
        userId,
      },);
      total += 1;
    }
  }
  return total;
}

/**
 * Adds a small set of repo members with random roles.
 *
 * @param row - inputs
 *
 * @returns inserted-member count
 *
 * @example
 * ```ts
 * await seedRepoMembers({ repoId: 'r1', seed: 1, ... });
 * ```
 */
async function seedRepoMembers(row: {
  repoId: string;
  seed: number;
  userBaseSeed: number;
  userCount: number;
},): Promise<number> {
  const count = rngInt({
    seed: row.seed,
    lo: 0,
    hi: MAX_MEMBERS_PER_REPO + 1,
  },);
  for (let i = 0; i < count; i += 1) {
    const userIndex = rngInt({
      seed: row.seed + i,
      lo: 0,
      hi: row.userCount,
    },);
    const userId = deterministicId(
      'user',
      row.userBaseSeed + userIndex,
    );
    const role = rngPick({
      seed: row.seed + i,
      items: ROLES,
    },) ?? 'reader';
    // eslint-disable-next-line no-await-in-loop -- libSQL prepared statements run serially
    await upsertRepoMember({
      repoId: row.repoId,
      userId,
      role,
    },);
  }
  return count;
}
