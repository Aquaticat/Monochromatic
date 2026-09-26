/**
 Reverse application of a landed text change, checked against real `git apply --reverse --check`.

 @module
 */
import { execFileSync, } from 'node:child_process';
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
  FIXED_IDENTITY,
  REAL_GIT,
} from './commit-landing-fixture.unit.test.ts';

const {
  parseIndexedPatch,
  reverseApplies,
} = internalTestExports;

/**
 Seeded cases compared against Git.
 */
const ORACLE_CASES = 400;

/**
 Lines the generator draws from; repeats make hunks match at several places, and one carries trailing whitespace.
 */
const ALPHABET = ['a\n', 'b\n', 'c\n', 'd\n', '\n', 'x\n', 'a \n',];

/**
 Scratch repository whose single file `f` the oracle patches.
 */
type OracleRepository = AsyncDisposable & Readonly<{
  /**
   Worktree.
   */
  path: string;
  /**
   Hermetic environment.
   */
  env: NodeJS.ProcessEnv;
}>;

/**
 Creates the oracle repository.

 @returns repository
 */
async function oracleRepository(): Promise<OracleRepository> {
  /** Worktree. */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-reverse-apply-',),);
  /** Hermetic environment. */
  const env = { ...process.env, ...FIXED_IDENTITY, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', };
  execFileSync(REAL_GIT, ['init', '--quiet', path,], { env, },);
  return {
    path,
    env,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Writes `base`, stages it, writes `landed`, and returns Git's patch of the landed change.

 @param repository - oracle repository

 @param base - base bytes

 @param landed - landed bytes

 @returns Latin-1 patch text
 */
async function landedPatch({
  repository,
  base,
  landed,
}: Readonly<{
  repository: OracleRepository;
  base: string;
  landed: string;
}>,): Promise<string> {
  await writeFile(join(repository.path, 'f',), Buffer.from(base, 'latin1',),);
  execFileSync(REAL_GIT, ['add', 'f',], { cwd: repository.path, env: repository.env, },);
  await writeFile(join(repository.path, 'f',), Buffer.from(landed, 'latin1',),);
  return execFileSync(REAL_GIT, ['diff', '--unified=3', '--no-color', '--', 'f',], { cwd: repository.path, env: repository.env, },)
    .toString('latin1',);
}

/**
 Real Git's verdict: whether the patch applies in reverse to `prepared`.

 @param repository - oracle repository

 @param patch - landed patch

 @param prepared - prepared bytes

 @returns whether `git apply --reverse --check` succeeds
 */
async function gitReverseApplies({
  repository,
  patch,
  prepared,
}: Readonly<{
  repository: OracleRepository;
  patch: string;
  prepared: string;
}>,): Promise<boolean> {
  await writeFile(join(repository.path, 'f',), Buffer.from(prepared, 'latin1',),);
  await writeFile(join(repository.path, 'landed.patch',), Buffer.from(patch, 'latin1',),);
  try {
    execFileSync(REAL_GIT, ['apply', '--reverse', '--check', 'landed.patch',], { cwd: repository.path, env: repository.env, stdio: 'ignore', },);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('status' in error) && (error.status === 1))
      return false;
    throw error;
  }
}

/**
 Our verdict for the same patch.

 @param patch - landed patch

 @param prepared - prepared bytes

 @returns whether every hunk applies in reverse
 */
function ourVerdict({
  patch,
  prepared,
}: Readonly<{
  patch: string;
  prepared: string;
}>,): boolean {
  return reverseApplies({ hunks: parseIndexedPatch(patch,).get('f',) ?? [], prepared, },);
}

/**
 Deterministic 32-bit generator (mulberry32).

 @param seed - seed

 @returns next-value function in `[0, 1)`
 */
function seeded(seed: number,): () => number {
  /** Generator state. */
  const state = { value: seed >>> 0, };
  return function next(): number {
    state.value = (state.value + 0x6D_2B_79_F5) >>> 0;
    /** Mixed bits. */
    const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value,);
    /** Further mixed bits. */
    const more = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed,)) ^ mixed;
    return ((more ^ (more >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 Random lines.

 @param random - generator

 @param count - line count

 @returns lines
 */
function randomLines({
  random,
  count,
}: Readonly<{
  random: () => number;
  count: number;
}>,): readonly string[] {
  return Array.from({ length: count, }, function line(): string {
    return ALPHABET[Math.floor(random() * ALPHABET.length,)] ?? 'a\n';
  },);
}

/**
 Applies one random replace, insert, or delete of up to two lines.

 @param random - generator

 @param lines - input lines

 @returns edited lines
 */
function mutate({
  random,
  lines,
}: Readonly<{
  random: () => number;
  lines: readonly string[];
}>,): readonly string[] {
  /** Edit position. */
  const at = Math.floor(random() * (lines.length + 1),);
  /** Removed line count. */
  const removed = Math.floor(random() * 3,);
  return [...lines.slice(0, at,), ...randomLines({ random, count: Math.floor(random() * 3,), },), ...lines.slice(at + removed,),];
}

/**
 Joins lines, sometimes dropping the final newline.

 @param random - generator

 @param lines - lines

 @returns text
 */
function joined({
  random,
  lines,
}: Readonly<{
  random: () => number;
  lines: readonly string[];
}>,): string {
  /** Text with every newline. */
  const text = lines.join('',);
  return (random() < 0.2) && text.endsWith('\n',) ? text.slice(0, -1,) : text;
}

await describe({
  name: 'reverse application of a landed change',
  children: [
    it({
      name: 'an adjacent edit on top of the landed change still contains it',
      fn: async function testAdjacent(): Promise<void> {
        /** Landed change of line 2. */
        const patch = 'diff --git a/0 b/0\nindex 1..2 100644\n--- a/0\n+++ b/0\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n';
        expect(ourVerdict({ patch: patch.replaceAll('/0', '/f',), prepared: 'a\nB\nc\nd\n', },),).toBe(true,);
        expect(reverseApplies({ hunks: parseIndexedPatch(patch,).get('0',) ?? [], prepared: 'a\nB\nC\n', },),).toBe(false,);
      },
    },),
    it({
      name: 'reads an empty context line written under diff.suppressBlankEmpty and an incomplete last line',
      fn: async function testSuppressBlankEmpty(): Promise<void> {
        /** Hunk with a bare empty context line and an incomplete new last line. */
        const hunks = parseIndexedPatch('diff --git a/0 b/0\n@@ -1,3 +1,3 @@\n a\n\n-b\n\\ No newline at end of file\n+B\n\\ No newline at end of file\n',).get('0',) ?? [];
        expect(hunks[0]?.lines,).toEqual([{ op: ' ', text: 'a\n', }, { op: ' ', text: '\n', }, { op: '-', text: 'b', }, { op: '+', text: 'B', },],);
        expect(reverseApplies({ hunks, prepared: 'a\n\nB', },),).toBe(true,);
        expect(reverseApplies({ hunks, prepared: 'a\n\nB\n', },),).toBe(false,);
      },
    },),
    it({
      name: 'rejects a truncated hunk and a line without a diff marker',
      fn: async function testMalformed(): Promise<void> {
        expect(function truncated() {
          parseIndexedPatch('diff --git a/0 b/0\n@@ -1,2 +1,2 @@\n a\n',);
        },).toThrow('truncated',);
        expect(function unmarked() {
          parseIndexedPatch('diff --git a/0 b/0\n@@ -1 +1 @@\n?a\n',);
        },).toThrow('no diff marker',);
      },
    },),
    it({
      name: `agrees with git apply --reverse --check on ${String(ORACLE_CASES,)} seeded cases`,
      fn: async function testOracle(): Promise<void> {
        await using repository = await oracleRepository();
        /** Generator. */
        const random = seeded(560,);
        /** Cases where the verdicts differ. */
        const disagreements: string[] = [];
        /** Verdict counts, so the corpus is shown to exercise both outcomes. */
        const verdicts = { applies: 0, rejected: 0, };
        for (let index = 0; index < ORACLE_CASES; index += 1) {
          /** Base lines. */
          const baseLines = randomLines({ random, count: Math.floor(random() * 12,), },);
          /** Landed lines. */
          const landedLines = mutate({ random, lines: mutate({ random, lines: baseLines, },), },);
          /** Base and landed texts. */
          const [base, landed,] = [joined({ random, lines: baseLines, },), joined({ random, lines: landedLines, },),];
          if (base === landed)
            continue;
          /** Prepared text: the landed text edited again, or the base edited independently. */
          const prepared = joined({ random, lines: mutate({ random, lines: random() < 0.6 ? landedLines : baseLines, },), },);
          // oxlint-disable-next-line no-await-in-loop -- The oracle repository holds one file at a time.
          const patch = await landedPatch({ repository, base, landed, },);
          // oxlint-disable-next-line no-await-in-loop -- The oracle repository holds one file at a time.
          const expected = await gitReverseApplies({ repository, patch, prepared, },);
          verdicts[expected ? 'applies' : 'rejected'] += 1;
          if (ourVerdict({ patch, prepared, },) !== expected)
            disagreements.push(JSON.stringify({ base, landed, prepared, expected, },),);
        }
        expect(disagreements,).toEqual([],);
        expect(verdicts.applies,).toBeGreaterThan(10,);
        expect(verdicts.rejected,).toBeGreaterThan(10,);
      },
    },),
  ],
},);
