#!/usr/bin/env node

/**
 * CLI entry that launches visible child Pi sessions with spawn result state.
 *
 * @module
 */

import { spawn, } from 'node:child_process';
import { randomUUID, } from 'node:crypto';

import { object, } from '@optique/core/constructs';
import { message, } from '@optique/core/message';
import { optional, } from '@optique/core/modifiers';
import {
  argument,
  option,
} from '@optique/core/primitives';
import { string, } from '@optique/core/valueparser';
import { runSync, } from '@optique/run';

import {
  initialSpawnState,
  terminalInvocation,
} from './cli-core.ts';
import { SPAWN_ID_ENV, } from './constants.ts';
import {
  findCallingSession,
  SESSION_NOT_FOUND,
} from './session-finder.ts';
import { writeInitialSpawnState, } from './state.ts';

//region Parser

/**
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

//region Launch

/**
 * Resolved parent Pi session identity for this CLI invocation.
 */
const identity = findCallingSession();

if (identity === SESSION_NOT_FOUND) {
  console.error(
    'Error: Could not find calling Pi session. Ensure the spawn-pi extension is loaded in the parent Pi session.',
  );
  process.exitCode = 1;
}
else {
  /**
   * Unique identifier for this spawned child session.
   */
  const spawnId = randomUUID();
  /**
   * Working directory for child Pi process.
   */
  const cwd = args.cwd
    ?? process.cwd();
  /**
   * Initial state written before launching child terminal.
   */
  const state = initialSpawnState({
    spawnId,
    identity,
    cwd,
  },);

  writeInitialSpawnState({ state, },);

  /**
   * Terminal invocation arguments without parser-produced undefined slots.
   */
  const spawnArgs = args.extraArguments === undefined
    ? { prompt: args.prompt, }
    : {
      extraArguments: args.extraArguments,
      prompt: args.prompt,
    };

  /**
   * Terminal invocation used to open child Pi.
   */
  const invocation = terminalInvocation({
    spawnId,
    args: spawnArgs,
    identity,
  },);

  /**
   * Detached terminal-exec process for visible child Pi session.
   */
  const proc = spawn(
    invocation.command,
    invocation.args,
    {
      cwd,
      env: {
        ...process.env,
        [SPAWN_ID_ENV]: spawnId,
      },
      detached: true,
      stdio: 'ignore',
    },
  );

  proc.unref();

  console.log(JSON.stringify({ spawnId, },),);
}

//endregion Launch
