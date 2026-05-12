#!/usr/bin/env bun

/**
 * `watch-restart` CLI entrypoint.
 *
 * Parses command-line flags via optique, maps them onto
 * {@link StartWatchRestartOptions}, then hands control to
 * {@link startWatchRestart}. On SIGINT or SIGTERM the orchestrator's
 * `stop()` runs and the process exits.
 *
 * Importing this module is side-effect-free; the program body only
 * runs when this file is executed as the entrypoint (gated by
 * `import.meta.main`), so unit tests can import `parseArgs` /
 * `argsToOptions` without launching a real watch loop.
 *
 * @example
 * ```bash
 * watch-restart -w src/server -- bun src/server/index.ts
 * watch-restart -w src --ext .ts --exclude '*.test.ts' -- bun run dev
 * watch-restart -w src --no-initial -- npm test
 * ```
 */

import { object, } from '@optique/core/constructs';
import {
  multiple,
  optional,
} from '@optique/core/modifiers';
import {
  argument,
  option,
} from '@optique/core/primitives';
import {
  integer,
  string,
} from '@optique/core/valueparser';
import { runSync, } from '@optique/run';
import {
  startWatchRestart,
  type StartWatchRestartOptions,
  type WatchRestartHandle,
} from './start.ts';
import type { WatchEventKind, } from './types.ts';

/**
 * Shape produced by {@link parseArgs}.
 *
 * Spelled explicitly (not inferred via `InferValue<typeof parser>`)
 * because `--isolatedDeclarations` does not survive optique's deeply-
 * generic combinators across the export boundary; the explicit shape
 * also doubles as documentation for the test fixtures.
 */
export type ParsedArgs = {
  /** `-w` / `--watch`; watch roots in argv order. */
  readonly watch: readonly string[];
  /** `-i` / `--include`; include globs in argv order. */
  readonly include: readonly string[];
  /** `-e` / `--exclude`; exclude globs in argv order. */
  readonly exclude: readonly string[];
  /** `--ext`; raw values pre-split (each entry may be a comma list). */
  readonly ext: readonly string[];
  /** `--events`; raw comma list, or `undefined` when not passed. */
  readonly events: string | undefined;
  /** `--no-content-changed`; `true` when passed. */
  readonly noContentChanged: boolean;
  /** `--max-hash-size`; parsed integer or `undefined`. */
  readonly maxHashSize: number | undefined;
  /** `--debounce`; parsed integer or `undefined`. */
  readonly debounce: number | undefined;
  /** `--stop-timeout`; parsed integer or `undefined`. */
  readonly stopTimeout: number | undefined;
  /** `--no-initial`; `true` when passed. */
  readonly noInitial: boolean;
  /** Positional args after `--`; first is command, rest is its args. */
  readonly rest: readonly string[];
};

/**
 * Module-internal optique parser. Built once at module load. Not
 * exported because spelling its inferred type without leaking
 * optique-internal generics is impractical; consumers go through
 * {@link parseArgs} which exposes the {@link ParsedArgs} shape.
 */
const parser = object({
  watch: multiple(option(
    '-w',
    '--watch',
    string(),
  ),),
  include: multiple(option(
    '-i',
    '--include',
    string(),
  ),),
  exclude: multiple(option(
    '-e',
    '--exclude',
    string(),
  ),),
  ext: multiple(option(
    '--ext',
    string(),
  ),),
  events: optional(option(
    '--events',
    string(),
  ),),
  noContentChanged: option('--no-content-changed',),
  maxHashSize: optional(option(
    '--max-hash-size',
    integer(),
  ),),
  debounce: optional(option(
    '--debounce',
    integer(),
  ),),
  stopTimeout: optional(option(
    '--stop-timeout',
    integer(),
  ),),
  noInitial: option('--no-initial',),
  rest: multiple(argument(string(),),),
},);

/**
 * Runs the optique parser against a synthetic argv and returns the
 * {@link ParsedArgs} shape.
 *
 * `onExit` / `stdout` / `stderr` are overridable so tests can capture
 * help text and trap parse-error exits; production callers omit them
 * to inherit the optique defaults (`process.exit`, `process.stdout`).
 *
 * @param options - argv to parse plus optional output / exit hooks
 *
 * @returns parsed args matching {@link ParsedArgs}
 *
 * @example
 * ```ts
 * const args = parseArgs({ argv: process.argv.slice(2,), },);
 * ```
 */
export function parseArgs(
  options: {
    readonly argv: readonly string[];
    readonly onExit?: (code: number,) => never;
    readonly stdout?: (text: string,) => void;
    readonly stderr?: (text: string,) => void;
  },
): ParsedArgs {
  return runSync(
    parser,
    {
      programName: 'watch-restart',
      args: options.argv,
      help: 'option',
      ...(options.onExit === undefined ? {} : { onExit: options.onExit, }),
      ...(options.stdout === undefined ? {} : { stdout: options.stdout, }),
      ...(options.stderr === undefined ? {} : { stderr: options.stderr, }),
    },
  );
}

/**
 * Splits a comma-separated string into trimmed non-empty tokens.
 *
 * Module-scope so `args.ext.flatMap(splitCommas,)` and
 * `args.events?.split` share the same token shape; oxlint's
 * `consistent-function-scoping` keeps pure helpers out of the closures
 * that call them.
 *
 * @param value - raw string from a CLI flag
 *
 * @returns trimmed non-empty tokens; never includes empty strings
 *
 * @example
 * ```ts
 * splitCommas('.ts, .tsx,, ',); // ['.ts', '.tsx']
 * ```
 */
function splitCommas(value: string,): string[] {
  return value
    .split(',',)
    .map(function trim(s,): string {
      return s.trim();
    },)
    .filter(function nonEmpty(s,): boolean {
      return s.length > 0;
    },);
}

/**
 * Maps a single CLI event-name token to the internal {@link WatchEventKind}.
 *
 * `create`/`delete` are the user-facing names (filesystem vocabulary);
 * `add`/`unlink` are the chokidar terms surfaced internally. Unknown
 * names throw a clear error so the CLI fails fast instead of silently
 * treating a typo as "all kinds".
 *
 * @param token - one CLI event token (e.g. `'create'`)
 *
 * @returns internal {@link WatchEventKind}
 *
 * @throws Error when the token is not one of `create`, `change`, `delete`
 *
 * @example
 * ```ts
 * cliEventToInternal('create',); // 'add'
 * cliEventToInternal('delete',); // 'unlink'
 * ```
 */
function cliEventToInternal(token: string,): WatchEventKind {
  if (token === 'create') {
    return 'add';
  }
  if (token === 'change') {
    return 'change';
  }
  if (token === 'delete') {
    return 'unlink';
  }
  throw new Error(
    `Unknown --events token "${token}"; expected one of create, change, delete`,
  );
}

/**
 * Maps the parsed CLI args onto a {@link StartWatchRestartOptions}.
 *
 * Pure transformation: no I/O, no global state, no defaults beyond what
 * the orchestrator itself applies. `--no-content-changed` becomes
 * `contentChanged: false`; absence stays absent (the orchestrator's
 * default-true kicks in). Same for `--no-initial`.
 *
 * The first positional after `--` becomes `command`; the remainder
 * becomes `args`. An empty `rest` is a CLI usage error and throws so
 * the user sees the cause instead of an opaque "spawn EINVAL" later.
 *
 * `--ext` and `--events` accept comma-lists; each is split and trimmed
 * before mapping.
 *
 * @param args - shape returned by {@link parseArgs}
 *
 * @returns options object handed straight to {@link startWatchRestart}
 *
 * @throws Error when no positional command is given after `--`
 *
 * @example
 * ```ts
 * const args = parseArgs({ argv: ['-w', 'src', '--', 'bun',], },);
 * const options = argsToOptions(args,);
 * ```
 */
export function argsToOptions(args: ParsedArgs,): StartWatchRestartOptions {
  if (args.rest.length === 0) {
    throw new Error(
      'No command supplied after "--"; usage: watch-restart -w <dir>... -- <cmd> [<args>...]',
    );
  }
  const [command, ...commandArgs] = args.rest;
  if (command === undefined || command === '') {
    throw new Error(
      'Empty command after "--"; usage: watch-restart -w <dir>... -- <cmd> [<args>...]',
    );
  }

  /** Flattened, comma-split extension list. */
  const extensions: readonly string[] = args.ext.flatMap(
    function flattenExt(raw,): string[] {
      return splitCommas(raw,);
    },
  );
  /**
   * Flattened, comma-split event kind list; translated from
   * CLI-facing `create`/`delete` to internal `add`/`unlink`.
   * `undefined` when `--events` was not passed.
   */
  const events: readonly WatchEventKind[] | undefined = args.events === undefined
    ? undefined
    : splitCommas(args.events,).map(
      function mapEventToken(token,): WatchEventKind {
        return cliEventToInternal(token,);
      },
    );

  return {
    paths: args.watch,
    command,
    ...(commandArgs.length > 0 ? { args: commandArgs, } : {}),
    ...(args.include.length > 0 ? { include: args.include, } : {}),
    ...(args.exclude.length > 0 ? { exclude: args.exclude, } : {}),
    ...(extensions.length > 0 ? { extensions, } : {}),
    ...(events === undefined ? {} : { events, }),
    ...(args.noContentChanged ? { contentChanged: false, } : {}),
    ...(args.maxHashSize === undefined ? {} : { maxHashSize: args.maxHashSize, }),
    ...(args.debounce === undefined ? {} : { debounce: args.debounce, }),
    ...(args.stopTimeout === undefined
      ? {}
      : { stopTimeout: args.stopTimeout, }),
    ...(args.noInitial ? { initial: false, } : {}),
  };
}

/**
 * Installs a one-shot SIGINT/SIGTERM handler that stops the
 * orchestrator and exits the process.
 *
 * One-shot: subsequent signals during shutdown skip the handler so a
 * frustrated double-Ctrl+C does not race two `stop()` calls; the
 * second signal lands as a hard exit via Node's default disposition.
 *
 * @param signal - signal name to handle
 *
 * @param handle - orchestrator handle whose `stop()` runs first
 *
 * @example
 * ```ts
 * installShutdownHandler({ signal: 'SIGINT', handle, },);
 * ```
 */
function installShutdownHandler(
  {
    signal,
    handle,
  }: {
    readonly signal: NodeJS.Signals;
    readonly handle: WatchRestartHandle;
  },
): void {
  process.once(
    signal,
    function onSignal(): void {
      void (async function doShutdown(): Promise<void> {
        try {
          await handle.stop();
          process.exit(0,);
        }
        catch (error) {
          const message = error instanceof Error
            ? error.message
            : String(error,);
          console.error(`shutdown failed: ${message}`,);
          process.exit(1,);
        }
      })();
    },
  );
}

if (import.meta.main) {
  /** Parsed argv from `process.argv.slice(2)`. */
  const args = parseArgs({ argv: process.argv.slice(2,), },);
  /** Mapped options handed to the orchestrator. */
  const options = argsToOptions(args,);
  /** Live handle; both signals route through it during shutdown. */
  const handle = await startWatchRestart(options,);
  installShutdownHandler({
    signal: 'SIGINT',
    handle,
  },);
  installShutdownHandler({
    signal: 'SIGTERM',
    handle,
  },);
}
