/**
 Writes the per-transaction hook dispatcher directory passed to native Git as `core.hooksPath`.

 @module
 */
import {
  chmod,
  mkdir,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { writePrivateFile, } from '../trust/registry-io.ts';
import {
  type HookDispatchPlan,
  PREPARATION_HOOK_EVENTS,
} from './hook-dispatch-plan.ts';
import {
  HOOK_DISPATCH_PROGRAM,
  hookEntryProgram,
} from './hook-dispatch-program.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Private hooks directory mode.
 */
const HOOKS_DIRECTORY_MODE = 0o700;

/**
 Owner-only executable hook mode.
 */
const HOOK_FILE_MODE = 0o700;

/**
 UTF-8 encoder for program text.
 */
const ENCODER = new TextEncoder();

/**
 Writes `package.json`, `dispatch.mjs`, `plan.json`, and one executable file per preparation event.
 `post-commit` is intentionally absent,
 so it never runs during preparation.

 @param hooksDirectory - absolute `<tx>/hooks` path, which must not exist yet

 @param plan - dispatch plan

 @param nodePath - Node executable for each hook's shebang

 @example
 ```ts
 await writeHookShim({ hooksDirectory: '/repo/.git/cli-git-transactions/id/hooks', plan, nodePath: process.execPath });
 ```
 */
export async function writeHookShim({
  hooksDirectory,
  plan,
  nodePath,
}: Readonly<{
  hooksDirectory: string;
  plan: HookDispatchPlan;
  nodePath: string;
}>,): Promise<void> {
  /**
   Tagged shim logger.
   */
  const rl = tagged({
    tag: writeHookShim.name,
    l,
  },);
  await mkdir(
    hooksDirectory,
    { mode: HOOKS_DIRECTORY_MODE, },
  );
  /**
   Dispatcher program path imported by every hook file.
   */
  const dispatchPath = join(
    hooksDirectory,
    'dispatch.mjs',
  );
  await Promise.all([
    // Marks the extensionless hook files as ES modules even under a repository `package.json` of another type.
    writePrivateFile({
      path: join(
        hooksDirectory,
        'package.json',
      ),
      bytes: ENCODER.encode(`${JSON.stringify({ type: 'module', },)}\n`,),
    },),
    writePrivateFile({
      path: dispatchPath,
      bytes: ENCODER.encode(HOOK_DISPATCH_PROGRAM,),
    },),
    writePrivateFile({
      path: join(
        hooksDirectory,
        'plan.json',
      ),
      bytes: ENCODER.encode(`${JSON.stringify(plan,)}\n`,),
    },),
  ],);
  await Promise.all(PREPARATION_HOOK_EVENTS.map(async function writeEntry(event,): Promise<void> {
    /**
     Executable hook file for this event.
     */
    const hookPath = join(
      hooksDirectory,
      event,
    );
    await writePrivateFile({
      path: hookPath,
      bytes: ENCODER.encode(hookEntryProgram({
        nodePath,
        dispatchUrl: pathToFileURL(dispatchPath,).href,
        event,
      },),),
    },);
    await chmod(
      hookPath,
      HOOK_FILE_MODE,
    );
  },),);
  rl.debug(`wrote hook dispatcher shim ${hooksDirectory}`,);
}
