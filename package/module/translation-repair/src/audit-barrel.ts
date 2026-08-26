//region Audit barrel
// The rendering audit's readers, its comparisons and its report: what a
// settled artifact says about the page it produced, and how a run of them is
// tallied for an operator.
//
// Split out of `corpus-barrel.ts` when that file reached its line budget, at
// the same seam the earlier splits used: by AUDIENCE. Everything here belongs
// to one CLI family, `rendering-audit-settled*`, which reads finished runs and
// prints; the pass driver calls none of it and the pooling filter none either.
//
// TWO OF ITS MODULES HAD NEVER BEEN NAMED BY ANY BARREL. `#231` measured the
// package's reachability and found `rendering-audit-settled-args.ts` and
// `rendering-audit-settled-print.ts` reachable only from the CLI that runs on
// import, which no test can import. They are here so their exports can be
// tested like every sibling's.

export {
  type AudienceSplit,
  rateByVoice,
  type AuditRelocationPair,
  splitFor,
  type VoiceRate,
} from './corpus-run/rendering-audit-settled-read.ts';
export {
  auditRelocationPairs,
  distinctSlicePairs,
} from './corpus-run/rendering-audit-settled-relocation.ts';
export {
  auditOne,
  capped,
  eligibleSubjects,
  printPopulation,
} from './corpus-run/rendering-audit-settled-buy.ts';
export {
  newestRun,
  printAcross,
  readRunRows,
} from './corpus-run/rendering-audit-settled-runs.ts';
export { RenderingAuditInvariantError, } from './rendering-audit-invariant.ts';
export {
  type AuditRepeatPair,
  auditRepeatsAcross,
  type AuditRepeatSide,
  auditRepeatsWithin,
} from './corpus-run/rendering-audit-settled-repeat.ts';
export {
  type AuditRepeatBand,
  repeatBandOf,
} from './corpus-run/rendering-audit-settled-band.ts';
export {
  digestAuditedText,
  sameAuditedText,
  textIdentityOf,
} from './corpus-run/rendering-audit-settled-digest.ts';
export type {
  AuditedTextIdentity,
  SettledAuditRow,
} from './corpus-run/rendering-audit-settled-row.ts';
export {
  pageRelationFor,
  pageRelationLabel,
  pageRelationOf,
  type PageRelationTally,
  relationTallyOf,
  type SettledPageRelation,
} from './corpus-run/rendering-audit-settled-relation.ts';
export {
  readArchiveSubjects,
  readArtifactSubjects,
  type SettledArtifactReading,
  type SettledVerification,
} from './corpus-run/rendering-audit-settled-input.ts';
export {
  type PairingRecipe,
  type RebuiltPreparation,
  rebuildPreparation,
  type RecipeHalf,
  recipeOf,
} from './corpus-run/artifact-two-lane-rebuild.ts';
export {
  carveSettled,
  listSettledEntryIds,
  readSettledRecipe,
  recipeLabel,
  type SettledCarve,
  type SettledRecipe,
} from './corpus-run/settled-carve.ts';
export {
  identityOf,
  type SettledAuditSubject,
  type SettledIdentity,
  subjectsOf,
} from './corpus-run/rendering-audit-settled-subject.ts';
export {
  type AuditArguments,
  readAuditArguments,
  readReportArguments,
  type ReportArguments,
} from './corpus-run/rendering-audit-settled-args.ts';
export {
  printBand,
  printRelations,
  printRelocations,
  printSplit,
  printVoices,
} from './corpus-run/rendering-audit-settled-print.ts';

//endregion Audit barrel
