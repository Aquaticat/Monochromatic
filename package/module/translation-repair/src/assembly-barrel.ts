//region Assembly barrel
// Everything that reasons about the WHOLE assembled document rather than about
// one slice of it.
//
// Split out of `pipeline-barrel.ts` when the repetition check pushed that file
// past its line budget. Grouping by scale rather than by stage is what makes it
// a barrel rather than a spill: an invariant over the change sets, a footnote
// guard over the finished text, and a repetition check against the archive all
// answer questions no per-slice stage can.

export {
  AssemblyContractError,
  assertReplacementsChange,
  deriveShippedIndices,
  type OrderedChangeSets,
  orderedChangeSets,
} from './assembly-invariant.ts';
export {
  guardFootnoteAssembly,
  type GuardedAssembly,
  introducedFootnoteFindings,
  introducedStructuralRegressions,
} from './assembly-integrity.ts';
export {
  type ContentSurvival,
  contentSurvivalFindings,
  distinctiveWords,
  measureContentSurvival,
} from './assembly-content-survival.ts';
export {
  type AdjacentRepetition,
  adjacentRepetitionFindings,
  type AdjacentSliceText,
  findAdjacentRepetitions,
} from './assembly-adjacent-repetition.ts';
// `wordsOf` and `countPhrases` are exported from their own module so the
// adjacency check can share them, and deliberately NOT re-exported here: they
// are shared internals, not public API, and a barrel is what decides which.
export {
  findIntroducedRepetitions,
  repetitionFindings,
  type RepetitionFinding,
} from './assembly-repetition.ts';

//endregion Assembly barrel
