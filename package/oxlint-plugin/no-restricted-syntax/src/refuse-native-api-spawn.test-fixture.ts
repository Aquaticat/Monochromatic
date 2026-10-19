/**
 Fault injection for the native TypeScript child, loaded into an Oxlint process with `node --import`.

 Makes every spawn of a `--api` child fail the way Node reports a spawn the operating system could not
 map memory for: a synchronous error whose code is `ENOMEM`. No memory is exhausted. Spawns of other
 programs pass through untouched.

 @module
 */

import childProcess from 'node:child_process';
import { syncBuiltinESMExports, } from 'node:module';

/**
 Spawns refused so far, reported at exit so a test can tell the injection was live.
 */
const refusals = { count: 0, };

/**
 Original spawn, reached for every program other than the native TypeScript child.
 */
const originalSpawn = childProcess.spawn;

/**
 Spawns the program unless it is the native TypeScript child, which fails as an out-of-memory spawn does.

 @param file - Program to start.

 @param args - Arguments handed to it.

 @param options - Spawn options.

 @returns the child process for any program but the native TypeScript child.

 @throws {@link Error} with code `ENOMEM` for the native TypeScript child.
 */
function spawnUnlessNativeApi(
  file: string,
  args: unknown,
  options: childProcess.SpawnOptions,
): childProcess.ChildProcess {
  if (Array.isArray(args,) && args.includes('--api',)) {
    refusals.count += 1;
    throw Object.assign(new Error('spawn ENOMEM',), {
      code: 'ENOMEM',
      errno: -12,
      syscall: 'spawn',
    },);
  }
  return Reflect.apply(originalSpawn, childProcess, [file, args, options,],) as childProcess.ChildProcess;
}

childProcess.spawn = spawnUnlessNativeApi as typeof childProcess.spawn;
syncBuiltinESMExports();
process.once('exit', function reportRefusals(): void {
  process.stderr.write(`[refuse-native-api-spawn] refused ${String(refusals.count,)} native spawns\n`,);
},);
