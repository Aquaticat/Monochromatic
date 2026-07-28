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
 * Parsed argument source record exposed by shared shell analyzer.
 */
type WordSource = CommandInfo['argSources'][number];

/**
 * Shell quote mode while scanning original word spelling.
 */
type QuoteMode = 'double' | 'none' | 'single';

/**
 * Unquoted characters that trigger pathname or brace expansion.
 */
const UNSAFE_UNQUOTED_CHARACTERS: ReadonlySet<string> = new Set([
  '*',
  '?',
  '[',
  '{',
  '}',
]);

/**
 * Extended-glob operator prefixes that become active before opening parenthesis.
 */
const EXTENDED_GLOB_PREFIXES: ReadonlySet<string> = new Set([
  '+',
  '@',
  '!',
]);

/**
 * Sentinel returned when inline option assignment separator is absent.
 */
const OPTION_ASSIGNMENT_NOT_FOUND = -1;

/**
 * Check original shell spelling has runtime expansion outside quotes.
 *
 * @param sourceText - exact shell word spelling
 *
 * @returns whether pathname, brace, tilde, or extended-glob expansion remains
 *
 * @example
 * ```typescript
 * sourceHasUnsafeExpansion('/repo/*');
 * ```
 */
function sourceHasUnsafeExpansion(
  sourceText: string,
): boolean {
  /**
   * Quote and escape state for one linear source scan.
   */
  const state: {
    escaped: boolean;
    quote: QuoteMode;
  } = {
    escaped: false,
    quote: 'none',
  };
  for (let index = 0; index < sourceText.length; index += 1) {
    /**
     * Current source character.
     */
    const character = sourceText.charAt(index,);
    if (state.escaped) {
      state.escaped = false;
      continue;
    }
    if (character === '\\') {
      state.escaped = true;
      continue;
    }
    if (state.quote === 'single') {
      if (character === "'")
        state.quote = 'none';
      continue;
    }
    if (state.quote === 'double') {
      if (character === '"')
        state.quote = 'none';
      continue;
    }
    if (character === "'") {
      state.quote = 'single';
      continue;
    }
    if (character === '"') {
      state.quote = 'double';
      continue;
    }
    if ((index === 0) && (character === '~'))
      return true;
    if (UNSAFE_UNQUOTED_CHARACTERS.has(character,))
      return true;
    if (EXTENDED_GLOB_PREFIXES.has(character,)
      && (sourceText.charAt(index + 1,) === '(')) {
      return true;
    }
  }
  return false;
}

/**
 * Check loop value has no expansion evaluated by shell at runtime.
 *
 * @param source - parsed value paired with original loop word spelling
 *
 * @returns whether value is literal enough for path proof
 *
 * @example
 * ```typescript
 * loopSourceIsLiteral({ value: '/repo', sourceText: '/repo' });
 * ```
 */
function loopSourceIsLiteral(
  source: WordSource,
): boolean {
  /**
   * Parsed value and exact shell spelling checked as one provenance fact.
   */
  const {
    sourceText,
    value,
  } = source;
  return (!value.includes('$',))
    && (!value.includes('`',))
    && (!value.startsWith('~',))
    && (!sourceHasUnsafeExpansion(sourceText,));
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
    const {
      sourceTexts,
      values,
    } = binding;
    if (values.length === 0)
      return UNPROVEN_WORD;
    if (sourceTexts.length !== values.length)
      return UNPROVEN_WORD;
    for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
      /**
       * Paired loop value and exact source spelling at current index.
       */
      const source = {
        value: values[valueIndex] ?? '',
        sourceText: sourceTexts[valueIndex] ?? '',
      };
      if (!loopSourceIsLiteral(source,))
        return UNPROVEN_WORD;
    }
    return values;
  }
  return UNPROVEN_WORD;
}

/**
 * Expand exact loop-variable shell word to finite literal values.
 *
 * Embedded, special, multiple, and unbound parameter expansions fail closed.
 *
 * @param source - parsed command value paired with original shell spelling
 *
 * @param command - command carrying lexical loop provenance
 *
 * @returns finite runtime values or fail-closed sentinel
 *
 * @example
 * ```typescript
 * provenWordValues({ source: { value: '$repo', sourceText: '"$repo"' }, command });
 * ```
 */
function provenWordValues(
  {
    source,
    command,
  }: {
    readonly source: WordSource;
    readonly command: CommandInfo;
  },
): ProvenWordValues {
  /**
   * Parsed value and original spelling used by expansion proof.
   */
  const {
    sourceText,
    value,
  } = source;
  /**
   * Named parameter references in shell word.
   */
  const references = extractParamRefs(value,);
  if (references.length === 0) {
    if (value.includes('$',) || value.includes('`',))
      return UNPROVEN_WORD;
    if (value.startsWith('~',))
      return UNPROVEN_WORD;
    if (sourceHasUnsafeExpansion(sourceText,))
      return UNPROVEN_WORD;
    return [value,];
  }
  if (references.length !== 1)
    return UNPROVEN_WORD;
  /**
   * Sole named reference eligible for exact quoted loop expansion.
   */
  const [name = '',] = references;
  if ((sourceText !== `"$${name}"`)
    && (sourceText !== `"\${${name}}"`)) {
    return UNPROVEN_WORD;
  }
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
  if (assignmentIndex !== OPTION_ASSIGNMENT_NOT_FOUND) {
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
  const wordSources: WordSource[] = [
    ...command.argSources,
    ...command.redirectTargetSources,
  ];
  for (const assignment of command.envAssignments) {
    wordSources[wordSources.length] = {
      value: assignment.value,
      sourceText: assignment.value,
    };
  }
  /**
   * Independent canonical path checks gathered before concurrent execution.
   */
  const pathSignalPromises: Promise<boolean>[] = [];
  for (const source of wordSources) {
    /**
     * Finite values after exact loop-variable expansion.
     */
    const values = provenWordValues({
      source,
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
