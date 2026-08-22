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

/**
 * Each rule on its own, so a rule's test exercises the shipped bundle.
 *
 * @internal
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
 * Whole-invocation entry the CLI runs, exported so its test drives the shipped
 * bundle rather than the module beside it.
 *
 * @internal
 */
export { run, } from './run.ts';

/**
 * Table rendering the pipe-table rule offers as its fix, exported so that
 * rule's test can compare against the same renderer the bundle carries.
 *
 * @internal
 */
export { toHtmlTable, } from './to-html-table.ts';

/**
 * Tree walk the rules share, exported so a test can find the nodes it means to
 * assert about without reimplementing the traversal.
 *
 * @internal
 */
export { walk, } from './walk.ts';
export type {
  Diagnostic,
  Fix,
  Rule,
  RuleContext,
} from './types.ts';
