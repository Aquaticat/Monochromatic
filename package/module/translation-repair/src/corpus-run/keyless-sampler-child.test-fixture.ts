/**
 A child process running one built corpus-run command with every provider key
 withheld, for the "as built" suites of the sampler and card commands.

 @module
 */

import {
  type ChildRun,
  runBuiltCommand,
} from '../child-environment.test-fixture.ts';

//region Keyless sampler child
// THE CHILD IS STARTED BY THE SHARED KEYLESS FIXTURE
// (`child-environment.test-fixture.ts`), which removes every provider key and
// every setting of the package from its environment before the variables a
// case names are set. This is the name the sampler and card suites call it by,
// with every argument required so a case states the variables it hands over.

/**
 What a built command wrote and how it exited, under the name these suites
 call it by.

 @example
 ```ts
 const run: KeylessRun = { code: 0, stdout: 'ok\n', stderr: '', };
 ```
 */
export type KeylessRun = ChildRun;

/**
 Runs one built command in a child whose environment carries no provider key.

 @param command - built file's name without its extension, as named in `dist/final/node`

 @param argv - command-line arguments after the script path

 @param env - variables the case adds on top of the key-free environment (a runs directory, a cache directory), which never include a key

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltKeyless({ command: 'roster-card', argv: [], env: {}, },);
 ```
 */
export async function runBuiltKeyless(
  {
    command,
    argv,
    env,
  }: {
    readonly command: string;
    readonly argv: readonly string[];
    readonly env: Readonly<Record<string, string>>;
  },
): Promise<ChildRun> {
  return await runBuiltCommand({
    command,
    args: argv,
    env,
  },);
}

//endregion Keyless sampler child
