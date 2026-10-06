//region Cache account barrel
// The readers, the git questions, the printer and the run behind the
// pre-launch cache version check (ledger M28), exported so each is tested
// where it is defined; the command is `corpus-run/cache-account-audit.ts`.

export {
  cacheAccountCommitsOf,
  cacheAccountGitOutput,
} from './corpus-run/cache-account-git.ts';
export { printCacheAudit, } from './corpus-run/cache-account-print.ts';
export { auditCacheAccounts, } from './corpus-run/cache-account-run.ts';
export { cacheVersionSetting, } from './corpus-run/cache-account-setting.ts';
export { reportSliceCaches, } from './corpus-run/cache-account-slice-report.ts';
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
