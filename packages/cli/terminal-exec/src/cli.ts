/**
 * Parses CLI arguments for `xdg-terminal-exec`.
 * Supports `--app-id=VALUE`, `--title=VALUE`, `--dir=VALUE`, `--hold`,
 * and `--` or `-e` to delimit the command to execute.
 *
 * @module
 */

import type { UserOptions, } from './build-command.ts';
import {
  l as parentLogger,
  tagged,
} from './log.ts';

/** Tagged logger for this module. */
const l = tagged({ tag: 'cli', l: parentLogger, },);

/**
 * Parses process arguments into structured user options.
 * Arguments before `--` or `-e` are xdg-terminal-exec options;
 * arguments after are the command to execute in the terminal.
 *
 * @param argv - Raw process arguments (excluding `bun` and script path).
 *
 * @returns Parsed user options.
 *
 * @example
 * ```ts
 * parseArgs({ argv: ['--title=My Shell', '--', 'bash', '-l'] })
 * // { title: 'My Shell', command: ['bash', '-l'], appId: '', dir: '', hold: false }
 * ```
 */
export function parseArgs({ argv, }: { argv: readonly string[]; },): UserOptions {
  let appId = '';
  let title = '';
  let dir = '';
  let hold = false;
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === undefined)
      break;

    if (arg === '--' || arg === '-e') {
      l.debug(`found delimiter '${arg}'`,);
      i++;
      break;
    }

    if (arg.startsWith('--app-id=',)) {
      appId = arg.slice('--app-id='.length,);
      l.debug(`app-id='${appId}'`,);
      i++;
      continue;
    }

    if (arg.startsWith('--title=',)) {
      title = arg.slice('--title='.length,);
      l.debug(`title='${title}'`,);
      i++;
      continue;
    }

    if (arg.startsWith('--dir=',)) {
      dir = arg.slice('--dir='.length,);
      l.debug(`dir='${dir}'`,);
      i++;
      continue;
    }

    if (arg === '--hold') {
      hold = true;
      l.debug('hold=true',);
      i++;
      continue;
    }

    if (arg.startsWith('-',)) {
      l.debug(`ignoring unknown option '${arg}'`,);
      i++;
      continue;
    }

    /** First non-option argument starts the command. */
    l.debug(`found non-option '${arg}', treating as command start`,);
    break;
  }

  const command = argv.slice(i,);

  l.debug(
    `parsed: appId='${appId}', title='${title}', dir='${dir}', hold=${
      String(hold,)
    }, command=${JSON.stringify(command,)}`,
  );
  return { appId, title, dir, hold, command, };
}
