/**
 * Library entry: re-exports the deterministic seed helpers so the
 * stress harness and tests can drive datasets programmatically.
 */

export {
  synthesizeBody,
  synthesizeTitle,
} from './content.ts';
export {
  seedDataset,
  type SeedSummary,
} from './dataset.ts';
export {
  sampleCommentCount,
  sampleIssueCount,
} from './distributions.ts';
export {
  type Phase2RepoSeedResult,
  seedPhase2ForRepo,
} from './generate-phase2.ts';
export {
  seedIssuesForRepo,
  seedLabels,
  seedRepos,
  seedUsers,
} from './generate.ts';
export {
  rng,
  rngInt,
  rngPick,
} from './rng.ts';
