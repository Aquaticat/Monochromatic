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
import {
  POST_COMMIT_LIFECYCLE_DEPENDENCIES,
  runPostCommitLifecycle,
} from './post-commit-lifecycle.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/** Absolute real Git executable. */
const realGitPath = await resolveGit();
/** Expected landed file contents. */
const LANDED_CONTENT = 'landed content\n';

/** Disposable repository fixture. */
type RepositoryFixture = Readonly<{
  /** Repository root. */
  path: string;
  /** Removes repository after test. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/** Policy validating exact landed OID and committed bytes. */
const GROUND_TRUTH_POLICY: RuntimePolicyDefinition = {
  name: 'fixture/ground-truth',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['post-commit',],
  check: async function checkGroundTruth({ context, }) {
    /** Exact landed object ID. */
    const landedOid = await context.git.landedCommitOid();
    if ((typeof landedOid) === 'symbol')
      return [{ code: 'oid-absent', message: 'Landed OID was absent.', },];
    /** Complete landed tree candidates. */
    const candidates = await context.git.candidates();
    const landedFile = candidates.find(function isLandedFile(candidate,) {
      return candidate.path === 'landed.txt';
    },);
    if (landedFile === undefined)
      return [{ code: 'file-absent', message: 'Landed file was absent.', },];
    /** Stable file retained from parent commit. */
    const stableFile = candidates.find(function isStableFile(candidate,) {
      return candidate.path === 'stable.txt';
    },);
    if ((landedFile.change !== 'modified') || (stableFile?.change !== 'unchanged'))
      return [{ code: 'change-wrong', message: 'Landed change classification differs.', },];
    /** Exact committed file bytes. */
    const contents = new TextDecoder().decode(await landedFile.bytes(),);
    return contents === LANDED_CONTENT
      ? []
      : [{ code: 'bytes-differ', message: 'Committed bytes differ.', },];
  },
};
/** Policy blocking automatic backup after commit. */
const BLOCK_POLICY: RuntimePolicyDefinition = {
  name: 'fixture/block',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['post-commit',],
  check: function blockBackup() {
    return Promise.resolve([{ code: 'backup-blocked', message: 'Fixture blocked backup.', },],);
  },
};
/** Policy failing post-commit engine completion. */
const THROW_POLICY: RuntimePolicyDefinition = {
  name: 'fixture/throw',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['post-commit',],
  check: function throwDuringGate() {
    return Promise.reject(new Error('fixture post-commit failure',),);
  },
};

/**
 * Creates repository with one real landed commit.
 *
 * @returns disposable committed repository
 */
async function createRepository(): Promise<RepositoryFixture> {
  /** Disposable repository root. */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-post-commit-',),);
  await nanoSpawn(realGitPath, ['init', '--quiet',], { cwd: path, },);
  await nanoSpawn(realGitPath, ['config', 'user.email', 'cli-git@example.invalid',], { cwd: path, },);
  await nanoSpawn(realGitPath, ['config', 'user.name', 'cli-git fixture',], { cwd: path, },);
  await writeFile(join(path, 'stable.txt',), 'stable content\n',);
  await nanoSpawn(realGitPath, ['add', 'stable.txt',], { cwd: path, },);
  await nanoSpawn(realGitPath, ['commit', '--quiet', '-m', 'baseline',], { cwd: path, },);
  await writeFile(join(path, 'landed.txt',), LANDED_CONTENT,);
  await nanoSpawn(realGitPath, ['add', 'landed.txt',], { cwd: path, },);
  await nanoSpawn(realGitPath, ['commit', '--quiet', '-m', 'landed',], { cwd: path, },);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: 'post-commit lifecycle',
  children: [
    it({
      name: 'checks exact landed tree before allowing backup',
      fn: async function testLandedGroundTruth() {
        await using repository = await createRepository();
        /** Settled clean post-commit gate. */
        const result = await runPostCommitLifecycle({
          rawArgs: ['commit', '-m', 'landed', 'landed.txt',],
          transformedArgs: ['commit', '-o', '-m', 'landed', 'landed.txt',],
          gitPath: realGitPath,
          cwd: repository.path,
          registeredPolicies: [GROUND_TRUTH_POLICY,],
        },);
        expect(result.blocked,).toBe(false,);
        expect(result.events,).toEqual([],);
      },
    },),
    it({
      name: 'blocks backup with explicit landed commit event',
      fn: async function testBlockedBackup() {
        await using repository = await createRepository();
        /** Settled blocked post-commit gate. */
        const result = await runPostCommitLifecycle({
          rawArgs: ['commit', 'landed.txt',],
          transformedArgs: ['commit', '-o', 'landed.txt',],
          gitPath: realGitPath,
          cwd: repository.path,
          registeredPolicies: [BLOCK_POLICY,],
        },);
        expect(result.blocked,).toBe(true,);
        expect(result.events[0]?.type,).toBe('finding',);
        expect(result.events[1],).toEqual({
          schemaVersion: 1,
          sequence: 1,
          type: 'commit-landed',
          oid: result.oid,
          outcome: 'post-commit-blocked',
          message: `Commit ${result.oid} remains local; post-commit gate blocked automatic backup.`,
        },);
      },
    },),
    it({
      name: 'allows warning-only post-commit result',
      fn: async function testWarningBackup() {
        await using repository = await createRepository();
        /** Warning-only post-commit gate. */
        const result = await runPostCommitLifecycle({
          rawArgs: ['commit', 'landed.txt',],
          transformedArgs: ['commit', '-o', 'landed.txt',],
          gitPath: realGitPath,
          cwd: repository.path,
          policySeverities: { 'fixture/block': 'warn', },
          registeredPolicies: [BLOCK_POLICY,],
        },);
        expect(result.blocked,).toBe(false,);
        expect(result.events.map(function eventType(event,) {
          return event.type;
        },),).toEqual(['finding', 'configuration-warning',],);
      },
    },),
    it({
      name: 'retains commit after post-commit engine failure',
      fn: async function testEngineFailure() {
        await using repository = await createRepository();
        /** Failed post-commit gate. */
        const result = await runPostCommitLifecycle({
          rawArgs: ['commit', 'landed.txt',],
          transformedArgs: ['commit', '-o', 'landed.txt',],
          gitPath: realGitPath,
          cwd: repository.path,
          registeredPolicies: [THROW_POLICY,],
        },);
        expect(result.blocked,).toBe(true,);
        expect(result.events.map(function eventType(event,) {
          return event.type;
        },),).toEqual(['engine-failure', 'commit-landed',],);
      },
    },),
    it({
      name: 'renders setup failure with known landed commit',
      fn: async function testSetupFailure() {
        await using repository = await createRepository();
        /** Setup failure after landed OID resolution. */
        const result = await runPostCommitLifecycle({
          rawArgs: ['commit', 'landed.txt',],
          transformedArgs: ['commit', '-o', 'landed.txt',],
          gitPath: realGitPath,
          cwd: repository.path,
          dependencies: {
            ...POST_COMMIT_LIFECYCLE_DEPENDENCIES,
            resolvePostCommitRepositoryRoot: function failRootResolution() {
              return Promise.reject(new Error('injected root failure',),);
            },
          },
        },);
        expect(result.blocked,).toBe(true,);
        expect(result.events,).toEqual([{
          schemaVersion: 1,
          sequence: 0,
          type: 'engine-failure',
          code: 'content-unavailable',
          message: 'injected root failure',
          trigger: 'post-commit',
        }, {
          schemaVersion: 1,
          sequence: 1,
          type: 'commit-landed',
          oid: result.oid,
          outcome: 'post-commit-blocked',
          message: `Commit ${result.oid} remains local; post-commit gate blocked automatic backup.`,
        },],);
      },
    },),
    it({
      name: 'honors full-lifecycle policy escape',
      fn: async function testPostCommitEscape() {
        await using repository = await createRepository();
        /** Escaped post-commit gate. */
        const result = await runPostCommitLifecycle({
          rawArgs: ['commit', '--no-enforce-fixture/block', 'landed.txt',],
          transformedArgs: ['commit', '-o', 'landed.txt',],
          gitPath: realGitPath,
          cwd: repository.path,
          registeredPolicies: [BLOCK_POLICY,],
        },);
        expect(result.blocked,).toBe(false,);
        expect(result.events,).toEqual([],);
      },
    },),
  ],
},);
