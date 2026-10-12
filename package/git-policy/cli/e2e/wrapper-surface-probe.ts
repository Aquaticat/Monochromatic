#!/usr/bin/env node
/**
 Container entry point of the wrapper surface probe.
 It runs the non-commit Git commands of `wrapper-surface-steps-fixture.ts` through the selected wrapper
 in a disposable linked-worktree repository
 and prints one line per command on standard output:
 the label, a tab, and JSON holding the arguments, the exit code, and the output with object IDs masked.
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
 Length of a full object ID in hexadecimal digits.
 */
const OBJECT_ID_LENGTH = 40;

/**
 Whether a token is a full lowercase hexadecimal object ID.

 @param token - whitespace-delimited token

 @returns true for a 40-digit hexadecimal token

 @example
 ```ts
 isObjectId('0123456789abcdef0123456789abcdef01234567'); // => true
 ```
 */
function isObjectId(token: string,): boolean {
  return (token.length === OBJECT_ID_LENGTH)
    && token.split('',)
    .every(function hexDigit(character,) {
    return '0123456789abcdef'.includes(character,);
  },);
}

/**
 Masks full object IDs, which differ between runs, one linear pass over the lines and tokens.

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
    console.log(`${label}\t${JSON.stringify({
      args,
      exitCode: outcome.exitCode,
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
