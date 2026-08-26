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
  type AssemblyContractFault,
  assemblySentence,
  type ChangeSetName,
} from './assembly-contract-fault.ts';
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
// SHARED INTERNALS ARE EXPORTED AND MARKED, rather than withheld. Keeping them
// out of the barrel made them unreachable from a test that imports the built
// bundle the way every other test here does, which bought nothing: it did not
// stop a consumer depending on them, it only stopped this package proving they
// work. `@internal` says what withholding was trying to say, and says it where
// a reader of the declaration will see it.
export {
  countPhrases,
  findIntroducedRepetitions,
  repetitionFindings,
  type RepetitionFinding,
  wordsOf,
} from './assembly-repetition.ts';
export {
  countSpan,
  type GrownSpan,
  grownSpans,
  indexWindows,
  type WindowIndex,
} from './assembly-repetition-span.ts';

//endregion Assembly barrel
