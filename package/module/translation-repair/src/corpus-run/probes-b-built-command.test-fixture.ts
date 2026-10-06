/**
 A built corpus-run command run in a child process that holds no provider key,
 and a throwaway corpus repository for it to read.

 TEST SUPPORT, NOT PACKAGE SOURCE. The child is started by the shared keyless
 fixture (`child-environment.test-fixture.ts`), which removes every provider
 key and every setting of the package from its environment before the
 variables a case names are set.

 Fixtures are invented and cat-themed.

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';

import type {
  CorpusPin,
  SyntheticClient,
} from '../../dist/final/node/index.mjs';
import { namingFixtureGit, } from '../archive-naming.test-fixture.ts';
import {
  type ChildRun,
  runBuiltCommand,
} from '../child-environment.test-fixture.ts';
import { criticClient, } from '../critic-scripted-client.test-fixture.ts';
import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';

/**
 Native executable, never the current repository's command-policy wrapper.
 */
const REAL_GIT = await resolveGit();

/**
 What a built command wrote and how it exited, under the name these suites
 call it by.

 @example
 ```ts
 const run: BuiltRun = { code: 0, stdout: 'PROBE done\n', stderr: '', };
 ```
 */
export type BuiltRun = ChildRun;

/**
 A throwaway corpus repository and the commit a run reads it at.

 @example
 ```ts
 await using corpus = await makeProbeCorpus({ files: { 'people/mittens/page.md': 'Mittens naps.\n', }, },);
 ```
 */
type ProbeCorpus = AsyncDisposable & {
  /**
   Directory of the repository.
   */
  readonly cloneDir: string;

  /**
   Full name of the one commit holding every file.
   */
  readonly commitSha: string;

  /**
   Pin reading that commit through the native executable.
   */
  readonly pin: CorpusPin;
};

/**
 Runs a built command with every variable whose name ends in `_API_KEY`
 removed from its environment, so the child can neither refuse for the wrong
 reason nor spend whatever the runner's own environment holds.

 @param command - built entry file's name, such as `sentinel-probe`

 @param args - arguments after it

 @param runsDir - throwaway runs directory the child writes under, required so
 no case leaves it to the worktree's own

 @param env - further variables added to the keyless environment, which a case
 uses to point the corpus and the caches at throwaway places

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltWithoutKeys({ command: 'sentinel-probe', args: [], runsDir, env: {}, },);
 ```
 */
export async function runBuiltWithoutKeys(
  {
    command,
    args,
    runsDir,
    env,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly runsDir: string;
    readonly env: Readonly<Record<string, string>>;
  },
): Promise<BuiltRun> {
  return await runBuiltCommand({
    command,
    args,
    env: {
      ...env,
      TRANSLATION_REPAIR_RUNS_DIR: runsDir,
    },
  },);
}

/**
 Builds a repository of invented files committed once, for a run to read as
 its corpus.

 @param files - file text by repository-relative path

 @returns Repository and its commit, removed on scope exit

 @example
 ```ts
 await using corpus = await makeProbeCorpus({ files: { 'people/mittens/page.md': 'Mittens naps.\n', }, },);
 ```
 */
export async function makeProbeCorpus(
  { files, }: { readonly files: Readonly<Record<string, string>>; },
): Promise<ProbeCorpus> {
  return await scratchDirWith({
    prefix: 'probes-b-corpus-',
    setup: async function seeded({ path: cloneDir, },): Promise<{
      readonly cloneDir: string;
      readonly commitSha: string;
      readonly pin: CorpusPin;
    }> {
      await namingFixtureGit({
        cloneDir,
        args: ['init',],
      },);
      for (
        const [
          relPath,
          text,
        ] of Object.entries(files,)
      ) {
        /* oxlint-disable no-await-in-loop -- one git index, so each file is written and added in turn */
        await mkdir(
          dirname(join(
            cloneDir,
            relPath,
          ),),
          { recursive: true, },
        );
        await writeFile(
          join(
            cloneDir,
            relPath,
          ),
          text,
          'utf8',
        );
        await namingFixtureGit({
          cloneDir,
          args: [
            'add',
            '--',
            relPath,
          ],
        },);
        /* oxlint-enable no-await-in-loop */
      }
      await namingFixtureGit({
        cloneDir,
        args: [
          'commit',
          '--message',
          'record invented corpus',
        ],
      },);
      /**
       The one commit.
       */
      const commitSha = await namingFixtureGit({
        cloneDir,
        args: [
          'rev-parse',
          'HEAD',
        ],
      },);
      return {
        cloneDir,
        commitSha,
        pin: {
          cloneDir,
          commitSha,
          gitPath: REAL_GIT,
        },
      };
    },
  },);
}

/**
 Environment pointing a run at a throwaway corpus.

 @param corpus - repository and commit the run reads

 @returns Variables to hand `runBuiltWithoutKeys` as its `env`

 @example
 ```ts
 const env = corpusEnvOf({ corpus, },);
 ```
 */
export function corpusEnvOf(
  { corpus, }: { readonly corpus: Pick<ProbeCorpus, 'cloneDir' | 'commitSha'>; },
): Readonly<Record<string, string>> {
  return {
    TRANSLATION_REPAIR_CORPUS_CLONE_DIR: corpus.cloneDir,
    TRANSLATION_REPAIR_CORPUS_COMMIT: corpus.commitSha,
  };
}

/**
 Runs something that may refuse and says how it ended.

 @param run - the call under test

 @returns The refusal as `String(error)` reads it, empty when the call ran to
 its end

 @example
 ```ts
 const refusal = await refusalOf({ run: async function walk(): Promise<void> { await probe(); }, },);
 ```
 */
export async function refusalOf(
  { run, }: { readonly run: () => Promise<void>; },
): Promise<string> {
  try {
    await run();
    return '';
  }
  catch (error) {
    return String(error,);
  }
}

/**
 The report an inert client gives every critic.

 @returns A report raising nothing

 @example
 ```ts
 const report = noIssues();
 ```
 */
function noIssues(): unknown {
  return { issues: [], };
}

/**
 Builds a client no case calls, and keeps it, so a case can say how many were
 built and whether one was handed on.

 @param clients - list every client built is added to

 @returns A client answering every critic with nothing

 @example
 ```ts
 const client = keptInertClient({ clients, },);
 ```
 */
export function keptInertClient({ clients, }: { readonly clients: SyntheticClient[]; },): SyntheticClient {
  /**
   Client answering every critic with nothing.
   */
  const client = criticClient({ reportFor: noIssues, },);
  clients.push(client,);
  return client;
}
