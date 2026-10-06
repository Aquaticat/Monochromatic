//region Corpus entry barrel

export {
  isStubMarkerParagraph,
  STUB_MARKER_TOKENS,
  type StrippedStubMarker,
  stripStubMarkersWithOrigins,
} from './corpus-run/archive-stub.ts';
export {
  type EntryErrorOutcome,
  entryErrorOutcome,
} from './corpus-run/entry-error-outcome.ts';
export {
  passArchiveText,
  passArchiveWithOrigins,
} from './corpus-run/pass-archive.ts';
export type {
  CorpusPair,
  EntryOutcome,
} from './corpus-run/pass-entry-contract.ts';
export { settleEntry, } from './corpus-run/pass-entry.ts';
export {
  entryArchiveOriginalOf,
  recordEntryDecline,
  removeDeclinedPages,
} from './corpus-run/pass-decline.ts';
export {
  DECLINED_DIR,
  DeclinedEntriesUnreadableError,
  type DeclinedEntryRecord,
  type DeclineReason,
  declinedEntryIds,
  writeDeclinedEntry,
} from './corpus-run/declined-entries.ts';
export {
  entriesFinishedThisRun,
  finishedEntryIds,
} from './corpus-run/pass-finished.ts';
export {
  isSliceFileName,
  openNamespacedCache,
} from './corpus-run/slice-cache-namespace.ts';
export { verifyArtifactMeasurements, } from './corpus-run/artifact-two-lane-corpus-verify.ts';
export { resolveGit, } from './corpus-run/git-command.ts';
export { corpusGitEnvironment, } from './corpus-git-context.ts';
export {
  type HostIdentity,
  hostIdentity,
  type HostRead,
  type StartTicksRead,
  startTicksOf,
  startTicksOfStat,
} from './corpus-run/process-identity.ts';
export {
  type AgreementSource,
  type EntryAgreement,
  type PageAgreement,
  pageAgreement,
} from './corpus-run/page-agreement.ts';
export {
  type CorpusPairReader,
  type CorpusPairText,
  type RepublishOutcome,
  type RepublishRow,
  republishSettledPages,
} from './corpus-run/page-republish.ts';
export {
  archiveKeptDefects,
  defectsLine,
  type PublishCheck,
  type PublishCheckStep,
  type PublishDefect,
  publishDefects,
} from './corpus-run/publish-defects.ts';
export {
  prepareRunsLayout,
  PROMPT_PAYLOADS_DIR,
  type RunsLayout,
  SLICE_CACHE_DIR,
} from './corpus-run/runs-layout.ts';
export {
  type DirectoryReading,
  type EntryKind,
  filesystemReason,
  namesIn,
  namesOfKind,
  presentNamesOfKind,
  readingOf,
} from './corpus-run/directory-listing.ts';

//endregion Corpus entry barrel
