/**
 Index-writer coordination through the built wrapper in disposable repositories:
 a wrapped `git add` waits for a held landing lock and then for a proven-alive `index.lock` owner,
 `git cli-git fix` waits for a held landing lock,
 and concurrent wrapped adds and commits never collide on `index.lock`.

 @module
 */
import {
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  createLandingRepository,
  git,
  type LandingRepository,
  readText,
  runWrapper,
  writeWorktreeFile,
} from '../policy-engine/commit-landing-fixture.unit.test.ts';
import {
  observeWrapper,
  waitUntil,
} from './index-lock-fixture.unit.test.ts';

const {
  acquireOwnerLock,
  ensureTransactionRoot,
} = internalTestExports;

/**
 How long a blocked wrapper is observed to stay blocked.
 */
const BLOCKED_OBSERVATION_MS = 700;

/**
 Holds the repository's landing lock as this test process.

 @param repository - fixture repository

 @returns held lock
 */
async function holdLandingLock(repository: LandingRepository,): ReturnType<typeof acquireOwnerLock> {
  /** Transaction registry. */
  const registry = join(repository.gitDir, 'cli-git-transactions',);
  await ensureTransactionRoot(registry,);
  return await acquireOwnerLock({ lockDirectory: join(registry, 'landing.lock',), },);
}

await describe({
  name: 'index-writer coordination',
  children: [
    it({
      name: 'a wrapped git add waits for the landing lock, then for a proven-alive index.lock owner, then stages',
      fn: async function testAddWaits(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'new.txt', content: 'new\n', },);
        /** Landing lock held as if a landing ran. */
        const landing = await holdLandingLock(repository,);
        /** Wrapped add. */
        const add = observeWrapper({ repository, args: ['add', '--', 'new.txt',], },);
        await wait(BLOCKED_OBSERVATION_MS,);
        expect(add.exited(),).toBe(false,);
        expect(await git({ repository, args: ['ls-files', '--', 'new.txt',], },),).toBe('',);
        await writeFile(join(repository.gitDir, 'index.lock',), 'held',);
        await writeFile(join(repository.gitDir, 'index~pid.lock',), `pid ${String(process.pid,)}\n`,);
        await landing[Symbol.asyncDispose]();
        await waitUntil({ predicate: function reported(): boolean {
          return add.stderr().includes(`cli-git: waiting for PID ${String(process.pid,)}`,);
        }, },);
        expect(add.exited(),).toBe(false,);
        await rm(join(repository.gitDir, 'index~pid.lock',),);
        await rm(join(repository.gitDir, 'index.lock',),);
        /** Add outcome. */
        const outcome = await add.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(await git({ repository, args: ['ls-files', '--', 'new.txt',], },),).toBe('new.txt',);
      },
    },),
    it({
      name: 'git cli-git fix waits for a held landing lock before installing',
      fn: async function testFixWaits(): Promise<void> {
        await using repository = await createLandingRepository();
        await writeWorktreeFile({ repository, name: 'a.txt', content: 'x', },);
        /** Landing lock held as if a landing ran. */
        const landing = await holdLandingLock(repository,);
        /** Direct fix. */
        const fix = observeWrapper({ repository, args: ['cli-git', 'fix', '--all',], },);
        await wait(BLOCKED_OBSERVATION_MS,);
        expect(fix.exited(),).toBe(false,);
        expect(
          await readText(join(repository.path, 'a.txt',),),
        ).toBe('x',);
        await landing[Symbol.asyncDispose]();
        /** Fix outcome. */
        const outcome = await fix.outcome;
        expect(outcome.exitCode,).toBe(0,);
        expect(
          await readText(join(repository.path, 'a.txt',),),
        ).toBe('x\n',);
      },
    },),
    it({
      name: 'concurrent wrapped adds and commits never fail on index.lock and keep every staged entry',
      fn: async function testConcurrent(): Promise<void> {
        await using repository = await createLandingRepository();
        /** Committed paths. */
        const committed = ['c0.txt', 'c1.txt', 'c2.txt',];
        /** Staged paths. */
        const staged = ['s0.txt', 's1.txt', 's2.txt',];
        await Promise.all([...committed, ...staged,].map(async function writeInitial(name,): Promise<void> {
          await writeWorktreeFile({ repository, name, content: `${name}\n`, },);
        },),);
        await git({ repository, args: ['add', ...committed,], },);
        await git({ repository, args: ['commit', '--quiet', '-m', 'track',], },);
        await Promise.all(committed.map(async function edit(name,): Promise<void> {
          await writeWorktreeFile({ repository, name, content: `${name} edited\n`, },);
        },),);
        /** Every run, started together. */
        const [commits, adds,] = await Promise.all([
          Promise.all(committed.map(async function commit(name,) {
            return await runWrapper({ repository, args: ['commit', '-m', name, name,], },);
          },),),
          Promise.all(staged.map(async function add(name,) {
            return await runWrapper({ repository, args: ['add', '--', name,], },);
          },),),
        ],);
        expect(adds.map(function exitOf(outcome,): number {
          return outcome.exitCode;
        },),).toEqual([0, 0, 0,],);
        expect([...commits, ...adds,].some(function collided(outcome,): boolean {
          return outcome.stderr.includes('index.lock',) || outcome.stderr.includes('File exists',);
        },),).toBe(false,);
        // Commits that lost the landing race replay onto the winner, so every commit lands.
        expect(commits.map(function exitOf(outcome,): number {
          return outcome.exitCode;
        },),).toEqual([0, 0, 0,],);
        expect((await git({ repository, args: ['log', '--format=%s', '-3',], },)).split('\n',).toSorted(),).toEqual(committed,);
        expect((await git({ repository, args: ['ls-files', '--', ...staged,], },)).split('\n',),).toEqual(staged,);
      },
    },),
  ],
},);
