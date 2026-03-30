import spawn from 'nano-spawn';

import {
  l,
  tagged,
} from '../log.ts';
import {
  type Command,
  evaluatePredicate,
  type PlatformCommands,
  type PlatformEntry,
} from '../platform/evaluate-predicate.ts';

//region exec

/**
 * Runs an external command and returns its stdout.
 *
 * @param cmd - Executable name
 *
 * @param args - Arguments passed to the command
 *
 * @returns Stdout output as a string
 *
 * @throws When the command exits with a non-zero code
 *
 * @example
 * ```ts
 * const version = await exec('git', ['--version']);
 * ```
 */
export async function exec(
  cmd: string,
  args?: readonly string[],
): Promise<string>;

/**
 * Evaluates platform entries top-to-bottom and executes the first matching command.
 * Each entry is a `[predicate, command]` tuple.
 * Predicates are direct commands (no shell); exit code 0 = match.
 *
 * @param platformCommands - Ordered list of `[predicate, command]` tuples
 *
 * @returns Stdout output from the matched command
 *
 * @throws When no predicate matches — includes all tested predicates in the message
 *
 * @throws When the matched command exits with a non-zero code
 *
 * @example
 * ```ts
 * // First match wins: try mise, then brew, then apt
 * const output = await exec([
 *   [['mise', '--version'],  ['mise', 'exec', '--', 'git', 'pull']],
 *   [['brew', '--version'],  ['brew', 'install', 'git']],
 *   [['apt-get', '--version'], ['apt-get', 'install', 'git']],
 * ]);
 * ```
 */
export async function exec(
  platformCommands: PlatformCommands,
): Promise<string>;

/**
 * Runs an external command directly or evaluates platform entries to find a matching command.
 *
 * @param cmdOrPlatformCommands - Executable name (string) or ordered `[predicate, command]` tuples
 *
 * @param args - Arguments passed to the command (only used with string form)
 *
 * @returns Stdout output as a string
 */
export async function exec(
  cmdOrPlatformCommands: string | PlatformCommands,
  args: readonly string[] = [],
): Promise<string> {
  if (typeof cmdOrPlatformCommands === 'string') {
    return await execDirect(
      cmdOrPlatformCommands,
      args,
    );
  }
  return await execPlatformAware(cmdOrPlatformCommands,);
}

//endregion exec

//region Direct execution

/**
 * Executes a single command directly via `nano-spawn`.
 *
 * @param cmd - Executable name
 *
 * @param args - Arguments passed to the command
 *
 * @returns Stdout output as a string
 */
async function execDirect(
  cmd: string,
  args: readonly string[],
): Promise<string> {
  const rl = tagged({
    tag: execDirect.name,
    l,
  },);
  rl.debug(`${cmd} ${args.join(' ',)}`,);
  const { stdout, } = await spawn(
    cmd,
    [...args,],
  );
  return stdout;
}

//endregion Direct execution

//region Platform-aware execution

/**
 * Evaluates all predicates concurrently, then executes the command
 * from the first entry (by declaration order) whose predicate succeeded.
 *
 * @param platformCommands - Ordered `[predicate, command]` tuples
 *
 * @returns Stdout from the matched command
 *
 * @throws When no predicate matches
 */
async function execPlatformAware(
  platformCommands: PlatformCommands,
): Promise<string> {
  const results = await Promise.all(
    platformCommands.map(async function checkPredicate(entry,): Promise<boolean> {
      const [predicate,] = entry;
      return await evaluatePredicate(predicate,);
    },),
  );
  const matchIndex = results.findIndex(Boolean,);
  if (matchIndex === -1)
    throw new PlatformMatchError(platformCommands,);
  const matched = platformCommands[matchIndex];
  if (!matched)
    throw new PlatformMatchError(platformCommands,);
  const [, cmd,] = matched;
  return await execCommand(cmd,);
}

/**
 * Dispatches a {@link Command} to the appropriate execution path.
 *
 * - **Array, first element is string**: `[cmd, ...args]` → {@link execDirect}
 * - **Array, first element is array**: nested {@link PlatformCommands} → {@link execPlatformAware} (recursive)
 *
 * @param cmd - Command as `[cmd, ...args]` or nested {@link PlatformCommands}
 *
 * @returns Stdout output as a string
 */
async function execCommand(cmd: Command,): Promise<string> {
  if (isNestedPlatformCommands(cmd,))
    return await execPlatformAware(cmd,);
  const [executable = '', ...args] = cmd as readonly string[];
  return await execDirect(
    executable,
    args,
  );
}

/**
 * Determines whether a non-string {@link Command} is a nested {@link PlatformCommands}.
 * Checks if the first element is an array (predicate tuple) rather than a string (command name).
 *
 * @param cmd - Array-form command to inspect
 *
 * @returns `true` if the command is a nested {@link PlatformCommands}
 */
function isNestedPlatformCommands(
  cmd: readonly string[] | PlatformCommands,
): cmd is PlatformCommands {
  return cmd.length > 0 && Array.isArray(cmd[0],);
}

//endregion Platform-aware execution

//region Errors

/**
 * Thrown when no predicate in a {@link PlatformCommands} list matches the current platform.
 * Includes all tested predicates for debuggability.
 */
class PlatformMatchError extends Error {
  /**
   * @param platformCommands - Entries that were tested and all failed
   */
  constructor(platformCommands: PlatformCommands,) {
    const predicateList = platformCommands
      .map(function formatOne(entry,): string {
        return formatEntry(entry,);
      },)
      .join(', ',);
    super(
      `No platform predicate matched. Tested: [${predicateList}]`,
    );
    this.name = 'PlatformMatchError';
  }
}

/**
 * Formats a single platform entry's predicate for error messages.
 *
 * @param entry - Platform entry to format
 *
 * @returns Human-readable predicate representation
 */
function formatEntry(entry: PlatformEntry,): string {
  const [predicate,] = entry;
  return `[${
    predicate
      .map(function quote(segment,): string {
        return `"${segment}"`;
      },)
      .join(', ',)
  }]`;
}

//endregion Errors
