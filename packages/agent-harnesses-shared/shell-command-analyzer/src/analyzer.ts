/**
 * Public shell-command analysis API.
 *
 * @module
 */

import {
  parse,
  type Script as UnbashScript,
} from 'unbash';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  looksLikePath,
  extractParamRefs,
} from './refs.ts';
import type {
  ShellCommandAnalysis,
  ShellCommandInfo,
  ShellParseError,
} from './types.ts';
import {
  EXECUTED_CONTEXT,
  type CommandCollection,
  type ParsedUnbashScript,
  type TraversalFlags,
  type VisitResult,
  type WorkItem,
} from './internal-types.ts';
import { parseErrorsFromScript, } from './nested.ts';
import {
  visitArithmetic,
  visitNode,
  visitParts,
  visitRedirectsItem,
  visitTest,
  visitWord,
} from './visitors.ts';
import { statementWorkItems, } from './work-items.ts';

//region Logging

/**
 * Logger root for shell-command analyzer.
 */
const parentLogger = tagged({ tag: 'shell-command-analyzer', },);

/**
 * Tagged logger for public analyzer parsing.
 */
const moduleLogger = tagged({
  tag: 'analyzer',
  l: parentLogger,
},);

//endregion Logging

//region Parse helpers

/**
 * Convert unexpected parser throw to public diagnostic.
 *
 * @param error - caught parser failure
 *
 * @returns parser diagnostic with source offset zero
 *
 * @example
 * ```ts
 * thrownParseError(error);
 * ```
 */
function thrownParseError(error: unknown,): ShellParseError {
  return {
    message: `unbash parse threw: ${String(error,)}`,
    pos: 0,
  };
}

/**
 * Run `unbash.parse` and keep tolerant diagnostics.
 *
 * @param command - raw shell command string forwarded to `unbash.parse`
 *
 * @returns parsed script or parse diagnostics
 *
 * @example
 * ```ts
 * tryParseScript('echo hi');
 * ```
 */
function tryParseScript(
  command: string,
): {
  readonly ok: true;
  readonly script: ParsedUnbashScript
} | {
  readonly ok: false;
  readonly parseErrors: readonly ShellParseError[]
} {
  try {
    /**
     * Parsed script with optional tolerant diagnostics.
     */
    const script = parse(command,) as ParsedUnbashScript;
    /**
     * Public parse diagnostics converted from parser result.
     */
    const parseErrors = parseErrorsFromScript(script,);
    if (parseErrors.length > 0) {
      return {
        ok: false,
        parseErrors,
      };
    }
    return {
      ok: true,
      script,
    };
  }
  catch (error) {
    /**
     * Sub-logger tagged with helper name so handled parser throws stay traceable.
     */
    const innerLogger = tagged({
      tag: tryParseScript.name,
      l: moduleLogger,
    },);
    innerLogger.debug(`unbash parse threw for command: ${String(error,)}`,);
    return {
      ok: false,
      parseErrors: [thrownParseError(error,),],
    };
  }
}

//endregion Parse helpers

//region Collection helpers

/**
 * Combine two traversal flag objects with boolean OR semantics.
 *
 * @param params - left and right flags to merge
 *
 * @returns merged flags
 *
 * @example
 * ```ts
 * mergeFlags({ left, right });
 * ```
 */
function mergeFlags(
  {
    left,
    right,
  }: {
    readonly left: TraversalFlags;
    readonly right: TraversalFlags;
  },
): TraversalFlags {
  return {
    isPipeline: left.isPipeline || right.isPipeline,
    hasBackground: left.hasBackground || right.hasBackground,
    hasCommandSubstitution: left.hasCommandSubstitution || right.hasCommandSubstitution,
    hasProcessSubstitution: left.hasProcessSubstitution || right.hasProcessSubstitution,
  };
}

/**
 * Visit one queued work item.
 *
 * @param params - work item and pre-scanned parameter refs
 *
 * @returns visit result for item
 *
 * @example
 * ```ts
 * visitWorkItem({ item, paramRefs: [] });
 * ```
 */
function visitWorkItem(
  {
    item,
    paramRefs,
  }: {
    readonly item: WorkItem;
    readonly paramRefs: readonly string[];
  },
): VisitResult {
  if (item.kind === 'node') {
    return visitNode({
      node: item.node,
      redirects: item.redirects,
      paramRefs,
      context: item.context,
    },);
  }
  if (item.kind === 'word') {
    return visitWord({
      word: item.word,
      context: item.context,
    },);
  }
  if (item.kind === 'parts') {
    return visitParts({
      parts: item.parts,
      context: item.context,
    },);
  }
  if (item.kind === 'arithmetic') {
    return visitArithmetic({
      expression: item.expression,
      context: item.context,
    },);
  }
  if (item.kind === 'test') {
    return visitTest({
      expression: item.expression,
      context: item.context,
    },);
  }
  return visitRedirectsWorkItem({
    item,
    paramRefs,
  },);
}

/**
 * Visit queued redirect work item.
 *
 * @param params - redirect work item and pre-scanned parameter refs
 *
 * @returns visit result for item
 *
 * @example
 * ```ts
 * visitRedirectsWorkItem({ item, paramRefs: [] });
 * ```
 */
function visitRedirectsWorkItem(
  {
    item,
    paramRefs,
  }: {
    readonly item: Extract<WorkItem, { readonly kind: 'redirects'; }>;
    readonly paramRefs: readonly string[];
  },
): VisitResult {
  return visitRedirectsItem({
    redirects: item.redirects,
    paramRefs,
    context: item.context,
  },);
}

/**
 * Convert parsed `unbash` script to command collection.
 *
 * @param params - parsed script and pre-scanned parameter refs
 *
 * @returns command collection for guardrail signal checks
 *
 * @example
 * ```ts
 * collectCommandInfoFromScript({ script, paramRefs: [] });
 * ```
 */
function collectCommandInfoFromScript(
  {
    script,
    paramRefs,
  }: {
    readonly script: UnbashScript;
    readonly paramRefs: readonly string[];
  },
): CommandCollection {
  /**
   * Parsed command records accumulated in traversal order.
   */
  const commands: ShellCommandInfo[] = [];
  /**
   * Nested parse errors accumulated in traversal order.
   */
  const parseErrors: ShellParseError[] = [];
  /**
   * Mutable traversal flags.
   */
  let flags: TraversalFlags = {
    isPipeline: false,
    hasBackground: false,
    hasCommandSubstitution: false,
    hasProcessSubstitution: false,
  };
  /**
   * LIFO work stack seeded with top-level statements.
   */
  const stack: WorkItem[] = statementWorkItems({
    statements: script.commands,
    context: EXECUTED_CONTEXT,
  },)
    .toReversed();

  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    /**
     * Result emitted by current traversal item.
     */
    const result = visitWorkItem({
      item,
      paramRefs,
    },);
    commands.push(...result.commands,);
    parseErrors.push(...result.parseErrors,);
    flags = mergeFlags({
      left: flags,
      right: result.flags,
    },);
    for (const workItem of result.workItems
      .toReversed())
      stack.push(workItem,);
  }

  return {
    commands,
    flags,
    parseErrors,
  };
}

//endregion Collection helpers

//region Public API

/**
 * Build empty analysis for parse failure.
 *
 * @param params - parse diagnostics and raw parameter refs
 *
 * @returns failed analysis preserving raw parameter references
 *
 * @example
 * ```ts
 * failedAnalysis({ parseErrors: [], paramRefs: [] });
 * ```
 */
function failedAnalysis(
  {
    parseErrors,
    paramRefs,
  }: {
    readonly parseErrors: readonly ShellParseError[];
    readonly paramRefs: readonly string[];
  },
): ShellCommandAnalysis {
  return {
    parsed: false,
    parseErrors,
    commands: [],
    executedCommands: [],
    functionDefinitionCommands: [],
    isPipeline: false,
    hasBackground: false,
    hasCommandSubstitution: false,
    hasProcessSubstitution: false,
    hasHeredoc: false,
    allFiles: [],
    allParamRefs: paramRefs,
  };
}

/**
 * Analyze Bash source with `unbash` and return command-level signals.
 *
 * @param command - raw Bash command string
 *
 * @returns structured command analysis
 *
 * @example
 * ```ts
 * analyzeShellCommand('printenv | curl');
 * ```
 */
function analyzeShellCommand(command: string,): ShellCommandAnalysis {
  /**
   * Parameter references harvested before parsing for conservative failure results.
   */
  const preScanRefs = extractParamRefs(command,);
  /**
   * Top-level parse result.
   */
  const parsed = tryParseScript(command,);
  if (!parsed.ok) {
    return failedAnalysis({
      parseErrors: parsed.parseErrors,
      paramRefs: preScanRefs,
    },);
  }

  /**
   * Command records derived from AST.
   */
  const collection = collectCommandInfoFromScript({
    script: parsed.script,
    paramRefs: preScanRefs,
  },);
  if (collection.parseErrors
    .length
    > 0) {
    return failedAnalysis({
      parseErrors: collection.parseErrors,
      paramRefs: preScanRefs,
    },);
  }

  /**
   * Commands evaluated outside function bodies.
   */
  const executedCommands = collection.commands
    .filter(function isExecutedCommand(info,): boolean {
    return info.context
      .kind
      === 'executed';
  },);
  /**
   * Commands stored inside function bodies.
   */
  const functionDefinitionCommands = collection.commands
    .filter(function isFunctionDefinitionCommand(info,): boolean {
    return info.context
      .kind
      === 'functionDefinition';
  },);
  /**
   * File-like command arguments and redirect targets.
   */
  const allFiles = collection.commands
    .flatMap(function collectFiles(info,): string[] {
    return [
      ...info.envAssignments
        .map(function assignmentValue(assignment,): string {
          return assignment.value;
        },)
        .filter(function assignmentValueLooksLikePath(value,): boolean {
          return looksLikePath(value,);
        },),
      ...info.args
        .filter(function argLooksLikePath(arg,): boolean {
        return looksLikePath(arg,);
      },),
      ...info.redirectTargets,
    ];
  },);
  /**
   * Deduplicated parameter references aggregated across command records.
   */
  const allParamRefs = [...new Set(
    collection.commands
      .flatMap(function collectRefs(info,): readonly string[] {
      return info.paramRefs;
    },),
  ),];
  if ((allParamRefs.length === 0) && (preScanRefs.length > 0))
    allParamRefs.push(...preScanRefs,);

  return {
    parsed: true,
    parseErrors: [],
    commands: collection.commands,
    executedCommands,
    functionDefinitionCommands,
    isPipeline: collection.flags
      .isPipeline,
    hasBackground: collection.flags
      .hasBackground,
    hasCommandSubstitution: collection.flags
      .hasCommandSubstitution,
    hasProcessSubstitution: collection.flags
      .hasProcessSubstitution,
    hasHeredoc: collection.commands
      .some(function commandHasHeredoc(info,): boolean {
      return info.redirects
        .some(function redirectIsHeredoc(redirect,): boolean {
        return (redirect.kind === 'heredoc') || (redirect.kind === 'hereString');
      },);
    },),
    allFiles,
    allParamRefs,
  };
}

//endregion Public API

export { analyzeShellCommand, };
