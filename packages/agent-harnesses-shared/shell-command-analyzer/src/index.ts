/**
 * Shared shell-command analyzer exports.
 *
 * @module
 */

export { analyzeShellCommand, } from './analyzer.ts';
export {
  extractParamRefs,
  looksLikePath,
} from './refs.ts';
export type {
  ShellCommandAnalysis,
  ShellCommandContext,
  ShellCommandInfo,
  ShellEnvAssignment,
  ShellParseError,
  ShellRedirect,
  ShellRedirectKind,
} from './types.ts';
