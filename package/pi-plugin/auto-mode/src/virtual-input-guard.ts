/**
 * Hard guard against caller-scoped ydotool keyboard injection.
 *
 * ydotool sends key-down and key-up as separate datagrams. A key-down that
 * cancels its own Pi Bash caller can terminate ydotool before key-up, leaving
 * the persistent virtual input device pressed until ydotoold restarts.
 *
 * @module
 */

import { basename, } from 'node:path';

import type { ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { analyzeBashCommand, } from './command-parser.ts';
import { isBashToolEvent, } from './tool-event.ts';
import type {
  CommandInfo,
  GuardDecision,
} from './types.ts';

/**
 * Module logger for hard virtual-input decisions.
 */
const l = tagged({ tag: 'virtual-input-guard', },);

/**
 * Executable name whose persistent virtual device can retain interrupted key presses.
 */
const YDOTOOL_COMMAND_NAME = 'ydotool';

/**
 * Command wrappers that execute a following executable from agent-authored shell source.
 *
 * Durable input brokers expose a narrow API and own key release internally;
 * forwarding ydotool through a generic process launcher is not that boundary.
 */
const CALLER_SCOPED_COMMAND_FORWARDERS = new Set([
  'command',
  'doas',
  'env',
  'exec',
  'nohup',
  'setsid',
  'sudo',
  'systemd-run',
],);

/**
 * Shell interpreters whose inline command source needs another parser pass.
 */
const INLINE_SHELL_INTERPRETERS = new Set([
  'bash',
  'dash',
  'sh',
  'zsh',
],);

/**
 * Guidance returned when direct ydotool execution is blocked.
 */
const CALLER_SCOPED_YDOTOOL_REASON: string = [
  'Direct ydotool invocation is blocked because an injected key can cancel its own Bash caller before key-up.',
  'Use nested-wayland-session, or an independently supervised input broker after user authorization.',
].join(' ',);

/**
 * Reduce command path to executable basename.
 *
 * @param name - Parsed shell command or forwarded executable name.
 *
 * @returns Executable basename used for exact policy matching.
 *
 * @example
 * ```typescript
 * executableName('/usr/bin/ydotool'); // 'ydotool'
 * ```
 */
function executableName(name: string,): string {
  return basename(name,);
}

/**
 * Test whether parsed word names ydotool executable.
 *
 * @param name - Parsed command or argument value.
 *
 * @returns Whether value resolves lexically to ydotool executable name.
 *
 * @example
 * ```typescript
 * namesYdotool('/usr/bin/ydotool'); // true
 * ```
 */
function namesYdotool(name: string,): boolean {
  return executableName(name,)
    === YDOTOOL_COMMAND_NAME;
}

/**
 * Test whether command invokes ydotool in current caller lifecycle.
 *
 * Direct executable names and generic forwarding wrappers are covered.
 * A release-completing broker uses its own narrow API rather than exposing ydotool.
 *
 * @param command - Parsed simple shell command.
 *
 * @returns Whether command can start ydotool under caller lifetime.
 *
 * @example
 * ```typescript
 * commandInvokesYdotool({ name: 'ydotool', args: [] } as CommandInfo); // true
 * ```
 */
function commandInvokesYdotool(command: CommandInfo,): boolean {
  if (namesYdotool(command.name,))
    return true;
  if (!CALLER_SCOPED_COMMAND_FORWARDERS.has(executableName(command.name,),))
    return false;
  return command
    .args
    .some(namesYdotool,);
}

/**
 * Extract inline shell programs from `sh -c`-family commands.
 *
 * @param command - Parsed simple shell command.
 *
 * @returns Inline program arguments requiring recursive shell analysis.
 *
 * @example
 * ```typescript
 * inlineShellSources({ name: 'sh', args: ['-c', 'ydotool key 1:1'] } as CommandInfo);
 * ```
 */
function inlineShellSources(command: CommandInfo,): readonly string[] {
  if (!INLINE_SHELL_INTERPRETERS.has(executableName(command.name,),))
    return [];
  return command
    .args
    .flatMap(function sourceAfterCommandFlag(
      argument,
      index,
    ) {
      if (!argument.startsWith('-',))
        return [];
      if (!argument
        .slice(1,)
        .includes('c',)) {
        return [];
      }
      /**
       * Inline shell program immediately following current command-string flag.
       */
      const source = command.args[index + 1];
      if (source === undefined)
        return [];
      return [source,];
    },);
}

/**
 * Detect caller-scoped ydotool execution in shell source.
 *
 * Nested `sh -c` programs enter a bounded work queue. Each nested source is a
 * parsed argument from finite original input, so visited-source deduplication
 * terminates without recursive string traversal.
 *
 * @param command - Bash tool command text.
 *
 * @returns Whether source invokes ydotool without independent supervision.
 *
 * @example
 * ```typescript
 * hasCallerScopedYdotool('bash -c "ydotool key 1:1 1:0"'); // true
 * ```
 */
function hasCallerScopedYdotool(command: string,): boolean {
  /**
   * Shell sources awaiting analysis, extended by inline interpreter arguments.
   */
  const pendingSources = [command,];
  /**
   * Sources already analyzed, preventing duplicate nested work.
   */
  const visitedSources = new Set<string>();

  for (const source of pendingSources) {
    if (visitedSources.has(source,))
      continue;
    visitedSources.add(source,);
    /**
     * Structured shell analysis for current source.
     */
    const analysis = analyzeBashCommand(source,);
    if (!analysis.parsed)
      continue;
    if (analysis
      .commands
      .some(commandInvokesYdotool,)) {
      return true;
    }
    for (const parsedCommand of analysis.commands) {
      pendingSources.push(...inlineShellSources(parsedCommand,));
    }
  }
  return false;
}

/**
 * Apply non-bypassable virtual-input safety policy to one tool call.
 *
 * Non-Bash calls and Bash commands that only mention ydotool as data are
 * allowed. Caller-scoped ydotool execution is blocked before auto-mode bypass
 * and judge paths.
 *
 * @param event - Pi tool call under preflight.
 *
 * @returns Hard block for caller-scoped ydotool, otherwise explicit allow.
 *
 * @example
 * ```typescript
 * guardVirtualInput({
 *   type: 'tool_call',
 *   toolName: 'bash',
 *   toolCallId: 'input-1',
 *   input: { command: 'ydotool key 1:1 1:0' },
 * });
 * ```
 */
function guardVirtualInput(
  event: ForeignBorrowed<ToolCallEvent>,
): GuardDecision {
  if (!isBashToolEvent(event,))
    return { block: false, };
  if (!hasCallerScopedYdotool(
    event.input
      .command,
  )) {
    return { block: false, };
  }
  /**
   * Function-boundary logger for non-bypassable denial.
   */
  const innerL = tagged({
    tag: guardVirtualInput.name,
    l,
  },);
  innerL.warn('blocking caller-scoped ydotool command',);
  return {
    block: true,
    reason: CALLER_SCOPED_YDOTOOL_REASON,
  };
}

export {
  CALLER_SCOPED_YDOTOOL_REASON,
  guardVirtualInput,
  hasCallerScopedYdotool,
};
