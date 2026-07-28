/**
 * Expansion provenance and path-scope proof for read-only Bash commands.
 *
 * @module
 */

import {
  extractParamRefs,
  looksLikePath,
} from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';

import { pathSignals, } from './path-signals.ts';
import type {
  CommandInfo,
  SignalContext,
} from './types.ts';

/**
 * Sentinel for shell word whose runtime values cannot be proven.
 */
const UNPROVEN_WORD: unique symbol = Symbol('read-only Bash word value is unproven',);

/**
 * Expanded shell word values or fail-closed sentinel.
 */
type ProvenWordValues = readonly string[] | typeof UNPROVEN_WORD;

/**
 * Check loop value has no expansion or glob evaluated by shell at runtime.
 *
 * @param value - parsed loop word
 *
 * @returns whether value is literal enough for path proof
 *
 * @example
 * ```typescript
 * loopValueIsLiteral('/repo');
 * ```
 */
function loopValueIsLiteral(
  value: string,
): boolean {
  return (!value.includes('$',))
    && (!value.includes('`',))
    && (!value.includes('*',))
    && (!value.includes('?',))
    && (!value.includes('[',));
}

/**
 * Resolve innermost lexical loop binding for variable name.
 *
 * @param command - body command carrying enclosing loop contexts
 *
 * @param name - referenced shell variable
 *
 * @returns literal binding values or fail-closed sentinel
 *
 * @example
 * ```typescript
 * loopBindingValues({ command, name: 'repo' });
 * ```
 */
function loopBindingValues(
  {
    command,
    name,
  }: {
    readonly command: CommandInfo;
    readonly name: string;
  },
): ProvenWordValues {
  /**
   * Lexical loop bindings copied from command context.
   */
  const { loopBindings, } = command.context;
  for (let index = loopBindings.length - 1; index >= 0; index -= 1) {
    /**
     * Possible innermost matching loop binding.
     */
    const binding = loopBindings[index];
    if ((binding === undefined) || (binding.name !== name))
      continue;
    /**
     * Literal values attached to matched lexical binding.
     */
    const { values, } = binding;
    if (values.length === 0)
      return UNPROVEN_WORD;
    if (!values.every(loopValueIsLiteral,))
      return UNPROVEN_WORD;
    return values;
  }
  return UNPROVEN_WORD;
}

/**
 * Expand exact loop-variable shell word to finite literal values.
 *
 * Embedded, special, multiple, and unbound parameter expansions fail closed.
 *
 * @param word - parsed command word
 *
 * @param command - command carrying lexical loop provenance
 *
 * @returns finite runtime values or fail-closed sentinel
 *
 * @example
 * ```typescript
 * provenWordValues({ word: '$repo', command });
 * ```
 */
function provenWordValues(
  {
    word,
    command,
  }: {
    readonly word: string;
    readonly command: CommandInfo;
  },
): ProvenWordValues {
  /**
   * Named parameter references in shell word.
   */
  const references = extractParamRefs(word,);
  if (references.length === 0) {
    if (word.includes('$',) || word.includes('`',))
      return UNPROVEN_WORD;
    return [word,];
  }
  if (references.length !== 1)
    return UNPROVEN_WORD;
  /**
   * Sole named reference eligible for exact loop expansion.
   */
  const [name = '',] = references;
  if ((word !== `$${name}`) && (word !== `\${${name}}`))
    return UNPROVEN_WORD;
  return loopBindingValues({
    command,
    name,
  },);
}

/**
 * Extract path-shaped token and inline option value candidates.
 *
 * @param value - one proven command word value
 *
 * @returns path strings requiring canonical scope checks
 *
 * @example
 * ```typescript
 * pathCandidates('--ignore-file=/repo/ignore');
 * ```
 */
function pathCandidates(
  value: string,
): readonly string[] {
  /**
   * Candidate path spellings before de-duplication.
   */
  const candidates = looksLikePath(value,)
    ? [value,]
    : [];
  /**
   * Inline long-option assignment separator.
   */
  const assignmentIndex = value.indexOf('=',);
  if (assignmentIndex !== -1) {
    /**
     * Value after option assignment.
     */
    const assignedValue = value.slice(assignmentIndex + 1,);
    if (looksLikePath(assignedValue,))
      candidates.push(assignedValue,);
  }
  return [...new Set(candidates,),];
}

/**
 * Check command words have proven expansions and canonically allowed paths.
 *
 * @param command - parsed read-only command
 *
 * @param ctx - Pi cwd and account home
 *
 * @param trustedAgentTempDirs - canonical private scratch roots
 *
 * @returns whether every command word preserves read scope
 *
 * @example
 * ```typescript
 * await commandWordsStayInReadScope({ command, ctx, trustedAgentTempDirs });
 * ```
 */
async function commandWordsStayInReadScope(
  {
    command,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly command: CommandInfo;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  /**
   * Arguments, assignment values, and file redirects that can carry paths.
   */
  const words: string[] = [
    ...command.args,
    ...command.redirectTargets,
  ];
  for (const assignment of command.envAssignments)
    words[words.length] = assignment.value;
  /**
   * Independent canonical path checks gathered before concurrent execution.
   */
  const pathSignalPromises: Promise<boolean>[] = [];
  for (const word of words) {
    /**
     * Finite values after exact loop-variable expansion.
     */
    const values = provenWordValues({
      word,
      command,
    },);
    if (values === UNPROVEN_WORD)
      return false;
    for (const value of values) {
      for (const filePath of pathCandidates(value,)) {
        pathSignalPromises[pathSignalPromises.length] = pathSignals({
          filePath,
          ctx,
          allowlistedDirs: trustedAgentTempDirs,
        },);
      }
    }
  }
  /**
   * Whether any path escaped read scope or matched secret-path policy.
   */
  const pathSignalDecisions = await Promise.all(pathSignalPromises,);
  return !pathSignalDecisions.some(function hasPathSignal(decision,): boolean {
    return decision;
  },);
}

export { commandWordsStayInReadScope, };
