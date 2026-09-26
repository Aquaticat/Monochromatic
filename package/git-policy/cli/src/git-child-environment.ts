/**
 The environment every Git that cli-git forwards or spawns inherits.

 It appends `core.lockfilePid=true` through `GIT_CONFIG_COUNT`,
 `GIT_CONFIG_KEY_<n>`,
 and `GIT_CONFIG_VALUE_<n>`,
 so native Git writes an owner PID file beside each lock it takes.
 The hook dispatcher shim restores the caller's `GIT_CONFIG_PARAMETERS`,
 which would drop a `-c` injection,
 but leaves these numbered variables alone.
 Git reads the numbered entries before `GIT_CONFIG_PARAMETERS`,
 so an explicit `-c core.lockfilePid=false` from the caller still wins.
 A Git older than 2.54.0 ignores the unknown key and writes no PID file.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { isAsciiDigits, } from './ascii-decimal.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Git's count variable for environment-supplied configuration.
 */
const COUNT_VARIABLE = 'GIT_CONFIG_COUNT';

/**
 Canonical lowercase spelling Git compares configuration keys against.
 */
const LOCKFILE_PID_KEY = 'core.lockfilepid';

/**
 Key spelling written into the environment.
 */
const LOCKFILE_PID_WRITTEN_KEY = 'core.lockfilePid';

/**
 Boolean spellings Git reads as true.
 */
const GIT_TRUE_VALUES: ReadonlySet<string> = new Set([
  'true',
  'yes',
  'on',
  '1',
],);

/**
 Environment variables the overlay sets.
 */
export type GitChildEnvironmentOverlay = Readonly<Record<string, string>>;

/**
 `GIT_CONFIG_COUNT` holds something Git rejects.
 */
export const CONFIG_COUNT_MALFORMED: unique symbol = Symbol('GIT_CONFIG_COUNT holds non-digit characters that would be rejected',);

/**
 Parses a present `GIT_CONFIG_COUNT` the way Git's `strtoul` check accepts it.

 @param value - raw variable value

 @returns entry count, or the malformed sentinel when Git would reject the value

 @example
 ```ts
 parseConfigCount('2'); // 2
 parseConfigCount(''); // 0
 parseConfigCount('x'); // CONFIG_COUNT_MALFORMED
 ```
 */
export function parseConfigCount(value: string,): number | typeof CONFIG_COUNT_MALFORMED {
  // Git rejects any trailing non-digit.
  if (!isAsciiDigits(value,))
    return CONFIG_COUNT_MALFORMED;
  /**
   Parsed count; the empty string is zero, as for `strtoul`.
   */
  const count = value === '' ? 0 : Number(value,);
  return Number.isSafeInteger(count,) ? count : CONFIG_COUNT_MALFORMED;
}

/**
 Computes the variables that append `core.lockfilePid=true` to an environment's numbered Git configuration.

 Existing numbered entries are preserved.
 Nothing is added when the last numbered `core.lockfilePid` entry already reads as true,
 so nested cli-git invocations do not grow the list,
 or when `GIT_CONFIG_COUNT` is malformed,
 so Git still reports the caller's own error.

 @param environment - environment the child would inherit

 @returns variables to set; empty when nothing changes

 @example
 ```ts
 lockfilePidOverlay({}); // { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.lockfilePid', GIT_CONFIG_VALUE_0: 'true' }
 ```
 */
export function lockfilePidOverlay(environment: Readonly<NodeJS.ProcessEnv>,): GitChildEnvironmentOverlay {
  /**
   Tagged overlay logger.
   */
  const rl = tagged({
    tag: lockfilePidOverlay.name,
    l,
  },);
  /**
   Raw count variable.
   */
  const rawCount = environment[COUNT_VARIABLE];
  /**
   Existing numbered entry count.
   */
  const count = rawCount === undefined ? 0 : parseConfigCount(rawCount,);
  if (count === CONFIG_COUNT_MALFORMED) {
    rl.debug(`${COUNT_VARIABLE} is malformed; leaving it for Git to report`,);
    return {};
  }
  /**
   Indexes of existing numbered `core.lockfilePid` entries in Git's reading order.
   */
  const matching = Array.from(
    { length: count, },
    function entryIndex(
      _unused,
      index,
    ): number {
      return index;
    },
  )
    .filter(function isLockfilePid(index,): boolean {
      return environment[`GIT_CONFIG_KEY_${String(index,)}`]
        ?.toLowerCase()
        === LOCKFILE_PID_KEY;
    },);
  /**
   Git's effective numbered entry: the last one wins.
   */
  const lastIndex = matching.at(-1,);
  /**
   Its value.
   */
  const effective = lastIndex === undefined ? lastIndex : environment[`GIT_CONFIG_VALUE_${String(lastIndex,)}`];
  if ((effective !== undefined) && GIT_TRUE_VALUES.has(effective.toLowerCase(),)) {
    rl.debug('core.lockfilePid is already true in the numbered Git configuration',);
    return {};
  }
  return {
    [COUNT_VARIABLE]: String(count + 1,),
    [`GIT_CONFIG_KEY_${String(count,)}`]: LOCKFILE_PID_WRITTEN_KEY,
    [`GIT_CONFIG_VALUE_${String(count,)}`]: 'true',
  };
}

/**
 Returns a copy of an environment carrying the lock PID injection.

 @param environment - environment the child would inherit

 @returns environment for a Git child

 @example
 ```ts
 spawn(gitPath, args, { env: gitChildEnvironment(process.env) });
 ```
 */
export function gitChildEnvironment(environment: Readonly<NodeJS.ProcessEnv>,): NodeJS.ProcessEnv {
  return {
    ...environment,
    ...lockfilePidOverlay(environment,),
  };
}

/**
 Installs the lock PID injection into this process's environment,
 so every Git child cli-git starts inherits it, whichever spawn helper starts it.

 @param environment - live process environment

 @mutates environment - receives the overlay variables.

 @example
 ```ts
 installGitChildEnvironment(process.env);
 ```
 */
export function installGitChildEnvironment(environment: NodeJS.ProcessEnv,): void {
  for (const [name, value,] of Object.entries(lockfilePidOverlay(environment,),))
    environment[name] = value;
}
