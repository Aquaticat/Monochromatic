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
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- latched mid-iteration after seeing `--`; pulling into reduce hurts readability without changing behaviour */
  /**
   * Latch flipped on `--`; subsequent args are treated as positional and ignored by the matcher.
   */
  let pastEndOfOptions = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  return args.some(
    function checkArg(a,) {
      if (pastEndOfOptions)
        return false;
      if (a === '--') {
        pastEndOfOptions = true;
        return false;
      }
      if (!a.startsWith('-',))
        return false;
      if (a.startsWith('--',)) {
        return flags.some(
          function matchLongFlag(f,) {
            return a === `--${LONG_FLAGS[f]
              ?? f}`;
          },
        );
      }
      return flags.some(
        function matchShortFlag(f,) {
          return a.includes(f,);
        },
      );
    },
  );
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
  return flags.some(
    function flagPresent(f,) {
      return args.includes(f,);
    },
  );
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
  return analysis.commands
    .some(
    function isNetworkCmd(c,) {
      return NETWORK_COMMANDS.has(c.name,);
    },
  );
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
  return analysis.allParamRefs
    .some(
    function isSecretRef(ref,) {
      return SECRET_VAR_PATTERN.test(ref,);
    },
  );
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
   * Path signal decisions for all file-like arguments and redirect targets.
   */
  const signalDecisions = await Promise.all(
    analysis
      .allFiles
      .map(function fileHasPathSignal(f,) {
        return pathSignals({
          filePath: f,
          ctx,
        },);
      },),
  );
  return signalDecisions.some(Boolean,);
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
