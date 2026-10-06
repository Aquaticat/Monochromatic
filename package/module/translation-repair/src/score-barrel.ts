//region Score barrel
// What the `score-*` runners print and how they print it, named so each
// module's exports can be tested like every sibling's. Everything here belongs
// to one CLI family, which reads graded sheets, manifests and settled
// artifacts and never calls a model.

export { requireArtifactsDir, } from './corpus-run/score-artifacts-dir.ts';
export {
  attributionCriticLine,
  attributionHeaderLine,
} from './corpus-run/score-attribution-table.ts';
export {
  printMalformedArtifacts,
  printPartialJoinWarning,
  printUnattributedWarning,
} from './corpus-run/score-attribution-warnings.ts';
export { printAttribution, } from './corpus-run/score-attribution-run.ts';
export {
  parseVerifyManifest,
  readVerifyManifest,
  type VerifyManifestItem,
} from './corpus-run/score-verify-manifest.ts';
export { printVerifyScore, } from './corpus-run/score-verify-run.ts';
export {
  type KindTally,
  tallyByKind,
  verifyKindLines,
} from './corpus-run/score-verify-tally.ts';
export { readSheetText, } from './corpus-run/score-sheet-text.ts';
export {
  type FileReading,
  preGradeName,
  readNamedOrBeside,
  readOptional,
} from './corpus-run/score-agreement-read.ts';
export {
  positionsOrNone,
  printAgreement,
  printPrecision,
  agreementRate,
} from './corpus-run/score-agreement-print.ts';
export { printGradeReport, } from './corpus-run/score-agreement-run.ts';
export {
  countRefinedJoined,
  joinProbeGrades,
  printProbeAgreement,
} from './corpus-run/score-probe-agreement.ts';
export { gatherProbeReadings, } from './corpus-run/score-probe-gather.ts';
export { printProbeScore, } from './corpus-run/score-probe-run.ts';
export {
  type AuthorRow,
  authorHeaderLine,
  authorLine,
  tallyAuthors,
} from './corpus-run/score-crosscheck-authors.ts';
export {
  printCrosscheckMalformed,
  printJoinFailureWarning,
  printUnjudgeableWarning,
} from './corpus-run/score-crosscheck-warnings.ts';
export { printCrosscheck, } from './corpus-run/score-crosscheck-run.ts';

//endregion Score barrel
