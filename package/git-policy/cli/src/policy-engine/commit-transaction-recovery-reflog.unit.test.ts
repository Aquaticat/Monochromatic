/**
 Reflog nonce search on disposable real-Git repositories.

 @module
 */
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  createRecoveryRepository,
  headOid,
  REAL_GIT,
  runFixtureGit,
} from './commit-transaction-recovery-fixture.unit.test.ts';

const {
  CommitTransactionRecoveryError,
  findTransactionLandedOid,
} = internalTestExports;

/**
 Nonce-bearing reflog action used by fixtures.
 */
const ACTION = 'cli-git:transaction:0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10';

/**
 Creates an empty commit with a chosen reflog action.

 @param repository - repository root

 @param message - commit message

 @param action - reflog action; Git default when empty

 @returns new HEAD
 */
async function commitWithAction({
  repository,
  message,
  action,
}: Readonly<{
  repository: string;
  message: string;
  action: string;
}>,): Promise<string> {
  await runFixtureGit({
    repository,
    args: ['commit', '--quiet', '--allow-empty', `--message=${message}`,],
    env: action === '' ? {} : { GIT_REFLOG_ACTION: action, },
  },);
  return headOid(repository,);
}

/**
 Captures the expected rejection message.

 @param repository - repository root

 @param gitPath - Git executable, real unless a test substitutes one

 @returns error message
 */
async function searchFailure({
  repository,
  gitPath = REAL_GIT,
}: Readonly<{
  repository: string;
  gitPath?: string;
}>,): Promise<string> {
  try {
    await findTransactionLandedOid({ gitPath, cwd: repository, reflogAction: ACTION, },);
  }
  catch (error: unknown) {
    if (error instanceof CommitTransactionRecoveryError)
      return error.message;
    throw error;
  }
  throw new Error('Reflog search unexpectedly succeeded.',);
}

await describe({
  name: findTransactionLandedOid.name,
  children: [
    it({
      name: 'returns the commit whose entry carries the nonce under later entries',
      fn: async function testDeeperNonce(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** Commit the transaction landed. */
        const landed = await commitWithAction({ repository: repository.path, message: 'landed', action: ACTION, },);
        await commitWithAction({ repository: repository.path, message: 'later', action: '', },);
        await commitWithAction({ repository: repository.path, message: 'latest', action: '', },);
        expect(await findTransactionLandedOid({ gitPath: REAL_GIT, cwd: repository.path, reflogAction: ACTION, },),).toBe(landed,);
      },
    },),
    it({
      name: 'ignores an entry that mentions the nonce only in its commit subject',
      fn: async function testSubjectMention(): Promise<void> {
        await using repository = await createRecoveryRepository();
        await commitWithAction({ repository: repository.path, message: `mentions ${ACTION}: here`, action: '', },);
        expect(await searchFailure({ repository: repository.path, },),).toContain('HEAD reflog does not identify prepared transaction',);
      },
    },),
    it({
      name: 'rejects a nonce naming several commits',
      fn: async function testSeveralCommits(): Promise<void> {
        await using repository = await createRecoveryRepository();
        /** First commit carrying the nonce. */
        const first = await commitWithAction({ repository: repository.path, message: 'first', action: ACTION, },);
        /** Second commit carrying the same nonce. */
        const second = await commitWithAction({ repository: repository.path, message: 'second', action: ACTION, },);
        /** Rejection naming both commits. */
        const message = await searchFailure({ repository: repository.path, },);
        expect(message,).toContain('names several commits',);
        expect(message,).toContain(first,);
        expect(message,).toContain(second,);
      },
    },),
    it({
      name: 'rejects a repository whose reflog Git cannot read',
      fn: async function testUnreadableReflog(): Promise<void> {
        /** Repository with an unborn branch and no reflog. */
        const path = await mkdtemp(join(tmpdir(), 'cli-git-reflog-unborn-',),);
        await using cleanup = {
          async [Symbol.asyncDispose](): Promise<void> {
            await rm(path, { recursive: true, force: true, },);
          },
        };
        await runFixtureGit({ repository: path, args: ['init', '--quiet',], },);
        expect(await searchFailure({ repository: path, },),).toContain('lacks durable reflog provenance',);
      },
    },),
    it({
      name: 'rejects reflog output without an identity separator',
      fn: async function testMalformedOutput(): Promise<void> {
        /** Directory holding a fake Git that prints one separator-free line. */
        const path = await mkdtemp(join(tmpdir(), 'cli-git-reflog-malformed-',),);
        await using cleanup = {
          async [Symbol.asyncDispose](): Promise<void> {
            await rm(path, { recursive: true, force: true, },);
          },
        };
        /** Fake Git executable. */
        const gitPath = join(path, 'git',);
        await writeFile(gitPath, `#!${process.execPath}\nprocess.stdout.write('no-separator\\n');\n`, { mode: 0o700, },);
        expect(await searchFailure({ repository: path, gitPath, },),).toContain('malformed transaction reflog output',);
      },
    },),
  ],
},);
