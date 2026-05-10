/**
 * Top-level dataset orchestrator.
 *
 * Glues the per-resource seeding helpers in `generate.ts` together into
 * a single deterministic call.
 */

import {
  seedIssuesForRepo,
  seedLabels,
  seedRepos,
  seedUsers,
} from './generate.ts';
import { seedPhase2ForRepo, } from './generate-phase2.ts';

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
  const userBaseSeed = row.seed * USER_SEED_FACTOR;
  await seedUsers({
    seed: userBaseSeed,
    count: row.userCount,
    baseTimestamp: row.baseTimestamp,
  },);
  const repoBaseSeed = row.seed * REPO_SEED_FACTOR;
  const repoIds = await seedRepos({
    seed: repoBaseSeed,
    repoCount: row.repoCount,
    userBaseSeed,
    userCount: row.userCount,
    baseTimestamp: row.baseTimestamp,
  },);
  const {
    totalLabels,
    labelsByRepo,
  } = await seedLabels({
    repoIds,
    seed: row.seed,
  },);
  let totalIssues = 0;
  let totalComments = 0;
  let totalMilestones = 0;
  let totalPrs = 0;
  let totalReviews = 0;
  let totalAssignees = 0;
  let totalMembers = 0;
  for (const [index, repoId,] of repoIds.entries()) {
    const labels = labelsByRepo.get(repoId,) ?? [];
    // oxlint-disable-next-line no-await-in-loop -- per-repo serial seeding keeps libSQL transactions linear
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
    totalIssues += r.issues;
    totalComments += r.comments;
    // oxlint-disable-next-line no-await-in-loop -- per-repo serial seeding keeps libSQL transactions linear
    const phase2 = await seedPhase2ForRepo({
      repoId,
      seed: repoBaseSeed + index,
      userBaseSeed,
      userCount: row.userCount,
      baseTimestamp: row.baseTimestamp + index * REPO_SEED_FACTOR,
      issueIds: r.issueIds,
    },);
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
