//region Present-tense barrel
// Everything the tense candidates are made of and shown with: the detector and
// the readings it stands on, the block a judging sheet carries, the finding a
// contest slice records, and the entry's `info.yml` reader the death fact comes
// from.
//
// Split out of `index.ts` when that file reached its line budget, on the
// audience ground the other barrels used: these symbols answer one question,
// "which sentences of a memorial page may be told in the present tense", and
// `index.ts` composes the barrel, so nothing importing the package sees the seam.

export {
  presentTenseCandidates,
  type PresentTenseCandidate,
  type PresentTenseRule,
} from './present-tense-candidates.ts';
export {
  maskQuotedSpeech,
  sentenceSpans,
  type SentenceSpan,
  visibleWords,
} from './present-tense-text.ts';
export {
  isBlankSpan,
  isSEndingWord,
  isWhitespace,
  namesAt,
  wordAfterSpace,
  wordsOf,
  type WordToken,
} from './present-tense-words.ts';
export {
  tenseCandidateGroups,
  tenseCandidateLines,
  type TenseCandidateGroup,
  type TenseCandidateSource,
} from './tense-candidate-block.ts';
export {
  laneContestTenseGroups,
  withTenseCandidates,
} from './lane-contest-tense.ts';
export { declaredSubjectNames, } from './subject-names.ts';
export { withShippedTenseCandidates, } from './consolidate-shipped-tense.ts';
export {
  preparedSheetFactsOf,
  type PreparedSheetFacts,
} from './prepared-sheet-facts.ts';
export {
  type EntryInfoRecord,
  readEntryInfoRecord,
} from './corpus-run/entry-info-record.ts';

//endregion Present-tense barrel
