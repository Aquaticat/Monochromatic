#!/usr/bin/env bun

/**
 * XDG terminal emulator launcher with KDE `kdeglobals` fallback.
 *
 * Replaces the reference POSIX shell implementation of `xdg-terminal-exec`
 * with a TypeScript version that additionally consults KDE's `TerminalService`
 * setting when no `xdg-terminals.list` config file specifies a terminal.
 *
 * @example
 * ```sh
 * xdg-terminal-exec bash -l
 * xdg-terminal-exec --title="My Shell" --dir=/tmp -- bash
 * ```
 *
 * @module
 */

import { execvp } from './exec.ts';
import { buildCommand } from './build-command.ts';
import { parseArgs } from './cli.ts';
import { l } from './log.ts';
import { resolveTerminal } from './resolve.ts';

const options = parseArgs({ argv: process.argv.slice(2) });
const terminal = await resolveTerminal();

if (terminal === null) {
  console.error('xdg-terminal-exec: no terminal emulator found');
  process.exitCode = 1;
  throw new Error('No terminal emulator found. Install a terminal emulator or configure one in ~/.config/xdg-terminals.list');
}

l.info(`resolved terminal: ${terminal.entryId}`);

const command = buildCommand({ terminal, options });

/**
 * If `--dir` was provided but the terminal has no `X-TerminalArgDir`,
 * change the working directory before exec.
 */
if (options.dir.length > 0 && terminal.dirArg.length === 0) {
  l.info(`terminal has no TerminalArgDir, cd to '${options.dir}'`);
  process.chdir(options.dir);
}

execvp({ command });
