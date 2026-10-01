//region Cache account barrel
// The pure readers behind the pre-launch cache version check (ledger M28),
// exported so each is tested where it is defined; the entry that asks git is
// `corpus-run/cache-account-audit.ts`.

export {
  CacheAccountLogError,
  type SettingCandidate,
  settingCommit,
  type SettingReading,
  type SourceCommit,
  sourceCommitOf,
  type UnaccountedCommit,
  unaccountedCommits,
  utcMinutes,
  type VersionSetting,
} from './corpus-run/cache-account-commits.ts';
export {
  CacheAccountReadError,
  type CacheVersion,
  cacheVersionsIn,
  citedHash,
  CITED_HASH_LENGTH,
  declarationLineCounts,
} from './corpus-run/cache-account-read.ts';
export {
  type NewestSliceRecord,
  type RunsDirSearch,
  runsDirsIn,
  runsDirsUnder,
  type SliceCacheAccount,
  sliceCacheAccount,
  type SliceRecord,
  type UnlistedDir,
} from './corpus-run/cache-account-slices.ts';

//endregion Cache account barrel
