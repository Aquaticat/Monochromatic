#!/usr/bin/env bun

/**
 * Cross-platform terminal emulator launcher.
 *
 * On Linux/FreeBSD, resolves via XDG Desktop Entry Specification
 * with a KDE `kdeglobals` fallback when no `xdg-terminals.list` is configured.
 * On Windows, checks for Windows Terminal (`wt.exe`) then falls back to `cmd.exe`.
 *
 * @example
 * ```sh
 * terminal-exec bash -l
 * terminal-exec --title="My Shell" --dir=/tmp; bash
 * ```
 *
 * @module
 */

import { buildCommand, } from './build-command.ts';
import { parseArgs, } from './cli.ts';
import { execvp, } from './exec.ts';
import { l, } from './log.ts';
import { resolveTerminal, } from './resolve.ts';

/** Parsed CLI options from process arguments. */
const options = parseArgs({ argv: process.argv
  .slice(2,), },);
/** Resolved terminal emulator entry, or `null` if none found. */
const terminal = await resolveTerminal();

if (terminal === null) {
  console.error('terminal-exec: no terminal emulator found',);
  throw new Error(
    process.platform
      === 'win32'
      ? 'No terminal emulator found.'
      : 'No terminal emulator found. Install a terminal emulator or configure one in ~/.config/xdg-terminals.list',
  );
}

l.info(`resolved terminal: ${terminal.entryId}`,);

/** Final command array built from resolved terminal and user options. */
const command = buildCommand({
  terminal,
  options,
},);

/**
 * If `--dir` was provided but the terminal has no dir argument support,
 * change the working directory before exec.
 */
if ((options.dir
  .length
  > 0) && (terminal.dirArg
  .length
  === 0)) {
  l.info(`terminal has no TerminalArgDir, cd to '${options.dir}'`,);
  process.chdir(options.dir,);
}

execvp({ command, },);
