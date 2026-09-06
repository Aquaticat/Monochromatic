export {
  applyFixes,
  fixSource,
} from './fix.ts';
export { runRules, } from './lint.ts';
export { parse, } from './parse.ts';
export {
  report,
  type FileReport,
  type ReporterName,
} from './reporters.ts';
export {
  rules,
  rulesById,
} from './rule/index.ts';
export type {
  Diagnostic,
  Fix,
  Rule,
  RuleContext,
} from './types.ts';

//region LFS helpers
// Building blocks of the lfs-image-url rule, exported so unit tests exercise
// them through the built artifact. Internal: not part of the documented API.
/**
 @internal
 */
export {
  lfsObjectBase,
  parseLfsConfig,
  readLfsObjectBase,
} from './lfs-config.ts';
/**
 @internal
 */
export {
  discoverLfsImageRepo,
  type LfsImageContext,
  type LfsImageRepo,
  type LfsImageTarget,
  prepareLfsImageContext,
} from './lfs-image-context.ts';
/**
 @internal
 */
export {
  candidateTargetPaths,
  isRelativePath,
  objectUrlParts,
  relativeTargetPath,
} from './lfs-image-target.ts';
/**
 @internal
 */
export {
  isLfsOid,
  lfsOidOfFile,
} from './lfs-oid.ts';
/**
 @internal
 */
export { lfsTrackedMatcher, } from './lfs-tracked.ts';
/**
 @internal
 */
export { repoRelative, } from './repo-relative.ts';
//endregion LFS helpers
