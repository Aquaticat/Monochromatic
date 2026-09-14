/**
 Hard guard against caller-scoped ydotool keyboard injection.
 
 ydotool sends key-down and key-up as separate datagrams. A key-down that
 cancels its own Pi Bash caller can terminate ydotool before key-up, leaving
 the persistent virtual input device pressed until ydotoold restarts.
 
 @module
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
 Module logger for hard virtual-input decisions.
 */
const l = tagged({ tag: 'virtual-input-guard', },);

/**
 Executable name whose persistent virtual device can retain interrupted key presses.
 */
const YDOTOOL_COMMAND_NAME = 'ydotool';

/**
 Commands whose arguments are evidence or output text rather than executables.
 
 They keep source inspection such as `rg ydotool .` available while unknown
 wrappers fail closed when an argument names ydotool.
 */
const NON_EXECUTING_ARGUMENT_COMMANDS = new Set([
  'cat',
  'echo',
  'file',
  'git',
  'gh',
  'grep',
  'journalctl',
  'ls',
  'man',
  'printf',
  'readlink',
  'realpath',
  'rg',
  'rpm',
  'stat',
  'type',
  'whereis',
  'which',
],);

/**
 Commands whose `-c`-family option carries inline shell source.
 */
const INLINE_SOURCE_COMMANDS = new Set([
  'bash',
  'dash',
  'sh',
  'su',
  'zsh',
],);

/**
 Guidance returned when direct ydotool execution is blocked.
 */
const CALLER_SCOPED_YDOTOOL_REASON: string = [
  'Direct ydotool invocation is blocked because an injected key can cancel its own Bash caller before key-up.',
  'Use nested-wayland-session, or an independently supervised input broker after user authorization.',
].join(' ',);

/**
 Reduce command path to executable basename.
 
 @param name - Parsed shell command or forwarded executable name.
 
 @returns Executable basename used for exact policy matching.
 
 @example
 ```typescript
 executableName('/usr/bin/ydotool'); // 'ydotool'
 ```
 */
function executableName(name: string,): string {
  return basename(name,);
}

/**
 Test whether parsed word names ydotool executable.
 
 @param name - Parsed command or argument value.
 
 @returns Whether value resolves lexically to ydotool executable name.
 
 @example
 ```typescript
 namesYdotool('/usr/bin/ydotool'); // true
 ```
 */
function namesYdotool(name: string,): boolean {
  return executableName(name,)
    === YDOTOOL_COMMAND_NAME;
}

/**
 Test whether argument is an executable-shaped ydotool word.
 
 Environment assignments are data even when their value points at ydotool.
 
 @param argument - Parsed shell argument.
 
 @returns Whether argument can name ydotool executable.
 
 @example
 ```typescript
 argumentNamesYdotool('/usr/bin/ydotool'); // true
 ```
 */
function argumentNamesYdotool(argument: string,): boolean {
  if (argument.includes('=',))
    return false;
  return namesYdotool(argument,);
}

/**
 Test whether command treats executable-shaped arguments only as inspection data.
 
 @param command - Parsed simple shell command.
 
 @returns Whether ydotool-shaped arguments are non-executing for this command.
 
 @example
 ```typescript
 commandTreatsArgumentsAsData({ name: 'rg', args: ['ydotool'] } as CommandInfo);
 ```
 */
function commandTreatsArgumentsAsData(command: CommandInfo,): boolean {
  /**
   Executable basename used by inspection-command policy.
   */
  const name = executableName(command.name,);
  if (NON_EXECUTING_ARGUMENT_COMMANDS.has(name,))
    return true;
  if (name !== 'command')
    return false;
  return command
    .args
    .some(function isLookupFlag(argument,) {
      return (argument === '-v') || (argument === '-V');
    },);
}

/**
 Test whether command invokes ydotool in current caller lifecycle.
 
 Direct command names always block. Outside a narrow inspection allowlist,
 executable-shaped arguments block too, covering generic process wrappers.
 
 @param command - Parsed simple shell command.
 
 @returns Whether command can start ydotool under caller lifetime.
 
 @example
 ```typescript
 commandInvokesYdotool({ name: 'ydotool', args: [] } as CommandInfo); // true
 ```
 */
function commandInvokesYdotool(command: CommandInfo,): boolean {
  if (namesYdotool(command.name,))
    return true;
  if (commandTreatsArgumentsAsData(command,))
    return false;
  return command
    .args
    .some(argumentNamesYdotool,);
}

/**
 Minimal shell invocation view used while scanning wrapper argument tails.
 */
type ShellInvocation = {
  readonly name: string;
  readonly args: readonly string[];
};

/**
 Extract inline program from one `sh -c`-family invocation view.
 
 @param invocation - Candidate shell executable and following arguments.
 
 @returns Inline command strings requiring another parser pass.
 
 @example
 ```typescript
 inlineSourcesForInvocation({ name: 'sh', args: ['-c', 'ydotool key 1:1'] });
 ```
 */
function inlineSourcesForInvocation(
  invocation: ShellInvocation,
): readonly string[] {
  if (!INLINE_SOURCE_COMMANDS.has(executableName(invocation.name,),))
    return [];
  return invocation
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
       Inline shell program immediately following current command-string flag.
       */
      const source = invocation.args[index + 1];
      if (source === undefined)
        return [];
      return [source,];
    },);
}

/**
 Extract inline shell programs from direct or wrapper-nested shell invocations.
 
 @param command - Parsed simple shell command.
 
 @returns Inline program arguments requiring iterative shell analysis.
 
 @example
 ```typescript
 inlineShellSources({ name: 'sudo', args: ['sh', '-c', 'ydotool key 1:1'] } as CommandInfo);
 ```
 */
function inlineShellSources(command: CommandInfo,): readonly string[] {
  if (commandTreatsArgumentsAsData(command,))
    return [];
  /**
   Shell source concatenated by eval before execution.
   */
  const evalSources = executableName(command.name,) === 'eval'
    ? [command
      .args
      .join(' ',),]
    : [];
  /**
   Direct command followed by every argument-tail candidate for wrapped shell.
   */
  const invocationCandidates: readonly ShellInvocation[] = [
    {
      name: command.name,
      args: command.args,
    },
    ...command
      .args
      .map(function argumentTail(
        name,
        index,
      ) {
        return {
          name,
          args: command
            .args
            .slice(index + 1,),
        };
      },),
  ];
  return [
    ...evalSources,
    ...invocationCandidates
      .flatMap(inlineSourcesForInvocation,),
  ];
}

/**
 Detect caller-scoped ydotool execution in shell source.
 
 Nested `sh -c` programs enter a bounded work queue. Each nested source is a
 parsed argument from finite original input, so visited-source deduplication
 terminates without recursive string traversal.
 
 @param command - Bash tool command text.
 
 @returns Whether source invokes ydotool without independent supervision.
 
 @example
 ```typescript
 hasCallerScopedYdotool('bash -c "ydotool key 1:1 1:0"'); // true
 ```
 */
function hasCallerScopedYdotool(command: string,): boolean {
  /**
   Shell sources awaiting analysis, extended by inline interpreter arguments.
   */
  const pendingSources = [command,];
  /**
   Sources already analyzed, preventing duplicate nested work.
   */
  const visitedSources = new Set<string>();

  for (const source of pendingSources) {
    if (visitedSources.has(source,))
      continue;
    visitedSources.add(source,);
    /**
     Structured shell analysis for current source.
     */
    const analysis = analyzeBashCommand(source,);
    if (!analysis.parsed) {
      if (source.includes(YDOTOOL_COMMAND_NAME,))
        return true;
      continue;
    }
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
 Apply non-bypassable virtual-input safety policy to one tool call.
 
 Non-Bash calls and Bash commands that only mention ydotool as data are
 allowed. Caller-scoped ydotool execution is blocked before auto-mode bypass
 and judge paths.
 
 @param event - Pi tool call under preflight.
 
 @returns Hard block for caller-scoped ydotool, otherwise explicit allow.
 
 @example
 ```typescript
 guardVirtualInput({
   type: 'tool_call',
   toolName: 'bash',
   toolCallId: 'input-1',
   input: { command: 'ydotool key 1:1 1:0' },
 });
 ```
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
   Function-boundary logger for non-bypassable denial.
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
