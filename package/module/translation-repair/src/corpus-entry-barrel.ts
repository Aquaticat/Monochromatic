//region Corpus entry barrel

export {
  isStubMarkerParagraph,
  STUB_MARKER_TOKENS,
  type StrippedStubMarker,
  stripStubMarkers,
} from './corpus-run/archive-stub.ts';
export {
  type EntryErrorOutcome,
  entryErrorOutcome,
} from './corpus-run/entry-error-outcome.ts';
export { passArchiveText, } from './corpus-run/pass-archive.ts';
export type {
  CorpusPair,
  EntryOutcome,
} from './corpus-run/pass-entry-contract.ts';
export { settleEntry, } from './corpus-run/pass-entry.ts';

//endregion Corpus entry barrel
