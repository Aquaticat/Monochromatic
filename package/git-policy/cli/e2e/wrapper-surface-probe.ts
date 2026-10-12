#!/usr/bin/env node
/**
 Container entry point of the wrapper surface probe.
 It runs the non-commit Git commands of `wrapper-surface-steps-fixture.ts` through the selected wrapper
 in a disposable linked-worktree repository
 and prints one line per command on standard output:
 the label, a tab, the exit code, a tab, and JSON holding the arguments and the output with object IDs masked.
 The selected wrapper comes from `E2E_WRAPPER` (see `wrapper-selection-fixture.ts`).
 `mise run //package/git-policy/cli:test:e2e:concurrent:native:surface` runs it once per wrapper and compares the two.

 Output is terminal report text (AGENTS.md TLG exception):
 workspace packages,
 including the tagged logger,
 are not installed in the container.

 @module
 */

import {
  mkdir,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { runProcess, } from './process-fixture.ts';
import { createScenarioRepository, } from './repository-fixture.ts';
import { repositoryOptions, } from './scenario-helper-fixture.ts';
import {
  runSurfaceSteps,
  type WrappedRunner,
} from './wrapper-surface-steps-fixture.ts';

//region Probe

/**
 Hexadecimal digits of an abbreviated object ID as `git log --oneline` prints it.
 */
const ABBREVIATED_OBJECT_ID_LENGTH = 7;

/**
 Hexadecimal digits of a full SHA-1 object ID.
 */
const FULL_OBJECT_ID_LENGTH = 40;

/**
 Digit counts of full and abbreviated object IDs, which `git log --oneline` prints with seven.
 */
const OBJECT_ID_LENGTHS: ReadonlySet<number> = new Set([
  ABBREVIATED_OBJECT_ID_LENGTH,
  FULL_OBJECT_ID_LENGTH,
]);

/**
 Whether a token is a lowercase hexadecimal object ID, full or abbreviated.
 A token needs at least one decimal digit, so seven-letter words such as `defaced` stay readable.

 @param token - whitespace-delimited token

 @returns true for a seven or forty digit hexadecimal token holding a decimal digit

 @example
 ```ts
 isObjectId('0123456789abcdef0123456789abcdef01234567'); // => true
 ```
 */
function isObjectId(token: string,): boolean {
  return OBJECT_ID_LENGTHS.has(token.length,)
    && token.split('',)
    .every(function hexDigit(character,) {
        return '0123456789abcdef'.includes(character,);
      },)
    && token.split('',)
    .some(function decimalDigit(character,) {
        return '0123456789'.includes(character,);
      },);
}

/**
 Masks object IDs, which differ between runs, one linear pass over the lines and tokens.

 @param text - command output

 @returns the text with each whitespace-delimited object ID replaced by `<oid>`

 @example
 ```ts
 maskObjectIds('0123456789abcdef0123456789abcdef01234567 x'); // => '<oid> x'
 ```
 */
function maskObjectIds(text: string,): string {
  return text.split('\n',)
    .map(function maskLine(line,) {
    return line.split(' ',)
      .map(function maskToken(token,) {
      return isObjectId(token,) ? '<oid>' : token;
    },)
      .join(' ',);
  },)
    .join('\n',);
}

/**
 Runs the probe in a fresh repository under `/work/probe`.

 @example
 ```ts
 await probe();
 ```
 */
async function probe(): Promise<void> {
  /**
   Scenario root, identical for every wrapper so paths in messages compare equal.
   */
  const root = '/work/probe';
  await rm(
    root,
    {
      recursive: true,
      force: true,
    },
  );
  await mkdir(
    root,
    { recursive: true, },
  );
  /**
   Repository with a linked worktree, where the stash commands are allowed.
   */
  const repository = await createScenarioRepository({
    root,
    gitVersion: '2.55.0',
    options: repositoryOptions({
      worktree: 'linked',
      seedFiles: [
        {
          path: 'a.txt',
          bytes: Buffer.from('a\n',),
        },
        {
          path: 'b.txt',
          bytes: Buffer.from('b\n',),
        },
      ],
    },),
  },);
  /**
   Runs one wrapper command and prints its result line.

   @param label - names the command in the comparison

   @param args - arguments after `git`

   @returns trimmed standard output, which later steps read
   */
  async function wrapped({
    label,
    args,
  }: Parameters<WrappedRunner>[0],): Promise<string> {
    /**
     Settled wrapper command.
     */
    const outcome = await runProcess({
      command: 'git',
      args,
      cwd: repository.worktree,
      env: repository.wrapperEnv,
    },);
    console.log(`${label}\t${String(outcome.exitCode,)}\t${JSON.stringify({
      args: args.map(maskObjectIds,),
      stdout: maskObjectIds(outcome.stdout,),
      stderr: maskObjectIds(outcome.stderr,),
    },)}`,);
    return outcome.stdout
      .trim();
  }
  await runSurfaceSteps({
    repository,
    wrapped,
    patchPath: join(
      root,
      'probe.patch',
    ),
  },);
}

//endregion Probe

await probe();
