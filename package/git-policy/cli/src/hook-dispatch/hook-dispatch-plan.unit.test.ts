/**
 Hook dispatch plan: config parameter quoting read back by real Git, and plan facts from disposable repositories.

 @module
 */
import {
  mkdtemp,
  rm,
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
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  combineConfigParameters,
  computeHookDispatchPlan,
  globalConfigOverrides,
  quoteConfigParameter,
} = internalTestExports;

/**
 Absolute real Git executable.
 */
const REAL_GIT = await resolveRealGit();

/**
 Environment isolating fixture Git from host configuration.
 */
const ISOLATED_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

/**
 Disposable repository.

 @returns repository root and disposer
 */
async function createRepository(): Promise<AsyncDisposable & Readonly<{ path: string; }>> {
  /**
   Repository root.
   */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-plan-',),);
  await nanoSpawn(REAL_GIT, ['init', '--quiet', path,], { env: ISOLATED_ENV, },);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Computes a plan with test defaults.

 @param path - repository root

 @param globalArgs - caller global options

 @param environment - caller environment

 @param concurrentCommits - `hooks.concurrentCommits`

 @param inheritedLeaseValid - whether an outer lease is valid

 @returns plan
 */
function planFor({
  path,
  globalArgs = [],
  environment = {},
  concurrentCommits = false,
  inheritedLeaseValid = false,
}: Readonly<{
  path: string;
  globalArgs?: readonly string[];
  environment?: NodeJS.ProcessEnv;
  concurrentCommits?: boolean;
  inheritedLeaseValid?: boolean;
}>,): ReturnType<typeof computeHookDispatchPlan> {
  return computeHookDispatchPlan({
    gitPath: REAL_GIT,
    cwd: path,
    globalArgs,
    commonDir: join(path, '.git',),
    worktreeRoot: path,
    lease: 'lease',
    concurrentCommits,
    inheritedLeaseValid,
    environment,
  },);
}

/**
 Sets one repository config value.

 @param path - repository root

 @param key - config key

 @param value - config value
 */
async function setConfig({
  path,
  key,
  value,
}: Readonly<{
  path: string;
  key: string;
  value: string;
}>,): Promise<void> {
  await nanoSpawn(REAL_GIT, ['-C', path, 'config', key, value,], { env: ISOLATED_ENV, },);
}

await describe({
  name: 'hook dispatch plan',
  children: [
    it({
      name: `${quoteConfigParameter.name} values read back verbatim by Git through GIT_CONFIG_PARAMETERS`,
      fn: async function testQuotingRoundTrip(): Promise<void> {
        /** Adversarial values: quotes, bang, spaces, equals, backslash, dollar, newline. */
        const values = ['O\'Brien', 'bang!bang', ' spaced value ', 'a=b=c', String.raw`back\slash`, '$HOME `x`', 'line\nbreak',];
        /** Values Git reads back. */
        const readBack = await Promise.all(values.map(async function readValue(value, index,): Promise<string> {
          /** Key unique per value. */
          const key = `fixture.value${String(index,)}`;
          return (await nanoSpawn(REAL_GIT, ['config', '--get', key,], {
            env: { ...ISOLATED_ENV, GIT_CONFIG_PARAMETERS: quoteConfigParameter(`${key}=${value}`,), },
          },)).stdout;
        },),);
        expect(readBack,).toEqual(values,);
      },
    },),
    it({
      name: `${combineConfigParameters.name} keeps absence distinct from empty and puts inherited entries before command-line options`,
      fn: async function testCombine(): Promise<void> {
        expect(combineConfigParameters({ inherited: '', overrides: [], },),).toEqual({ kind: 'absent', },);
        expect(combineConfigParameters({ inherited: '\'a.b=1\'', overrides: [], },),).toEqual({ kind: 'present', value: '\'a.b=1\'', },);
        expect(combineConfigParameters({ inherited: '\'a.b=1\'', overrides: ['c.d=2',], },),).toEqual({ kind: 'present', value: '\'a.b=1\' \'c.d=2\'', },);
        expect(globalConfigOverrides(['-c', 'a.b=1', '--no-pager', '-c', 'c.d=2', '-c',],),).toEqual(['a.b=1', 'c.d=2',],);
      },
    },),
    it({
      name: 'an unset core.hooksPath resolves to the common hooks directory with no disabled events and the hook lock held',
      fn: async function testDefaults(): Promise<void> {
        await using repository = await createRepository();
        /** Plan. */
        const plan = await planFor({ path: repository.path, },);
        expect({
          hooksPath: plan.hooksPath,
          disabledEvents: plan.disabledEvents,
          configParameters: plan.configParameters,
          hookLockPath: plan.hookLockPath,
          skipHookLock: plan.skipHookLock,
          worktreeRoot: plan.worktreeRoot,
        },).toEqual({
          hooksPath: join(repository.path, '.git', 'hooks',),
          disabledEvents: [],
          configParameters: { kind: 'absent', },
          hookLockPath: join(repository.path, '.git', 'cli-git', 'hook.lock',),
          skipHookLock: false,
          worktreeRoot: repository.path,
        },);
      },
    },),
    it({
      name: 'a relative core.hooksPath resolves against the worktree root and an absolute one is kept',
      fn: async function testHooksPath(): Promise<void> {
        await using repository = await createRepository();
        await setConfig({ path: repository.path, key: 'core.hooksPath', value: 'tools/hooks', },);
        expect((await planFor({ path: repository.path, },)).hooksPath,).toBe(join(repository.path, 'tools', 'hooks',),);
        await setConfig({ path: repository.path, key: 'core.hooksPath', value: '/opt/hooks', },);
        expect((await planFor({ path: repository.path, },)).hooksPath,).toBe('/opt/hooks',);
        // A global -c override wins over repository configuration, as it does for native Git.
        expect((await planFor({ path: repository.path, globalArgs: ['-c', 'core.hooksPath=/cli/hooks',], },)).hooksPath,).toBe('/cli/hooks',);
      },
    },),
    it({
      name: 'events disabled through hook.<event>.enabled are recorded, and enabled or unset ones are not',
      fn: async function testDisabledEvents(): Promise<void> {
        await using repository = await createRepository();
        await setConfig({ path: repository.path, key: 'hook.pre-commit.enabled', value: 'false', },);
        await setConfig({ path: repository.path, key: 'hook.commit-msg.enabled', value: 'no', },);
        await setConfig({ path: repository.path, key: 'hook.post-commit.enabled', value: 'true', },);
        expect((await planFor({ path: repository.path, },)).disabledEvents,).toEqual(['pre-commit', 'commit-msg',],);
      },
    },),
    it({
      name: 'config parameters combine the caller environment and global -c options, and either lock-skip reason skips the hook lock',
      fn: async function testParametersAndLock(): Promise<void> {
        await using repository = await createRepository();
        /** Plan with both sources. */
        const plan = await planFor({
          path: repository.path,
          globalArgs: ['-c', 'x.y=it\'s',],
          environment: { GIT_CONFIG_PARAMETERS: '\'a.b=1\'', },
          concurrentCommits: true,
        },);
        expect(plan.configParameters,).toEqual({ kind: 'present', value: String.raw`'a.b=1' 'x.y=it'\''s'`, },);
        expect(plan.skipHookLock,).toBe(true,);
        expect((await planFor({ path: repository.path, inheritedLeaseValid: true, },)).skipHookLock,).toBe(true,);
      },
    },),
  ],
},);
