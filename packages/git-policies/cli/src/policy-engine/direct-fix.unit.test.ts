/**
 * Direct worktree policy-fix integration tests.
 *
 * @module
 */
import {
  mkdtemp,
  readFile,
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
import { runManagementCommand, } from '../management.ts';
import { createFinalNewlinePatch, } from './final-newline-patch.ts';
import { runDirectFix, } from './direct-fix.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/** Real Git executable for disposable fixture setup and assertions. */
const REAL_GIT = '/usr/bin/git';
/** Text fixture encoder shared by synthetic fixable policies. */
const ENCODER = new TextEncoder();
/** Text fixture decoder shared by synthetic fixable policies. */
const DECODER = new TextDecoder();
/** Changed passes accepted before stable direct-fix convergence. */
const CONVERGENCE_PASSES = 8;
/** Changed passes requiring one pass beyond bounded convergence. */
const EXCESS_PASSES = CONVERGENCE_PASSES + 1;

/** Disposable direct-fix repository. */
type DirectFixFixture = Readonly<{
  /** Repository root. */
  repository: string;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Runs real Git in fixture repository.
 *
 * @param repository - fixture repository root
 *
 * @param args - exact Git arguments
 */
async function git({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<void> {
  await nanoSpawn(
    REAL_GIT,
    args,
    { cwd: repository, },
  );
}

/**
 * Creates committed two-file direct-fix fixture.
 *
 * @returns disposable fixture
 */
async function createFixture(): Promise<DirectFixFixture> {
  /** Disposable repository root. */
  const repository = await mkdtemp(join(tmpdir(), 'cli-git-direct-fix-',),);
  await git({ repository, args: ['init', '--quiet', '--initial-branch=main',], },);
  await git({ repository, args: ['config', 'user.email', 'fixture@example.invalid',], },);
  await git({ repository, args: ['config', 'user.name', 'Fixture',], },);
  await writeFile(join(repository, 'one.txt',), 'one\n',);
  await writeFile(join(repository, 'two.txt',), 'two\n',);
  await git({ repository, args: ['add', 'one.txt', 'two.txt',], },);
  await git({ repository, args: ['commit', '--quiet', '--message=baseline',], },);
  return {
    repository,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(repository, { recursive: true, force: true, },);
    },
  };
}

/**
 * Creates policy replacing one exact text state with another.
 *
 * @param name - fixture policy identity
 *
 * @param from - exact source text eligible for replacement
 *
 * @param to - exact replacement text
 *
 * @param targetId - optional intentionally overridden patch target
 *
 * @returns synthetic fixable policy
 */
function createReplacementPolicy({
  name,
  from,
  to,
  targetId,
}: Readonly<{
  name: string;
  from: string;
  to: string;
  targetId?: string;
}>,): RuntimePolicyDefinition {
  return {
    name,
    defaultSeverity: 'error',
    warnSafe: false,
    triggers: ['direct-fix',],
    async check({ context, }) {
      /** Findings from all exact selected candidates. */
      const findings = await Promise.all((await context.git.candidates()).map(async function replacementFinding(selected,) {
        if (((typeof selected.revision) === 'symbol')
          || ((selected.mode !== 'regular') && (selected.mode !== 'executable')))
          return [];
        /** Exact current candidate bytes. */
        const original = await selected.bytes();
        if (DECODER.decode(original,) !== from)
          return [];
        return [{
          code: name,
          message: `Replace ${from} with ${to}.`,
          path: selected.path,
          patch: createFinalNewlinePatch({
            targetId: targetId ?? selected.targetId,
            path: selected.path,
            revision: selected.revision,
            mode: selected.mode,
            original,
            replacement: ENCODER.encode(to,),
          },),
        },];
      },),);
      return findings.flat();
    },
  };
}

/**
 * Creates numeric policy requiring specified changed candidate passes.
 *
 * @param name - fixture policy identity
 *
 * @param stableAt - first stable numeric state
 *
 * @returns synthetic bounded-convergence policy
 */
function createIncrementPolicy({
  name,
  stableAt,
}: Readonly<{
  name: string;
  stableAt: number;
}>,): RuntimePolicyDefinition {
  return {
    name,
    defaultSeverity: 'error',
    warnSafe: false,
    triggers: ['direct-fix',],
    async check({ context, }) {
      /** Findings from every selected numeric fixture candidate. */
      const findings = await Promise.all((await context.git.candidates()).map(async function incrementFinding(selected,) {
        if (((typeof selected.revision) === 'symbol')
          || ((selected.mode !== 'regular') && (selected.mode !== 'executable')))
          return [];
        /** Exact current candidate bytes. */
        const original = await selected.bytes();
        /** Current numeric fixture state. */
        const current = Number(DECODER.decode(original,).trim());
        if (current >= stableAt)
          return [];
        /** Next numeric fixture state. */
        const replacement = ENCODER.encode(`${String(current + 1,)}\n`,);
        return [{
          code: 'increment',
          message: 'Advance candidate toward stable fixture state.',
          path: selected.path,
          patch: createFinalNewlinePatch({
            targetId: selected.targetId,
            path: selected.path,
            revision: selected.revision,
            mode: selected.mode,
            original,
            replacement,
          },),
        },];
      },),);
      return findings.flat();
    },
  };
}

/** Synthetic policy requiring exactly bounded changed candidate passes. */
const eightPassPolicy = createIncrementPolicy({
  name: 'eight-pass',
  stableAt: CONVERGENCE_PASSES,
},);

/** Synthetic policy exceeding bounded changed candidate passes. */
const ninePassPolicy = createIncrementPolicy({
  name: 'nine-pass',
  stableAt: EXCESS_PASSES,
},);

await describe({
  name: 'direct policy fix',
  children: [
    it({
      name: 'fixes explicit paths then all scope without changing index',
      fn: async function testDirectFixScopes() {
        await using fixture = await createFixture();
        /** Exact real index bytes before direct worktree fixes. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        await writeFile(join(fixture.repository, 'one.txt',), 'one',);
        await writeFile(join(fixture.repository, 'two.txt',), 'two',);
        expect(await runManagementCommand({
          args: [
            'fix',
            '--policy',
            'final-newline',
            '--',
            'one.txt',
          ],
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
        },),).toBe(0,);
        expect(await readFile(join(fixture.repository, 'one.txt',), 'utf8',),).toBe('one\n',);
        expect(await readFile(join(fixture.repository, 'two.txt',), 'utf8',),).toBe('two',);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
        expect(await runManagementCommand({
          args: [
            'fix',
            '--all',
          ],
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
        },),).toBe(0,);
        expect(await readFile(join(fixture.repository, 'two.txt',), 'utf8',),).toBe('two\n',);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
      },
    },),
    it({
      name: 'converges after eight changed passes with only ordered final summary',
      fn: async function testEightPassConvergence() {
        await using fixture = await createFixture();
        /** Exact real index bytes before convergent policy evaluation. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        await writeFile(join(fixture.repository, 'one.txt',), '0\n',);
        await writeFile(join(fixture.repository, 'two.txt',), '0\n',);
        /** Stable eight-pass direct-fix result over reverse requested paths. */
        const result = await runDirectFix({
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
          pathspecs: [
            'two.txt',
            'one.txt',
          ],
          policyOptions: {
            registeredPolicies: [eightPassPolicy,],
          },
        },);
        expect(result.policyResult.exitCode,).toBe(0,);
        expect(result.policyResult.events,).toEqual([{
          schemaVersion: 1,
          sequence: 0,
          type: 'fix-summary',
          trigger: 'direct-fix',
          passes: CONVERGENCE_PASSES,
          changedPaths: [
            'one.txt',
            'two.txt',
          ],
        },],);
        expect(result.changedPaths,).toEqual([
          'one.txt',
          'two.txt',
        ],);
        expect(await readFile(join(fixture.repository, 'one.txt',), 'utf8',),).toBe('8\n',);
        expect(await readFile(join(fixture.repository, 'two.txt',), 'utf8',),).toBe('8\n',);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
      },
    },),
    it({
      name: 'rejects patch targeting undeclared candidate without changing worktree or index',
      fn: async function testInvalidPatchTarget() {
        await using fixture = await createFixture();
        /** Exact worktree bytes before invalid patch. */
        const worktreeBefore = await readFile(join(fixture.repository, 'one.txt',),);
        /** Exact real index bytes before invalid patch. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        /** Policy proposing patch for unknown target identity. */
        const invalidTargetPolicy = createReplacementPolicy({
          name: 'invalid-target',
          from: 'one\n',
          to: 'other\n',
          targetId: 'undeclared-target',
        },);
        /** Failed direct-fix result for invalid target. */
        const result = await runDirectFix({
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
          pathspecs: ['one.txt',],
          policyOptions: {
            registeredPolicies: [invalidTargetPolicy,],
          },
        },);
        expect(result.policyResult.exitCode,).toBe(2,);
        expect(result.policyResult.events[0],).toMatchObject({
          type: 'engine-failure',
          code: 'patch-invalid',
          trigger: 'direct-fix',
          path: 'one.txt',
        },);
        expect(
          await readFile(join(fixture.repository, 'one.txt',),),
        ).toEqual(worktreeBefore,);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
      },
    },),
    it({
      name: 'rejects ninth changed pass without changing worktree or index',
      fn: async function testPassLimit() {
        await using fixture = await createFixture();
        await writeFile(join(fixture.repository, 'one.txt',), '0\n',);
        /** Exact worktree bytes before bounded failure. */
        const worktreeBefore = await readFile(join(fixture.repository, 'one.txt',),);
        /** Exact real index bytes before bounded failure. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        /** Failed direct-fix result exceeding changed-pass bound. */
        const result = await runDirectFix({
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
          pathspecs: ['one.txt',],
          policyOptions: {
            registeredPolicies: [ninePassPolicy,],
          },
        },);
        expect(result.policyResult.exitCode,).toBe(2,);
        expect(result.policyResult.events[0],).toMatchObject({
          type: 'engine-failure',
          code: 'fix-pass-limit',
          trigger: 'direct-fix',
        },);
        expect(
          await readFile(join(fixture.repository, 'one.txt',),),
        ).toEqual(worktreeBefore,);
        expect(
          await readFile(join(fixture.repository, '.git/index',),),
        ).toEqual(indexBefore,);
      },
    },),
    it({
      name: 'rejects cross-policy candidate-state cycle without changing worktree',
      fn: async function testDirectFixCycle() {
        await using fixture = await createFixture();
        /** Exact real index bytes before cyclic policy evaluation. */
        const indexBefore = await readFile(join(fixture.repository, '.git/index',),);
        /** Exact original worktree bytes that cycle must preserve. */
        const worktreeBefore = await readFile(join(fixture.repository, 'one.txt',),);
        /** First policy producing intermediate cyclic state. */
        const forwardPolicy = createReplacementPolicy({
          name: 'forward',
          from: 'one\n',
          to: 'other\n',
        },);
        /** Second policy restoring original cyclic state. */
        const reversePolicy = createReplacementPolicy({
          name: 'reverse',
          from: 'other\n',
          to: 'one\n',
        },);
        /** Failed cyclic direct-fix result. */
        const result = await runDirectFix({
          gitGlobalArgs: [
            '-C',
            fixture.repository,
          ],
          pathspecs: ['one.txt',],
          policyOptions: {
            registeredPolicies: [
              forwardPolicy,
              reversePolicy,
            ],
          },
        },);
        expect(result.policyResult.exitCode,).toBe(2,);
        expect(result.policyResult.events[0],).toMatchObject({
          type: 'engine-failure',
          code: 'fix-cycle',
          trigger: 'direct-fix',
          message: 'Policy patches entered a repeated candidate-state cycle.',
        },);
        /** Worktree bytes after rejected cycle. */
        const worktreeAfter = await readFile(join(fixture.repository, 'one.txt',),);
        /** Real index bytes after rejected cycle. */
        const indexAfter = await readFile(join(fixture.repository, '.git/index',),);
        expect(worktreeAfter,).toEqual(worktreeBefore,);
        expect(indexAfter,).toEqual(indexBefore,);
      },
    },),
  ],
},);
