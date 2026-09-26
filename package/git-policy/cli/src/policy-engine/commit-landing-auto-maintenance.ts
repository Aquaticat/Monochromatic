/**
 Automatic maintenance after a landing, as native `git commit` runs it.

 Native `git commit` runs `git maintenance run --auto` after updating `HEAD` and before `post-commit`
 (`builtin/commit.c` calling `run_auto_maintenance`).
 A landing replaces that native commit with plumbing,
 and every landing migrates its objects as one pack,
 so without this step the real pack count grows by one per commit
 and every later Git process searches every pack.
 `gc --auto` consolidates packs once they exceed `gc.autoPackLimit`,
 which bounds that count independently of history length.

 The enable and detach decisions mirror Git's `prepare_auto_maintenance` in `run-command.c`:
 `maintenance.auto`,
 falling back to `gc.auto` being positive;
 `maintenance.autoDetach`,
 falling back to `gc.autoDetach`,
 then to detaching.
 Failures are logged and never fail the landed commit,
 as native Git ignores the maintenance exit status.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runTransactionGit, } from './commit-transaction-git.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Exit status `parse_options` uses for an unknown option,
 which Git before 2.47 reports for `maintenance run --detach`.
 */
const USAGE_EXIT_CODE = 129;

/**
 Exit status of `git config --get-regexp` when no key matches.
 */
const CONFIG_UNSET_EXIT_CODE = 1;

/**
 Config keys the native decision reads, canonicalized as Git prints them.
 */
const MAINTENANCE_CONFIG_PATTERN = String.raw`^(maintenance\.auto|maintenance\.autodetach|gc\.auto|gc\.autodetach)$`;

/**
 Automatic maintenance is disabled by `maintenance.auto` or a non-positive `gc.auto`.
 */
export const AUTO_MAINTENANCE_DISABLED: unique symbol = Symbol('maintenance.auto or gc.auto disables automatic maintenance',);

/**
 Interprets one `--type=bool-or-int` value as Git's boolean.

 @param value - canonical `true`, `false`, or decimal integer

 @returns whether the value is true or nonzero

 @example
 ```ts
 boolOrIntTrue('false'); // false
 ```
 */
function boolOrIntTrue(value: string,): boolean {
  if (value === 'true')
    return true;
  if (value === 'false')
    return false;
  return Number(value,) !== 0;
}

/**
 Parses `git config --null --get-regexp` output, keeping the last value of each key as Git's single-value lookup does.

 @param output - NUL-terminated `key\nvalue` records

 @returns canonical key to value

 @example
 ```ts
 parseConfigRecords('gc.auto\n0\0'); // { 'gc.auto': '0' }
 ```
 */
export function parseConfigRecords(output: string,): Readonly<Record<string, string>> {
  return Object.fromEntries(output
    .split('\0',)
    .filter(function nonEmpty(record,): boolean {
      return record.length > 0;
    },)
    .map(function keyValue(record,): readonly [string, string,] {
      /**
       Newline separating the key from its value; absent for a value-less key.
       */
      const newline = record.indexOf('\n',);
      return newline === (-1)
        ? [record, 'true',]
        : [record.slice(
          0,
          newline,
        ), record.slice(newline + 1,),];
    },),);
}

/**
 Computes the `git maintenance` arguments native `git commit` would run.

 @param config - canonical config key to `--type=bool-or-int` value

 @returns maintenance arguments, or the disabled marker

 @example
 ```ts
 autoMaintenanceArgs({}); // ['maintenance', 'run', '--auto', '--quiet', '--detach']
 ```
 */
export function autoMaintenanceArgs(config: Readonly<Record<string, string>>,): readonly string[] | typeof AUTO_MAINTENANCE_DISABLED {
  /**
   Explicit `maintenance.auto`.
   */
  const maintenanceAuto = config['maintenance.auto'];
  /**
   `gc.auto`, consulted only when `maintenance.auto` is unset.
   */
  const gcAuto = config['gc.auto'];
  /**
   Whether automatic maintenance runs.
   */
  const enabled = maintenanceAuto === undefined
    ? (gcAuto === undefined) || (Number(gcAuto,) > 0)
    : boolOrIntTrue(maintenanceAuto,);
  if (!enabled)
    return AUTO_MAINTENANCE_DISABLED;
  /**
   First configured detach setting.
   */
  const detachSetting = config['maintenance.autodetach'] ?? config['gc.autodetach'];
  /**
   Whether maintenance continues in the background.
   */
  const detach = (detachSetting === undefined) || boolOrIntTrue(detachSetting,);
  return [
    'maintenance',
    'run',
    '--auto',
    '--quiet',
    detach ? '--detach' : '--no-detach',
  ];
}

/**
 Runs automatic maintenance in the real repository after a landing.

 @param gitPath - real Git executable

 @param cwd - owning worktree root

 @param globalArgs - caller's kept global options, so `-c maintenance.auto=false` applies

 @returns maintenance exit code, or the disabled marker

 @example
 ```ts
 await runAutoMaintenance({ gitPath: '/usr/bin/git', cwd: '/repo', globalArgs: [] });
 ```
 */
export async function runAutoMaintenance({
  gitPath,
  cwd,
  globalArgs,
}: Readonly<{
  gitPath: string;
  cwd: string;
  globalArgs: readonly string[];
}>,): Promise<number | typeof AUTO_MAINTENANCE_DISABLED> {
  /**
   Tagged maintenance logger.
   */
  const rl = tagged({
    tag: runAutoMaintenance.name,
    l,
  },);
  /**
   Config lookup; exit 1 means no key is set.
   */
  const lookup = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      ...globalArgs,
      'config',
      '--type=bool-or-int',
      '--null',
      '--get-regexp',
      MAINTENANCE_CONFIG_PATTERN,
    ],
    allowFailure: true,
  },);
  if ((lookup.exitCode !== 0) && (lookup.exitCode !== CONFIG_UNSET_EXIT_CODE)) {
    rl.warn(`skipping automatic maintenance: git config exited ${String(lookup.exitCode,)}: ${lookup.stderr
      .trim()}`,);
    return lookup.exitCode;
  }
  /**
   Native maintenance arguments.
   */
  const args = autoMaintenanceArgs(parseConfigRecords(lookup.exitCode === 0 ? DECODER.decode(lookup.stdout,) : '',),);
  if (args === AUTO_MAINTENANCE_DISABLED) {
    rl.debug('automatic maintenance disabled by configuration',);
    return AUTO_MAINTENANCE_DISABLED;
  }
  rl.debug(`running git ${args.join(' ',)}`,);
  /**
   Maintenance outcome; a detached run returns once the background process is forked.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [...globalArgs, ...args,],
    allowFailure: true,
  },);
  if (result.exitCode !== USAGE_EXIT_CODE) {
    rl.debug(`automatic maintenance exited ${String(result.exitCode,)}`,);
    return result.exitCode;
  }
  // Git before 2.47 has no detach option; its native form omits it and gc detaches on its own.
  rl.debug(`git rejected ${args.at(-1,) ?? ''}; retrying in the pre-2.47 form: ${result.stderr
    .trim()}`,);
  /**
   Outcome of the pre-2.47 form.
   */
  const fallback = await runTransactionGit({
    gitPath,
    cwd,
    args: [...globalArgs, ...args.slice(
      0,
      -1,
    ),],
    allowFailure: true,
  },);
  rl.debug(`automatic maintenance exited ${String(fallback.exitCode,)}`,);
  return fallback.exitCode;
}
