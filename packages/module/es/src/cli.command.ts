#!/usr/bin/env bun

/**
 * Command executor wrapper for Moon tasks.
 *
 * This script works around Moon's limitation where tasks with `allowFailure: true`
 * can't be dependencies (error: task_builder::dependency::no_allowed_failures).
 *
 * By wrapping commands in this executor, we can control exit codes while still
 * showing all output and errors to the user.
 *
 * Usage:
 *   bun moon.command.ts --allowFailure -- eslint --cache  # Always exits with 0
 *   bun moon.command.ts -- eslint --cache                 # Exits with command's exit code
 *
 * The `--` separator is required to distinguish script args from command args.
 */

import { outdent } from '@cspotcode/outdent';
import {
  cli,
  define,
} from '@kazupon/gunshi';
import spawn from 'nano-spawn';
import { match } from 'ts-pattern';
import { unary } from './function.nary.ts';
import { arrayIsNonEmpty } from './iterable.is';

// Define the command with gunshi using define for type safety
const moonCommand = define({
  name: 'moon-command',
  description: 'Command executor wrapper for Moon tasks',
  args: {
    allowFailure: {
      type: 'boolean',
      short: 'a',
      description: 'Exit with 0 even if command fails',
    },
    shell: {
      type: 'boolean',
      short: 's',
      description: 'Execute command through shell',
    },
  },
  examples: `# Always exit with 0
$ bun moon.command.ts --allowFailure -- eslint --cache

# Exit with command's exit code
$ bun moon.command.ts -- eslint --cache

# Execute through shell
$ bun moon.command.ts --shell -- "echo hello && echo world"`,
  run: async (ctx) => {
    const { allowFailure, shell } = ctx.values;

    // ctx.rest or ctx._ contains arguments after --
    const gunshiRestArgsArray = [ctx.rest, ctx._].find(unary(arrayIsNonEmpty));

    if (!gunshiRestArgsArray) {
      throw new Error(
        outdent`
          No command specified after --
          ${JSON.stringify(ctx, null, 2)}
        `,
      );
    }

    const [command, ...args] = gunshiRestArgsArray;

    if (!command) {
      throw new Error(outdent`
        command not found!
        ${gunshiRestArgsArray}
      `);
    }

    try {
      // Execute the command with nano-spawn
      await spawn(command, args, {
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
        shell,
      });

      // Script ends naturally with exit code 0
    } catch (error) {
      // nano-spawn throws SubprocessError when the process fails
      match(error)
        .when(
          (
            error,
          ): error is { exitCode?: number; signalName?: string; message: string; } =>
            error !== null && typeof error === 'object' && 'exitCode' in error,
          (subprocessError) => {
            match(subprocessError.signalName)
              .when(
                (signal): signal is string => signal !== undefined,
                (signal) => {
                  console.error(`Command terminated by signal: ${signal}`);
                },
              );

            // Exit with 0 if allowFailure is true, otherwise use the command's exit code
            match(allowFailure)
              .with(false, () => {
                process.exitCode = subprocessError.exitCode ?? 1;
              })
              .with(true, () => {
                // Let script end naturally with exit code 0
              });
          },
        )
        .otherwise(() => {
          console.error(
            `Failed to execute command: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          match(allowFailure)
            .with(false, () => {
              throw error;
            })
            .with(true, () => {
              // Let script end naturally with exit code 0
            });
        });
    }
  },
});

// Run the CLI
await cli(process.argv.slice(2), moonCommand);
