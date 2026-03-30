/**
 * Constructs the final command array from a resolved terminal entry and user-provided options.
 * Handles the trailing-`=` concatenation convention for terminal argument keys.
 *
 * @module
 */

import {
  l as parentLogger,
  tagged,
} from './log.ts';
import type { ResolvedTerminal, } from './resolve.ts';

/** Tagged logger for this module. */
const l = tagged({
  tag: 'build-command',
  l: parentLogger,
},);

/**
 * Options passed by the user to `xdg-terminal-exec`.
 */
export type UserOptions = {
  /** Value for `--app-id=VALUE`. */
  readonly appId: string;
  /** Value for `--title=VALUE`. */
  readonly title: string;
  /** Value for `--dir=VALUE`. */
  readonly dir: string;
  /** Whether `--hold` was passed. */
  readonly hold: boolean;
  /** Command and arguments to execute in the terminal. */
  readonly command: readonly string[];
};

/**
 * Appends a terminal argument using the trailing-`=` convention.
 * If the arg key ends with `=`, the value is concatenated as one argument (`--title=My Title`).
 * Otherwise, two separate arguments are added (`--title` `My Title`).
 *
 * @param args - Mutable argument array to append to.
 *
 * @param argKey - Terminal argument key (e.g. `--title=` or `--title`).
 *
 * @param value - User-provided value.
 */
function appendArg(
  {
    args,
    argKey,
    value,
  }: {
    args: string[];
    argKey: string;
    value: string;
  },
): void {
  if (argKey.endsWith('=',))
    args.push(`${argKey}${value}`,);
  else {
    args.push(
      argKey,
      value,
    );
  }
}

/**
 * Tokens to strip from Exec lines because they interfere with programmatic launches.
 * Single-instance flags cause IPC activation to an existing process, which may not
 * forward `--working-directory` or other config overrides to the running instance.
 */
const STRIPPED_TOKEN_PREFIXES: readonly string[] = [
  '--gtk-single-instance',
];

/**
 * Returns `true` when a token should be kept (not stripped).
 *
 * @param token - single exec token to check
 *
 * @returns whether to keep the token
 */
function keepToken(token: string,): boolean {
  return STRIPPED_TOKEN_PREFIXES.every(function notMatch(prefix,) {
    return !token.startsWith(prefix,);
  },);
}

/**
 * Builds the final command array from a resolved terminal and user options.
 *
 * Strips single-instance flags from the Exec tokens because they cause IPC
 * activation to a running instance, which does not reliably forward config
 * overrides like `--working-directory`.
 *
 * @param terminal - Resolved terminal entry with Exec tokens and argument keys.
 *
 * @param options - User-provided options from CLI parsing.
 *
 * @returns Complete command array ready for `exec`.
 *
 * @example
 * ```ts
 * const cmd = buildCommand({
 *   terminal: { execTokens: ['/usr/bin/ghostty'], execArg: '-e', ... },
 *   options: { command: ['bash', '-l'], appId: '', title: '', dir: '', hold: false },
 * })
 * // ['/usr/bin/ghostty', '-e', 'bash', '-l']
 * ```
 */
export function buildCommand({
  terminal,
  options,
}: {
  terminal: ResolvedTerminal;
  options: UserOptions;
},): readonly string[] {
  const args: string[] = terminal.execTokens.filter(keepToken,);

  if (options.appId.length > 0 && terminal.appIdArg.length > 0) {
    appendArg({
      args,
      argKey: terminal.appIdArg,
      value: options.appId,
    },);
  }

  if (options.title.length > 0 && terminal.titleArg.length > 0) {
    appendArg({
      args,
      argKey: terminal.titleArg,
      value: options.title,
    },);
  }

  if (options.dir.length > 0 && terminal.dirArg.length > 0) {
    appendArg({
      args,
      argKey: terminal.dirArg,
      value: options.dir,
    },);
  }

  if (options.hold && terminal.holdArg.length > 0)
    args.push(terminal.holdArg,);

  if (options.command.length > 0) {
    args.push(
      terminal.execArg,
      ...options.command,
    );
  }

  /** Info-level because the resolved command is user-facing diagnostic output. */
  l.info(`final command: ${JSON.stringify(args,)}`,);
  return args;
}
