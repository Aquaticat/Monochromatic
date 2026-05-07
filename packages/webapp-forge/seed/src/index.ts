/**
 * Library entry: re-exports the deterministic seed helpers so the
 * stress harness and tests can drive datasets programmatically.
 */

export {
  seedDataset,
  type SeedSummary,
} from './dataset.ts';
export {
  seedIssuesForRepo,
  seedLabels,
  seedRepos,
  seedUsers,
} from './generate.ts';
export {
  seedPhase2ForRepo,
  type Phase2RepoSeedResult,
} from './generate-phase2.ts';
export {
  rng,
  rngInt,
  rngPick,
} from './rng.ts';
export {
  sampleCommentCount,
  sampleIssueCount,
} from './distributions.ts';
export {
  synthesizeBody,
  synthesizeTitle,
} from './content.ts';
