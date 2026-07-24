#!/usr/bin/env node

/**
 * CLI entry that launches visible child Pi sessions with spawn result state.
 *
 * @module
 */

import { spawn, } from 'node:child_process';
import { randomUUID, } from 'node:crypto';

// TODO: deprecate Optique
import { object, } from '@optique/core/constructs';
// TODO: deprecate Optique
import { message, } from '@optique/core/message';
// TODO: deprecate Optique
import { optional, } from '@optique/core/modifiers';
// TODO: deprecate Optique
import {
  argument,
  option,
} from '@optique/core/primitives';
// TODO: deprecate Optique
import { string, } from '@optique/core/valueparser';
// TODO: deprecate Optique
import { runSync, } from '@optique/run';

import {
  initialSpawnState,
  SESSION_NOT_FOUND_WARNING,
  type SpawnPiArgs,
  terminalInvocation,
  type TerminalInvocation,
} from './cli-core.ts';
import { SPAWN_ID_ENV, } from './constants.ts';
import {
  findCallingSession,
  SESSION_NOT_FOUND,
} from './session-finder.ts';
import { writeInitialSpawnState, } from './state.ts';

//region Parser

/**
 * TODO: deprecate Optique
 * Optique parser for spawn-pi command line.
 *
 * @example
 * ```typescript
 * spawn-pi "implement feature X"
 * spawn-pi --cwd /repo --extra-arguments "--model openai/gpt-4.1" "review code"
 * ```
 */
const parser = object({
  cwd: optional(option(
    '--cwd',
    string({ metavar: 'DIR', },),
    {
      description: message`Working directory for the child Pi session. Defaults to current directory.`,
    },
  ),),
  extraArguments: optional(option(
    '--extra-arguments',
    string({ metavar: 'ARGS', },),
    {
      description:
        message`Additional CLI arguments passed directly to the pi command, split on whitespace like spawn-claude.`,
    },
  ),),
  prompt: argument(
    string({ metavar: 'PROMPT', },),
    {
      description: message`Initial prompt for spawned Pi session.`,
    },
  ),
},);

/**
 * TODO: deprecate Optique
 * Parsed CLI arguments from current process invocation.
 */
const args = runSync(
  parser,
  {
    programName: 'spawn-pi',
    help: 'option',
    brief: message`Spawn a visible child Pi session and forward its first result back to the parent Pi session.`,
  },
);

//endregion Parser

//region Launch helpers

/**
 * Launches terminal-exec as a detached visible child process.
 *
 * @param options - Working directory, environment, and terminal invocation.
 *
 * @example
 * ```typescript
 * launchDetachedTerminal({ cwd: '/repo', env: process.env, invocation });
 * ```
 */
function launchDetachedTerminal(
  options: {
    readonly cwd: string;
    readonly env: Readonly<NodeJS.ProcessEnv>;
    readonly invocation: TerminalInvocation;
  },
): void {
  /**
   * Launch values extracted after naming native process boundary.
   */
  const {
    cwd,
    env,
    invocation,
  } = options;
  /**
   * Detached terminal-exec process for visible child Pi session.
   */
  const proc = spawn(
    invocation.command,
    invocation.args,
    {
      cwd,
      env: { ...env, },
      detached: true,
      stdio: 'ignore',
    },
  );

  proc.unref();
}

/**
 * Builds spawn-pi argument object without parser-produced undefined slots.
 *
 * @param extraArguments - optional extra Pi CLI arguments.
 *
 * @param prompt - initial prompt for spawned Pi.
 *
 * @returns normalized {@link SpawnPiArgs}.
 *
 * @example
 * ```typescript
 * spawnPiArgs({ prompt: 'work' });
 * ```
 */
function spawnPiArgs(
  {
    extraArguments,
    prompt,
  }: {
    readonly extraArguments?: string;
    readonly prompt: string;
  },
): SpawnPiArgs {
  return extraArguments === undefined
    ? { prompt, }
    : {
      extraArguments,
      prompt,
    };
}

//endregion Launch helpers

//region Launch

/**
 * Working directory for child Pi process.
 */
const cwd = args.cwd
  ?? process.cwd();

/**
 * Terminal invocation arguments without parser-produced undefined slots.
 */
const spawnArgs = args.extraArguments === undefined
  ? spawnPiArgs({ prompt: args.prompt, },)
  : spawnPiArgs({
    extraArguments: args.extraArguments,
    prompt: args.prompt,
  },);

/**
 * Resolved parent Pi session identity for this CLI invocation.
 */
const identity = await findCallingSession();

if (identity === SESSION_NOT_FOUND) {
  console.error(SESSION_NOT_FOUND_WARNING,);

  /**
   * Terminal invocation used to open an unlinked child Pi.
   */
  const invocation = terminalInvocation({ args: spawnArgs, },);

  launchDetachedTerminal({
    cwd,
    env: process.env,
    invocation,
  },);

  console.log(JSON.stringify({ resultForwarding: false, },),);
}
else {
  /**
   * Unique identifier for this spawned child session.
   */
  const spawnId = randomUUID();
  /**
   * Initial state written before launching child terminal.
   */
  const state = initialSpawnState({
    spawnId,
    identity,
    cwd,
  },);

  await writeInitialSpawnState({ state, },);

  /**
   * Terminal invocation used to open child Pi.
   */
  const invocation = terminalInvocation({
    spawnId,
    args: spawnArgs,
    identity,
  },);

  launchDetachedTerminal({
    cwd,
    env: {
      ...process.env,
      [SPAWN_ID_ENV]: spawnId,
    },
    invocation,
  },);

  console.log(JSON.stringify({ spawnId, },),);
}

//endregion Launch
