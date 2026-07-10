/**
 * Optique management-command parser and dispatcher. @module
 */
import {
  argument,
  command,
  constant,
  flag,
  multiple,
  object,
  option,
  optional,
  or,
  runParserSync,
  string,
} from '@optique/core';
import { renderPolicyEvents, } from './policy-engine/events.ts';
import { runPolicyEngine, } from './policy-engine/engine.ts';

/**
 * Sentinel returned when Optique renders help or a usage failure.
 */
const PARSE_STOPPED = Symbol('Optique management parsing stopped',);
/**
 * Status command parser.
 */
const STATUS_PARSER = command(
  'status',
  object({
  command: constant('status' as const,),
},),
);
/**
 * Built-in-only direct check parser.
 */
const CHECK_PARSER = command(
  'check',
  object({
  command: constant('check' as const,),
  all: optional(flag('--all',),),
  policies: multiple(option(
    '--policy',
    string(),
  ),),
  pathspecs: multiple(
    argument(string(),),
  ),
},),
);
/**
 * First management grammar slice.
 */
const MANAGEMENT_PARSER = or(
  STATUS_PARSER,
  CHECK_PARSER,
);

/**
 * Parses and runs one namespaced management command.
 *
 * @param args - arguments following `git cli-git`
 *
 * @param gitGlobalArgs - arguments preceding `cli-git`
 *
 * @returns settled cli-git exit code
 *
 * @example
 * ```ts
 * await runManagementCommand({ args: ['status'], gitGlobalArgs: [] });
 * ```
 */
export async function runManagementCommand({
  args,
  gitGlobalArgs,
}: Readonly<{
  args: readonly string[];
  gitGlobalArgs: readonly string[];
}>,): Promise<0 | 1 | 2> {
  /**
   * Parsed management action or parse-stop sentinel.
   */
  const parsed: unknown = runParserSync(
    MANAGEMENT_PARSER,
    'git cli-git',
    args,
    {
      onError: function stopAfterUsageError() { return PARSE_STOPPED; },
    },
  );
  if (parsed === PARSE_STOPPED)
    return 2;

  if (((typeof parsed) !== 'object') || (parsed === null)
    || (!('command' in parsed)))
    return 2;
  if (parsed.command === 'status') {
    console.log(JSON.stringify({
      schemaVersion: 1,
      type: 'status',
      policies: [{
        id: 'require-root',
        severity: 'error',
        warnSafe: false,
      },],
    },),);
    return 0;
  }

  if ((parsed.command !== 'check')
    || (!('pathspecs' in parsed))
    || (!Array.isArray(parsed.pathspecs,))
    || (!('policies' in parsed))
    || (!Array.isArray(parsed.policies,)))
    return 2;
  /**
   * Position of required pathspec separator.
   */
  const separatorIndex = args.indexOf('--',);
  /**
   * Whether invocation selected non-empty pathspec scope.
   */
  const hasPathspecScope = (separatorIndex !== (-1)) && (parsed.pathspecs
    .length
    > 0);
  /**
   * Whether invocation selected complete repository scope.
   */
  const hasAllScope = ('all' in parsed) && (parsed.all === true);
  if (hasAllScope === hasPathspecScope) {
    console.error('git cli-git check requires exactly one scope: --all or non-empty pathspecs after --.',);
    return 2;
  }
  if ((separatorIndex === (-1)) && (parsed.pathspecs
    .length
    > 0)) {
    console.error('git cli-git check pathspecs must follow --.',);
    return 2;
  }

  /**
   * Built-in direct-check decision.
   */
  const result = await runPolicyEngine({
    args: gitGlobalArgs,
    trigger: 'direct-check',
    selectedPolicyIds: parsed.policies
      .filter(function isString(value,): value is string {
      return (typeof value) === 'string';
    },),
  },);
  /**
   * Stable direct-command JSONL.
   */
  const renderedEvents = renderPolicyEvents(result.events,);
  if (renderedEvents !== '')
    process.stdout
      .write(renderedEvents,);
  return result.exitCode;
}
