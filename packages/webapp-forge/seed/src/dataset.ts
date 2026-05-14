/**
 * Top-level dataset orchestrator.
 *
 * Glues the per-resource seeding helpers in `generate.ts` together into
 * a single deterministic call.
 */

import { seedPhase2ForRepo, } from './generate-phase2.ts';
import {
  seedIssuesForRepo,
  seedLabels,
  seedRepos,
  seedUsers,
} from './generate.ts';

/** Per-user seed offset to space user ids out of the repo namespace. */
const USER_SEED_FACTOR = 1_000;

/** Per-repo seed offset used to keep different repos generating different rows. */
const REPO_SEED_FACTOR = 1_000_000;

/**
 * Output of {@link seedDataset}: counts so the caller can sanity-check.
 */
export type SeedSummary = {
  readonly users: number;
  readonly repos: number;
  readonly labels: number;
  readonly issues: number;
  readonly comments: number;
  readonly milestones: number;
  readonly prs: number;
  readonly reviews: number;
  readonly assignees: number;
  readonly members: number;
};

/**
 * Seeds an entire dataset deterministically.
 *
 * @param row - high-level knobs
 *
 * @returns aggregate counts
 *
 * @example
 * ```ts
 * await seedDataset({ seed: 1, userCount: 10, repoCount: 3, baseTimestamp: Date.now() });
 * ```
 */
export async function seedDataset(row: {
  seed: number;
  userCount: number;
  repoCount: number;
  baseTimestamp: number;
  maxIssuesPerRepo?: number;
},): Promise<SeedSummary> {
  /** Namespace offset reserving the user id range from repos sharing the same root seed. */
  const userBaseSeed = row.seed * USER_SEED_FACTOR;
  await seedUsers({
    seed: userBaseSeed,
    count: row.userCount,
    baseTimestamp: row.baseTimestamp,
  },);
  /** Namespace offset reserving the repo id range from users sharing the same root seed. */
  const repoBaseSeed = row.seed * REPO_SEED_FACTOR;
  /** Repo id list returned from seeding; reused to derive per-repo iteration order. */
  const repoIds = await seedRepos({
    seed: repoBaseSeed,
    repoCount: row.repoCount,
    userBaseSeed,
    userCount: row.userCount,
    baseTimestamp: row.baseTimestamp,
  },);
  /** Destructured label totals so the summary can aggregate without re-querying. */
  const {
    totalLabels,
    labelsByRepo,
  } = await seedLabels({
    repoIds,
    seed: row.seed,
  },);
  /** Running tally accumulated across per-repo phase-1 seeding. */
  let totalIssues = 0;
  /** Running tally accumulated across per-repo phase-1 seeding. */
  let totalComments = 0;
  /** Running tally accumulated across per-repo phase-2 seeding. */
  let totalMilestones = 0;
  /** Running tally accumulated across per-repo phase-2 seeding. */
  let totalPrs = 0;
  /** Running tally accumulated across per-repo phase-2 seeding. */
  let totalReviews = 0;
  /** Running tally accumulated across per-repo phase-2 seeding. */
  let totalAssignees = 0;
  /** Running tally accumulated across per-repo phase-2 seeding. */
  let totalMembers = 0;
  for (const [index, repoId,] of repoIds.entries()) {
    /** Per-repo label id list defaulted to empty so the seeder receives a concrete array. */
    const labels = labelsByRepo.get(repoId,) ?? [];
    /* oxlint-disable no-await-in-loop -- per-repo serial seeding keeps libSQL transactions linear */
    /** Phase-1 seeding result reused for the comment/issue totals and to feed phase-2. */
    const r = await seedIssuesForRepo({
      repoId,
      seed: repoBaseSeed + index,
      userBaseSeed,
      userCount: row.userCount,
      baseTimestamp: row.baseTimestamp + index * REPO_SEED_FACTOR,
      labelIds: labels,
      ...(row.maxIssuesPerRepo === undefined
        ? {}
        : { maxIssues: row.maxIssuesPerRepo, }),
    },);
    /* oxlint-enable no-await-in-loop */
    totalIssues += r.issues;
    totalComments += r.comments;
    /* oxlint-disable no-await-in-loop -- per-repo serial seeding keeps libSQL transactions linear */
    /** Phase-2 seeding result aggregated into the per-resource totals. */
    const phase2 = await seedPhase2ForRepo({
      repoId,
      seed: repoBaseSeed + index,
      userBaseSeed,
      userCount: row.userCount,
      baseTimestamp: row.baseTimestamp + index * REPO_SEED_FACTOR,
      issueIds: r.issueIds,
    },);
    /* oxlint-enable no-await-in-loop */
    totalMilestones += phase2.milestones;
    totalPrs += phase2.prs;
    totalReviews += phase2.reviews;
    totalAssignees += phase2.assignees;
    totalMembers += phase2.members;
  }
  return {
    users: row.userCount,
    repos: row.repoCount,
    labels: totalLabels,
    issues: totalIssues,
    comments: totalComments,
    milestones: totalMilestones,
    prs: totalPrs,
    reviews: totalReviews,
    assignees: totalAssignees,
    members: totalMembers,
  };
}
