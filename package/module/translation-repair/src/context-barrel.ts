//region Context barrel
// The document-level context a sheet is handed beside the passages: the notes
// an entry carries and the web lookups of the works it names.
//
// Split from `pipeline-barrel.ts` because that file sits at its line budget,
// and because these are context sources rather than stages.

export {
  commentBody,
  commentNoteLines,
  entryNoteLines,
  foldedLine,
  footnoteNoteLines,
  type NoteSide,
} from './entry-notes.ts';
export {
  type CachedLookup,
  isLookupHit,
  isLookupRecord,
  LOOKUP_CACHE_DIR_VAR,
  lookupCacheDir,
  lookupCachePath,
  type LookupHit,
  type LookupRecord,
  readCachedLookup,
  writeCachedLookup,
} from './lookup-cache.ts';
export {
  lookupQueryFor,
  workTitlesOf,
} from './work-title-scan.ts';
export {
  EXA_API_KEY_VAR,
  EXA_SEARCH_URL,
  HIGHLIGHT_CHARACTERS,
  hitsOf,
  RESULTS_PER_TITLE,
  searchWorkTitle,
  WorkTitleLookupError,
} from './work-title-search.ts';
export {
  lookupLinesOf,
  lookupWorkTitle,
  workTitleLookupLines,
} from './work-title-lookup.ts';

//endregion Context barrel
