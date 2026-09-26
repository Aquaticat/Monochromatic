/**
 Fingerprints of each declared input kind on disposable repositories:
 each changes when its input changes and stays equal otherwise.

 @module
 */
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import {
  internalTestExports,
  type PolicyInput,
} from '../../dist/final/node/index.mjs';

const {
  FINGERPRINT_UNAVAILABLE,
  fingerprintPolicyInputs,
  policyInputKey,
} = internalTestExports;

/**
 Real Git.
 */
const REAL_GIT = await resolveRealGit();

/**
 Disposable repository with one commit.
 */
type Fixture = Readonly<{
  /**
   Worktree root.
   */
  root: string;
  /**
   Directory outside the repository.
   */
  outside: string;
  /**
   Runs Git in the repository.
   */
  git: (args: readonly string[]) => Promise<string>;
  /**
   Fingerprints inputs.
   */
  fingerprint: (inputs: readonly PolicyInput[], environment?: NodeJS.ProcessEnv) => Promise<ReadonlyMap<string, unknown>>;
  /**
   Removes everything.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Creates a repository whose `.gitignore` ignores `*.local.txt`, with a tracked rules file.

 @returns fixture
 */
async function createFixture(): Promise<Fixture> {
  /**
   Scratch root.
   */
  const scratch = await mkdtemp(join(tmpdir(), 'cli-git-fingerprint-',),);
  /**
   Worktree root.
   */
  const root = join(scratch, 'repo',);
  /**
   Outside directory.
   */
  const outside = join(scratch, 'outside',);
  await mkdir(outside,);
  /**
   Isolated environment.
   */
  const env = { ...process.env, HOME: scratch, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'f', GIT_AUTHOR_EMAIL: 'f@example.invalid', GIT_COMMITTER_NAME: 'f', GIT_COMMITTER_EMAIL: 'f@example.invalid', };
  await nanoSpawn(REAL_GIT, ['init', '--quiet', '--initial-branch=main', root,], { env, },);
  /**
   Git runner.

   @param args - arguments

   @returns trimmed output
   */
  async function git(args: readonly string[],): Promise<string> {
    return (await nanoSpawn(REAL_GIT, [...args,], { cwd: root, env, },)).stdout.trim();
  }
  await writeFile(join(root, '.gitignore',), '*.local.txt\n',);
  await writeFile(join(root, 'rules.txt',), 'rule\n',);
  await git(['add', '.gitignore', 'rules.txt',],);
  await git(['commit', '--quiet', '-m', 'base',],);
  return {
    root,
    outside,
    git,
    fingerprint: async function fingerprint(inputs, environment = {},) {
      return await fingerprintPolicyInputs({
        location: { gitPath: REAL_GIT, repositoryRoot: root, shadowPath: join(root, '.git',), environment, },
        inputs,
      },);
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(scratch, { recursive: true, force: true, },);
    },
  };
}

/**
 Fingerprint of one input.

 @param fixture - fixture

 @param input - input

 @param environment - environment

 @returns fingerprint
 */
async function one({
  fixture,
  input,
  environment,
}: Readonly<{
  fixture: Fixture;
  input: PolicyInput;
  environment?: NodeJS.ProcessEnv;
}>,): Promise<unknown> {
  return (await fixture.fingerprint([input,], environment,)).get(policyInputKey(input,),);
}

await describe({
  name: fingerprintPolicyInputs.name,
  // One test sets GIT_LITERAL_PATHSPECS in this process, which every fingerprint Git inherits.
  concurrency: 1,
  children: [
    it({
      name: 'worktree: changes with tracked, untracked, and ignored matching files, and not with other files',
      fn: async function testWorktree(): Promise<void> {
        await using fixture = await createFixture();
        /** Input over tracked and ignored rules. */
        const input: PolicyInput = { kind: 'worktree', pathspecs: ['rules.txt', 'rules.*.txt',], };
        /** Initial fingerprint. */
        const initial = await one({ fixture, input, },);
        await writeFile(join(fixture.root, 'unrelated.txt',), 'x\n',);
        expect(await one({ fixture, input, },),).toBe(initial,);
        await writeFile(join(fixture.root, 'rules.txt',), 'changed\n',);
        /** After a tracked edit. */
        const tracked = await one({ fixture, input, },);
        expect(tracked,).not.toBe(initial,);
        await writeFile(join(fixture.root, 'rules.extra.txt',), 'untracked\n',);
        /** After an untracked match appeared. */
        const untracked = await one({ fixture, input, },);
        expect(untracked,).not.toBe(tracked,);
        await writeFile(join(fixture.root, 'rules.local.txt',), 'ignored\n',);
        /** After an ignored match appeared. */
        const ignored = await one({ fixture, input, },);
        expect(ignored,).not.toBe(untracked,);
        await writeFile(join(fixture.root, 'rules.local.txt',), 'ignored edit\n',);
        expect(await one({ fixture, input, },),).not.toBe(ignored,);
        await rm(join(fixture.root, 'rules.txt',),);
        expect(String(await one({ fixture, input, },),),).toContain('"rules.txt","missing"',);
      },
    },),
    it({
      name: 'worktree: a literal absolute pathspec inside the repository works, and one outside is unavailable',
      fn: async function testWorktreeLiteral(): Promise<void> {
        await using fixture = await createFixture();
        await writeFile(join(fixture.root, 'x.local.txt',), 'a\n',);
        /** Absolute literal input. */
        const inside: PolicyInput = { kind: 'worktree', pathspecs: [`:(literal)${join(fixture.root, 'x.local.txt',)}`,], };
        /** Before. */
        const before = await one({ fixture, input: inside, },);
        expect(String(before,),).toContain('x.local.txt',);
        await writeFile(join(fixture.root, 'x.local.txt',), 'b\n',);
        expect(await one({ fixture, input: inside, },),).not.toBe(before,);
        expect(await one({ fixture, input: { kind: 'worktree', pathspecs: [`:(literal)${join(fixture.outside, 'rules.txt',)}`,], }, },),).toBe(FINGERPRINT_UNAVAILABLE,);
      },
    },),
    it({
      name: 'worktree: pathspec mode variables in the environment do not change matching',
      fn: async function testPathspecMode(): Promise<void> {
        await using fixture = await createFixture();
        /** Glob input. */
        const input: PolicyInput = { kind: 'worktree', pathspecs: ['rules.*',], };
        await writeFile(join(fixture.root, 'rules.a',), 'a\n',);
        /** Previous literal setting. */
        const previous = process.env.GIT_LITERAL_PATHSPECS;
        process.env.GIT_LITERAL_PATHSPECS = '1';
        /** Restores the setting when the test ends. */
        using _restore = {
          [Symbol.dispose]: function restore(): void {
            if (previous === undefined)
              delete process.env.GIT_LITERAL_PATHSPECS;
            else
              process.env.GIT_LITERAL_PATHSPECS = previous;
          },
        };
        expect(String(await one({ fixture, input, },),),).toContain('rules.a',);
      },
    },),
    it({
      name: 'executable: changes with content, modification time, and a retargeted link, and resolves PATH names',
      fn: async function testExecutable(): Promise<void> {
        await using fixture = await createFixture();
        /** Scanner in a PATH directory. */
        const scanner = join(fixture.outside, 'scanner',);
        await writeFile(scanner, '#!/bin/true\none\n',);
        await chmod(scanner, 0o755,);
        /** Input by name. */
        const byName: PolicyInput = { kind: 'executable', path: 'scanner', };
        /** PATH environment. */
        const environment = { PATH: `/nonexistent-dir:${fixture.outside}`, };
        /** Initial fingerprint. */
        const initial = await one({ fixture, input: byName, environment, },);
        expect(String(initial,),).toContain(scanner,);
        expect(await one({ fixture, input: byName, environment, },),).toBe(initial,);
        await writeFile(scanner, '#!/bin/true\ntwo\n',);
        await utimes(scanner, new Date(1_000_000,), new Date(1_000_000,),);
        /** After a content change with a reset time. */
        const edited = await one({ fixture, input: byName, environment, },);
        expect(edited,).not.toBe(initial,);
        await utimes(scanner, new Date(2_000_000,), new Date(2_000_000,),);
        expect(await one({ fixture, input: byName, environment, },),).not.toBe(edited,);
        // A relative path resolves from the worktree root; retargeting its link changes the fingerprint.
        /** Second target. */
        const other = join(fixture.outside, 'other',);
        await writeFile(other, '#!/bin/true\nother\n',);
        await chmod(other, 0o755,);
        await symlink(scanner, join(fixture.root, 'tool',),);
        /** Relative input. */
        const relative: PolicyInput = { kind: 'executable', path: './tool', };
        /** Through the first link. */
        const linked = await one({ fixture, input: relative, },);
        expect(String(linked,),).toContain(scanner,);
        await rm(join(fixture.root, 'tool',),);
        await symlink(other, join(fixture.root, 'tool',),);
        expect(await one({ fixture, input: relative, },),).not.toBe(linked,);
        // A missing executable fingerprints as missing, so its appearance changes it.
        expect(await one({ fixture, input: { kind: 'executable', path: 'absent-scanner', }, environment, },),).toBe('["missing"]',);
      },
    },),
    it({
      name: 'revision: changes when the ref moves, reports absence, and stays equal otherwise',
      fn: async function testRevision(): Promise<void> {
        await using fixture = await createFixture();
        /** Input on HEAD. */
        const head: PolicyInput = { kind: 'revision', rev: 'HEAD', };
        /** Absent input. */
        const absent: PolicyInput = { kind: 'revision', rev: 'refs/heads/absent', };
        /** Initial fingerprints. */
        const initial = await fixture.fingerprint([head, absent,],);
        expect(initial.get(policyInputKey(head,),),).toBe(JSON.stringify([await fixture.git(['rev-parse', 'HEAD',],),],),);
        expect(String(initial.get(policyInputKey(absent,),),),).toContain('missing',);
        expect(await fixture.fingerprint([head, absent,],),).toEqual(initial,);
        await fixture.git(['commit', '--quiet', '--allow-empty', '-m', 'next',],);
        /** After the ref moved. */
        const moved = await fixture.fingerprint([head, absent,],);
        expect(moved.get(policyInputKey(head,),),).not.toBe(initial.get(policyInputKey(head,),),);
        expect(moved.get(policyInputKey(absent,),),).toBe(initial.get(policyInputKey(absent,),),);
      },
    },),
    it({
      name: 'env: changes with the value and its absence',
      fn: async function testEnv(): Promise<void> {
        await using fixture = await createFixture();
        /** Input. */
        const input: PolicyInput = { kind: 'env', name: 'RULES', };
        expect(await one({ fixture, input, environment: { RULES: 'a', }, },),).toBe('["a"]',);
        expect(await one({ fixture, input, environment: { RULES: 'b', }, },),).toBe('["b"]',);
        expect(await one({ fixture, input, environment: {}, },),).toBe('[null]',);
        expect(await one({ fixture, input, environment: { RULES: '', }, },),).toBe('[""]',);
      },
    },),
    it({
      name: 'fingerprints each distinct input once and marks revisions unavailable when Git fails',
      fn: async function testDistinct(): Promise<void> {
        await using fixture = await createFixture();
        /** Repeated inputs. */
        const fingerprints = await fixture.fingerprint([{ kind: 'env', name: 'A', }, { kind: 'env', name: 'A', }, { kind: 'env', name: 'B', },], { A: 'a', },);
        expect(fingerprints.size,).toBe(2,);
        /** Revision against a missing shadow. */
        const broken = await fingerprintPolicyInputs({
          location: { gitPath: REAL_GIT, repositoryRoot: fixture.root, shadowPath: join(fixture.outside, 'no-shadow',), environment: {}, },
          inputs: [{ kind: 'revision', rev: 'HEAD', },],
        },);
        expect([...broken.values(),],).toEqual([FINGERPRINT_UNAVAILABLE,],);
      },
    },),
  ],
},);
