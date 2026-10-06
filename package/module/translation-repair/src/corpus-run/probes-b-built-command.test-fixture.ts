/**
 A throwaway corpus repository for the as-built suites of the probes to read,
 and what those suites share around it.

 TEST SUPPORT, NOT PACKAGE SOURCE. A child is started by the shared keyless
 fixture (`child-environment.test-fixture.ts`) and by nothing here.

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
import { criticClient, } from '../critic-scripted-client.test-fixture.ts';
import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';

/**
 Native executable, never the current repository's command-policy wrapper.
 */
const REAL_GIT = await resolveGit();

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
