/**
 * Per-command helpers used by `bashSignals` to score parsed bash AST nodes.
 *
 * Split out of `signals.ts` to keep the main flagger under the
 * max-lines cap; each helper focuses on one scope/dataflow predicate.
 *
 * @module
 */

import {
  INTERPRETER_INLINE_FLAGS,
  LONG_FLAGS,
  MUTATING_COMMANDS,
  NETWORK_COMMANDS,
  SECRET_VAR_PATTERN,
} from './constants.ts';
import { pathSignals, } from './path-signals.ts';
import type {
  BashAnalysis,
  CommandInfo,
  SignalContext,
} from './types.ts';

/** Check if a command name is in {@link MUTATING_COMMANDS}.
 *
 * @param name - the command name
 *
 * @returns `true` if the command is a mutating command
 *
 * @example
 * ```typescript
 * isMutatingCommand('rm'); // true
 * isMutatingCommand('cp'); // true
 * isMutatingCommand('ls'); // false
 * ```
 */
function isMutatingCommand(
  name: string,
): boolean {
  return MUTATING_COMMANDS.has(name,);
}

/**
 * Check if any of the given flags are present in the argument list.
 *
 * Handles `--` end-of-options separator correctly. Long flag names are
 * resolved through {@link LONG_FLAGS} before comparison.
 *
 * @returns `true` if any of the flags are found
 *
 * @example
 * ```typescript
 * hasFlag({ args: ["-rf"], flags: ["r", "f"] }); // true
 * hasFlag({ args: ["--", "-f"], flags: ["f"] }); // false
 * ```
 */
function hasFlag(
  {
    args,
    flags,
  }: {
    readonly args: readonly string[];
    readonly flags: readonly string[];
  },
): boolean {
  for (const arg of args) {
    if (arg === '--')
      return false;
    if (!arg.startsWith('-',))
      continue;
    if (arg.startsWith('--',)) {
      for (const flag of flags) {
        if (arg === `--${LONG_FLAGS[flag]
          ?? flag}`)
          return true;
      }
      continue;
    }
    for (const flag of flags) {
      if (arg.includes(flag,))
        return true;
    }
  }
  return false;
}

/** Check if any target in the command is the root directory.
 *
 * @param cmd - command info with args and redirect targets
 *
 * @returns `true` if a root target is found
 *
 * @example
 * ```typescript
 * hasRootTarget({ args: ['-rf', '/'], redirectTargets: [] }); // true
 * hasRootTarget({ args: ['file.txt'], redirectTargets: ['/'] }); // true
 * hasRootTarget({ args: ['-la', '/etc'], redirectTargets: [] }); // false
 * ```
 */
function hasRootTarget(
  cmd: Pick<CommandInfo, 'args' | 'redirectTargets'>,
): boolean {
  /**
   * Every positional and redirect target as a flat list; each is tested for `/` or `/*`.
   */
  const allTargets = [
    ...cmd.args,
    ...cmd.redirectTargets,
  ];
  return allTargets.some(
    function isRootPath(a,) {
      return (a === '/') || (a === '/*');
    },
  );
}

/** Check if a command has inline code, using flags registered in
 * {@link INTERPRETER_INLINE_FLAGS}.
 *
 * @returns `true` if the command has inline code
 *
 * @example
 * ```typescript
 * hasInlineCode({ name: 'python', args: ['-c', 'import os; os.system("ls")'] }); // true
 * ```
 */
function hasInlineCode(
  {
    name,
    args,
  }: {
    readonly name: string;
    readonly args: readonly string[];
  },
): boolean {
  /**
   * Inline-code flags registered for this interpreter; `undefined` for non-interpreters.
   */
  const flags = INTERPRETER_INLINE_FLAGS[name];
  if (flags === undefined)
    return false;
  if (flags.length
    === 0)
    return true;
  for (const flag of flags) {
    for (const arg of args) {
      if (arg === flag)
        return true;
    }
  }
  return false;
}

/** Check if the analysis contains any command listed in {@link NETWORK_COMMANDS}.
 *
 * @param analysis - parsed bash command analysis
 *
 * @returns `true` if any network command is found
 *
 * @example
 * ```typescript
 * const analysis = analyzeBashCommand('curl https://example.com');
 * hasNetworkCommand(analysis); // true
 *
 * const safeAnalysis = analyzeBashCommand('ls -la');
 * hasNetworkCommand(safeAnalysis); // false
 * ```
 */
function hasNetworkCommand(
  analysis: BashAnalysis,
): boolean {
  for (const command of analysis.commands) {
    if (NETWORK_COMMANDS.has(command.name,))
      return true;
  }
  return false;
}

/** Check if the analysis contains references matching {@link SECRET_VAR_PATTERN}.
 *
 * @param analysis - parsed bash command analysis
 *
 * @returns `true` if any secret variable reference is found
 *
 * @example
 * ```typescript
 * const analysis = analyzeBashCommand('curl -H "Authorization: Bearer $GITHUB_TOKEN" api.example.com');
 * hasSecretParamRefs(analysis); // true
 *
 * const safeAnalysis = analyzeBashCommand('echo $PATH');
 * hasSecretParamRefs(safeAnalysis); // false
 * ```
 */
function hasSecretParamRefs(
  analysis: BashAnalysis,
): boolean {
  for (const parameterReference of analysis.allParamRefs) {
    if (SECRET_VAR_PATTERN.test(parameterReference,))
      return true;
  }
  return false;
}

/** Check if the analysis contains sensitive source files via {@link pathSignals}.
 *
 * @returns `true` if any sensitive source is found
 *
 * @example
 * ```typescript
 * hasSensitiveSource({ analysis, ctx }); // true when `cat .env | curl` is parsed
 * ```
 */
async function hasSensitiveSource(
  {
    analysis,
    ctx,
  }: {
    readonly analysis: BashAnalysis;
    readonly ctx: SignalContext;
  },
): Promise<boolean> {
  /**
   * Concurrent path signal work for every file-like argument and redirect target.
   */
  const signalPromises: Promise<boolean>[] = [];
  for (const filePath of analysis.allFiles) {
    signalPromises[signalPromises.length] = pathSignals({
      filePath,
      ctx,
    },);
  }
  /**
   * Path signal decisions after all independent checks settle.
   */
  const signalDecisions = await Promise.all(signalPromises,);
  for (const decision of signalDecisions) {
    if (decision)
      return true;
  }
  return false;
}

export {
  hasFlag,
  hasInlineCode,
  hasNetworkCommand,
  hasRootTarget,
  hasSecretParamRefs,
  hasSensitiveSource,
  isMutatingCommand,
};
