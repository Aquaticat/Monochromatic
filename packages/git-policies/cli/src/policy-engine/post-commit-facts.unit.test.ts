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
import nanoSpawn from 'nano-spawn';
import { resolveGit, } from '../resolve-git.ts';
import { createPostCommitGitFacts, } from './post-commit-facts.ts';

/** Absolute real Git executable. */
const realGitPath = await resolveGit();

/** Disposable repository fixture. */
type RepositoryFixture = Readonly<{
  /** Repository root. */
  path: string;
  /** Removes repository after test. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates empty configured repository.
 *
 * @returns disposable repository
 */
async function createRepository(): Promise<RepositoryFixture> {
  /** Disposable repository root. */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-post-commit-facts-',),);
  await nanoSpawn(realGitPath, ['init', '--quiet',], { cwd: path, },);
  await nanoSpawn(realGitPath, ['config', 'user.email', 'cli-git@example.invalid',], { cwd: path, },);
  await nanoSpawn(realGitPath, ['config', 'user.name', 'cli-git fixture',], { cwd: path, },);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 * Commits staged state and returns landed OID.
 *
 * @param repository - fixture repository root
 *
 * @param message - commit message
 *
 * @returns landed commit OID
 */
async function commitAll({
  repository,
  message,
}: Readonly<{
  repository: string;
  message: string;
}>,): Promise<string> {
  await nanoSpawn(realGitPath, ['add', '--all',], { cwd: repository, },);
  await nanoSpawn(realGitPath, ['commit', '--quiet', '-m', message,], { cwd: repository, },);
  /** Landed HEAD identity. */
  const result = await nanoSpawn(realGitPath, ['rev-parse', 'HEAD',], { cwd: repository, },);
  return result.stdout
    .trim();
}

/**
 * Loads landed-delta candidates for one commit.
 *
 * @param repository - fixture repository root
 *
 * @param landedOid - landed commit OID
 *
 * @returns path-sorted delta candidates
 */
async function loadDelta({
  repository,
  landedOid,
}: Readonly<{
  repository: string;
  landedOid: string;
}>) {
  /** Landed-commit lazy facts under test. */
  const facts = createPostCommitGitFacts({
    gitPath: realGitPath,
    cwd: repository,
    landedOid,
  },);
  return (await facts.candidates())
    .toSorted(function byPath(left, right,) {
      return left.path
        .localeCompare(right.path,);
    },);
}

await describe({
  name: 'post-commit facts',
  children: [
    it({
      name: 'returns only landed delta with added and modified classification',
      fn: async function testLandedDelta() {
        await using repository = await createRepository();
        await writeFile(join(repository.path, 'stable.txt',), 'stable\n',);
        await writeFile(join(repository.path, 'edited.txt',), 'before\n',);
        await writeFile(join(repository.path, 'removed.txt',), 'doomed\n',);
        await commitAll({ repository: repository.path, message: 'baseline', },);
        await writeFile(join(repository.path, 'edited.txt',), 'after\n',);
        await writeFile(join(repository.path, 'fresh.txt',), 'fresh\n',);
        await rm(join(repository.path, 'removed.txt',),);
        /** Landed delta commit. */
        const landedOid = await commitAll({ repository: repository.path, message: 'delta', },);
        /** Path-sorted landed-delta candidates. */
        const candidates = await loadDelta({
          repository: repository.path,
          landedOid,
        },);
        expect(candidates.map(function summary(candidate,) {
          return {
            path: candidate.path,
            change: candidate.change,
          };
        },),).toEqual([
          {
            path: 'edited.txt',
            change: 'modified',
          },
          {
            path: 'fresh.txt',
            change: 'added',
          },
        ],);
        /** Modified candidate carrying landed bytes. */
        const editedCandidate = candidates.find(function isEdited(candidate,) {
          return candidate.path === 'edited.txt';
        },);
        expect(editedCandidate,).toBeDefined();
        if (editedCandidate !== undefined) {
          /** Decoded landed bytes of the modified candidate. */
          const editedText = new TextDecoder().decode(await editedCandidate.bytes(),);
          expect(editedText,).toBe('after\n',);
        }
      },
    },),
    it({
      name: 'classifies every root-commit path as added',
      fn: async function testRootCommit() {
        await using repository = await createRepository();
        await writeFile(join(repository.path, 'first.txt',), 'first\n',);
        await writeFile(join(repository.path, 'second.txt',), 'second\n',);
        /** Root commit without parents. */
        const landedOid = await commitAll({ repository: repository.path, message: 'root', },);
        /** Path-sorted root-commit candidates. */
        const candidates = await loadDelta({
          repository: repository.path,
          landedOid,
        },);
        expect(candidates.map(function summary(candidate,) {
          return {
            path: candidate.path,
            change: candidate.change,
          };
        },),).toEqual([
          {
            path: 'first.txt',
            change: 'added',
          },
          {
            path: 'second.txt',
            change: 'added',
          },
        ],);
      },
    },),
    it({
      name: 'deduplicates merge delta across parent diffs',
      fn: async function testMergeDelta() {
        await using repository = await createRepository();
        await writeFile(join(repository.path, 'base.txt',), 'base\n',);
        await commitAll({ repository: repository.path, message: 'baseline', },);
        await nanoSpawn(realGitPath, ['switch', '--quiet', '--create', 'side',], { cwd: repository.path, },);
        await writeFile(join(repository.path, 'side.txt',), 'side\n',);
        await commitAll({ repository: repository.path, message: 'side', },);
        await nanoSpawn(realGitPath, ['switch', '--quiet', '-',], { cwd: repository.path, },);
        await writeFile(join(repository.path, 'main.txt',), 'main\n',);
        await commitAll({ repository: repository.path, message: 'main', },);
        await nanoSpawn(realGitPath, ['merge', '--quiet', '--no-edit', 'side',], { cwd: repository.path, },);
        /** Landed merge identity. */
        const revParse = await nanoSpawn(realGitPath, ['rev-parse', 'HEAD',], { cwd: repository.path, },);
        /** Path-sorted merge-delta candidates. */
        const candidates = await loadDelta({
          repository: repository.path,
          landedOid: revParse.stdout
            .trim(),
        },);
        /** Distinct candidate paths across every parent diff. */
        const paths = candidates.map(function candidatePath(candidate,) {
          return candidate.path;
        },);
        expect(new Set(paths,).size,).toBe(paths.length,);
        expect(paths,).toContain('side.txt',);
        expect(paths,).toContain('main.txt',);
        expect(paths,).not
          .toContain('base.txt',);
      },
    },),
  ],
},);
