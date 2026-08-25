//region Ballot barrel
// Who voted, what they said, and what it summed to.
//
// SPLIT OUT OF `pipeline-barrel.ts` when the panel reading pushed that file
// past the line cap, and the grouping is the honest one rather than whatever
// fitted: every export here belongs to the same question. Three stages of this
// pipeline decide by weighted vote, and each of them now records the ballots
// beside the sums instead of only the sums. A reader auditing one of those
// decisions imports from exactly one place.
//
// TYPES ONLY FROM THE PANEL SIDE. `panelReadingForClaim` builds them and is
// imported directly by its one caller: putting it here would publish untested
// surface, since every test of it goes through `tallyVotes`.

export type {
  IssueCheckerBallot,
  IssueCheckerReading,
} from './checker-reading.ts';
export type {
  ClaimPanelReading,
  PanelClaimBallot,
} from './panel-reading.ts';
export {
  type IssueResolutionTally,
  resolveResolutionChecks,
  type ResolutionBallot,
  tallyResolutionChecks,
} from './tally-resolution.ts';

/**
 * Slate shapes the selection stage decides over.
 *
 * @internal Exported so tests and the ledger can name what a contest held;
 * production callers reach these through `selectBestCandidate`.
 */
export type {
  Candidate,
  CandidateProducer,
  SelectionBallot,
} from './candidate-select-model.ts';

/**
 * Reading the recorded contests back.
 *
 * @internal Exported so tests exercise the shipped artifact. The report CLI is
 * the production reader; nothing in the pipeline itself reads its own ledger.
 */
export {
  LedgerShapeError,
  parseLedgerRound,
  type ReadBallot,
  type ReadCandidate,
  type ReadRound,
} from './corpus-run/ledger-parse.ts';
export {
  type LedgerReading,
  readLedgerDirectory,
  refusalOf,
  type RefusedFile,
} from './corpus-run/ledger-directory.ts';
export {
  type CandidateReading,
  type LedgerSummary,
  type ModelWork,
  summariseLedger,
  workOfModel,
} from './corpus-run/ledger-read.ts';

//endregion Ballot barrel
