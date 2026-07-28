/**
 * Shared shell-command analyzer exports.
 *
 * @module
 */

export { analyzeShellCommand, } from './analyzer.ts';
export {
  BUN_TEST_BAN_REASON,
  invokesBunTest,
} from './bun-test.ts';
export {
  extractParamRefs,
  looksLikePath,
} from './refs.ts';
export type {
  ShellCommandAnalysis,
  ShellCommandContext,
  ShellCommandInfo,
  ShellEnvAssignment,
  ShellLoopBinding,
  ShellParseError,
  ShellRedirect,
  ShellRedirectKind,
} from './types.ts';
