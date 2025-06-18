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

import {
  cli,
  define,
} from '@kazupon/gunshi';
import spawn from 'nano-spawn';

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

    // ctx.rest contains arguments after --
    if (ctx.rest.length === 0) {
      throw new Error('Error: No command specified after --');
    }

    const [command, ...args] = ctx.rest;

    if (!command) {
      throw new Error('command not found!');
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
      if (error && typeof error === 'object' && 'exitCode' in error) {
        const subprocessError = error as {
          exitCode?: number;
          signalName?: string;
          message: string;
        };

        if (subprocessError.signalName) {
          console.error(`Command terminated by signal: ${subprocessError.signalName}`);
        }

        // Exit with 0 if allowFailure is true, otherwise use the command's exit code
        if (!allowFailure) {
          process.exit(subprocessError.exitCode ?? 1);
        }
        // If allowFailure is true, let script end naturally with exit code 0
      } else {
        console.error(
          `Failed to execute command: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (!allowFailure) {
          process.exit(1);
        }
        // If allowFailure is true, let script end naturally with exit code 0
      }
    }
  },
});

// Run the CLI
await cli(process.argv.slice(2), moonCommand);
