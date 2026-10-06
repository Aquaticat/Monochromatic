/**
 Runs a built score command in a child process for the suites named
 "<runner> as built".

 The child's environment carries no variable whose name ends in `_API_KEY`
 and no other `TRANSLATION_REPAIR_` setting the runner could pick up from the
 machine, so a case can neither spend nor read the operator's runs. The runs
 directory is the one the case hands in, a directory it wrote itself.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { join, } from 'node:path';

import { digestPipeline, } from '../../dist/final/node/index.mjs';
import {
  type ChildRun,
  runKeyless,
} from '../child-environment.test-fixture.ts';

/**
 Path of a built command.

 @param name - runner name, which is the built file's name

 @returns Absolute path of the built `.mjs`

 @example
 ```ts
 const command = builtCommand({ name: 'score-verify', },);
 ```
 */
export function builtCommand({ name, }: { readonly name: string; },): string {
  return join(
    import.meta.dirname,
    '../../dist/final/node',
    `${name}.mjs`,
  );
}

/**
 Digest of the built output, which the pool prints as the pipeline that read it.

 @returns Digest text, as the pool's `POOL read by pipeline` line carries it

 @example
 ```ts
 const stamp = await builtPipelineDigest();
 ```
 */
export async function builtPipelineDigest(): Promise<string> {
  /**
   Stamp of the directory the built commands and the index sit in.
   */
  const { digest, } = await digestPipeline({
    dir: join(
      import.meta.dirname,
      '../../dist/final/node',
    ),
  },);
  return digest;
}

/**
 Runs a built score command against a runs directory the case wrote.

 @param command - built entry file, from `builtCommand`

 @param args - arguments after it

 @param runsDir - directory the case wrote, handed over as the runs directory

 @param setting - further settings the case sets for the child, by name

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltScore({ command, args: [], runsDir: scratch.path, setting: {}, },);
 ```
 */
export async function runBuiltScore(
  {
    command,
    args,
    runsDir,
    setting,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly runsDir: string;
    readonly setting: Readonly<Record<string, string>>;
  },
): Promise<ChildRun> {
  return await runKeyless({
    file: process.execPath,
    args: [
      command,
      ...args,
    ],
    cwd: join(
      import.meta.dirname,
      '../..',
    ),
    extra: {
      ...setting,
      TRANSLATION_REPAIR_RUNS_DIR: runsDir,
    },
  },);
}
