export {
  applyFixes,
  fixSource,
} from './fix.ts';
export { runRules, } from './lint.ts';
/**
 Whole-invocation and stdin entry points used by the CLI and built-artifact consumers.
 */
export {
  run,
  type RunParams,
  type RunResult,
  runStdin,
  type RunStdinParams,
  type RunStdinResult,
  StdinPathError,
} from './run.ts';
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

/**
 Each rule on its own, so a rule's test exercises the shipped bundle.
 
 @internal
 */
export {
  commandsShowOutput,
  fencedCodeLanguage,
  headingIncrement,
  linkImageStyle,
  noBareUrls,
  noDuplicateHeading,
  noEmphasisAsHeading,
  noPipeTables,
  noTrailingPunctuation,
  referenceDefinitions,
  semanticLineBreaks,
  singleH1,
} from './rule/index.ts';

/**
 Table rendering the pipe-table rule offers as its fix, exported so that
 rule's test can compare against the same renderer the bundle carries.
 
 @internal
 */
export { toHtmlTable, } from './to-html-table.ts';

/**
 Tree walk the rules share, exported so a test can find the nodes it means to
 assert about without reimplementing the traversal.
 
 @internal
 */
export { walk, } from './walk.ts';
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
  type FindLfsRepoRootParams,
  findLfsRepoRoot,
  type LfsImageContext,
  type LfsImageRepo,
  type LfsImageTarget,
  prepareLfsImageContext,
} from './lfs-image-context.ts';
/**
 Re-exported so built-artifact tests build an in-memory filesystem whose
 types match the bundled copy of the root-discovery contract.

 @internal
 */
export { createMemoryRootFilesystem, } from '@monochromatic-dev/module-fs-path/ts';
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
