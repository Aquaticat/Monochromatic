/** Optique management-command parser and dispatcher. @module */
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

/** Sentinel returned when Optique renders help or a usage failure. */
const PARSE_STOPPED = Symbol('parse-stopped',);
/** Status command parser. */
const STATUS_PARSER = command('status', object({
  command: constant('status' as const,),
},), { description: 'Show built-in policy status.', },);
/** Built-in-only direct check parser. */
const CHECK_PARSER = command('check', object({
  command: constant('check' as const,),
  all: optional(flag('--all',),),
  policies: multiple(option('--policy', string(),),),
  pathspecs: multiple(argument(string(),),),
},), { description: 'Check selected paths with enabled built-in policies.', },);
/** First management grammar slice. */
const MANAGEMENT_PARSER = or(STATUS_PARSER, CHECK_PARSER,);

/**
 * Parses and runs one namespaced management command.
 *
 * @param args - arguments following `git cli-git`
 *
 * @returns settled cli-git exit code
 *
 * @example
 * ```ts
 * await runManagementCommand(['status']);
 * ```
 */
export async function runManagementCommand(args: readonly string[],): Promise<0 | 1 | 2> {
  const parsed = runParserSync(
    MANAGEMENT_PARSER,
    'git cli-git',
    args,
    {
      onError: function stopAfterUsageError() { return PARSE_STOPPED; },
      onHelp: function stopAfterHelp() { return PARSE_STOPPED; },
    },
  );
  if (parsed === PARSE_STOPPED)
    return 2;

  if (parsed.command === 'status') {
    console.log(JSON.stringify({
      schemaVersion: 1,
      type: 'status',
      policies: [{ id: 'require-root', severity: 'error', warnSafe: false, },],
    },),);
    return 0;
  }

  const separatorIndex = args.indexOf('--',);
  const hasPathspecScope = separatorIndex >= 0 && parsed.pathspecs.length > 0;
  const hasAllScope = parsed.all === true;
  if (hasAllScope === hasPathspecScope) {
    console.error('git cli-git check requires exactly one scope: --all or non-empty pathspecs after --.',);
    return 2;
  }
  if (separatorIndex < 0 && parsed.pathspecs.length > 0) {
    console.error('git cli-git check pathspecs must follow --.',);
    return 2;
  }

  const result = await runPolicyEngine({
    args,
    trigger: 'direct-check',
    selectedPolicyIds: parsed.policies,
  },);
  const renderedEvents = renderPolicyEvents(result.events,);
  if (renderedEvents !== '')
    process.stdout.write(renderedEvents,);
  return result.exitCode;
}
