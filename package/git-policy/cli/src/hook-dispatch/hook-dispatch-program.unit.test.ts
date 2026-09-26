/**
 The written hook dispatcher shim, run as native Git runs it, against a disposable repository's hooks.

 @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import { startZombie, } from '../owner-lock/zombie-fixture.unit.test.ts';

const {
  acquireOwnerLock,
  resolveProcessBirthIdentity,
  writeHookShim,
} = internalTestExports;

/**
 Absolute real Git executable.
 */
const REAL_GIT = await resolveRealGit();

/**
 Built dispatch plan shape.
 */
type HookDispatchPlan = Parameters<typeof writeHookShim>[0]['plan'];

/**
 Repository with a recording pre-commit hook and a written shim.
 */
type ShimFixture = AsyncDisposable & Readonly<{
  /**
   Worktree root.
   */
  path: string;
  /**
   Shim hooks directory.
   */
  shimDirectory: string;
  /**
   Hook lock directory.
   */
  hookLockPath: string;
  /**
   Report the hook writes.
   */
  report: string;
}>;

/**
 Plan fields a test replaces.
 */
type PlanOverrides = Readonly<{
  /**
   Replacement caller config parameters.
   */
  configParameters?: HookDispatchPlan['configParameters'];
  /**
   Replacement disabled events.
   */
  disabledEvents?: HookDispatchPlan['disabledEvents'];
  /**
   Replacement lock skip.
   */
  skipHookLock?: boolean;
}>;

/**
 Creates a repository whose pre-commit hook reports its environment and arguments and exits with `HOOK_EXIT`,
 and writes a shim with a plan adjusted by `overrides`.

 @param overrides - plan fields replacing the defaults

 @returns fixture
 */
async function createShimFixture(overrides: PlanOverrides,): Promise<ShimFixture> {
  /**
   Scratch root.
   */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-shim-',),);
  /**
   Worktree root.
   */
  const path = join(root, 'repo',);
  await nanoSpawn(REAL_GIT, ['init', '--quiet', path,], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', }, },);
  /**
   Report path.
   */
  const report = join(root, 'report.json',);
  /**
   Repository hook path.
   */
  const hook = join(path, '.git', 'hooks', 'pre-commit',);
  await mkdir(join(path, '.git', 'hooks',), { recursive: true, },);
  await writeFile(hook, `#!${process.execPath}
require('node:fs').writeFileSync(${JSON.stringify(report,)}, JSON.stringify({
  args: process.argv.slice(2),
  workTree: process.env.GIT_WORK_TREE,
  lease: process.env.CLI_GIT_PREPARATION_LEASE,
  nativeOverridesVisible: (process.env.GIT_CONFIG_PARAMETERS ?? '').includes('/shim'),
  callerName: (() => { try { return require('node:child_process').execFileSync(${JSON.stringify(REAL_GIT,)}, ['config', '--get', 'user.name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unset'; } })(),
}));
process.exit(Number(process.env.HOOK_EXIT ?? '0'));
`,);
  await chmod(hook, 0o755,);
  await mkdir(join(path, '.git', 'cli-git',),);
  /**
   Shim directory.
   */
  const shimDirectory = join(root, 'shim',);
  /**
   Hook lock directory.
   */
  const hookLockPath = join(path, '.git', 'cli-git', 'hook.lock',);
  await writeHookShim({
    hooksDirectory: shimDirectory,
    plan: {
      schemaVersion: 1,
      gitPath: REAL_GIT,
      hooksPath: join(path, '.git', 'hooks',),
      disabledEvents: [],
      configParameters: { kind: 'absent', },
      worktreeRoot: path,
      lease: 'lease-token',
      hookLockPath,
      skipHookLock: false,
      ...overrides,
    },
    nodePath: process.execPath,
  },);
  return {
    path,
    shimDirectory,
    hookLockPath,
    report,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 Runs the shim's pre-commit entry as native Git does, with native Git's own config parameters in the environment.

 @param fixture - shim fixture

 @param env - extra environment

 @returns exit code
 */
async function runShim({
  fixture,
  env = {},
}: Readonly<{
  fixture: ShimFixture;
  env?: NodeJS.ProcessEnv;
}>,): Promise<number> {
  /**
   Shim process.
   */
  const child = spawn(join(fixture.shimDirectory, 'pre-commit',), ['extra argument',], {
    cwd: fixture.path,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_PARAMETERS: String.raw`'core.hookspath=/shim' 'hook.pre-commit.enabled=false'`,
      ...env,
    },
    stdio: 'ignore',
  },);
  /**
   Exit code.
   */
  const exit: readonly unknown[] = await once(child, 'exit',);
  return (typeof exit[0]) === 'number' ? exit[0] : -1;
}

/**
 Reads the hook report.

 @param fixture - shim fixture

 @returns report fields, or absence text when the hook never ran
 */
async function hookReport(fixture: ShimFixture,): Promise<unknown> {
  try {
    return JSON.parse(await readFile(fixture.report, 'utf8',),);
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
      return 'hook did not run';
    throw error;
  }
}

await describe({
  name: 'hook dispatcher shim',
  children: [
    it({
      name: 'runs the repository hook with its arguments, the worktree, the lease, and the caller config parameters restored',
      fn: async function testEnvironment(): Promise<void> {
        await using fixture = await createShimFixture({ configParameters: { kind: 'present', value: '\'user.name=caller\'', }, },);
        expect(await runShim({ fixture, },),).toBe(0,);
        /** Hook report. */
        const report = await hookReport(fixture,);
        expect(report,).toEqual({
          args: ['extra argument',],
          workTree: fixture.path,
          lease: 'lease-token',
          nativeOverridesVisible: false,
          callerName: 'caller',
        },);
      },
    },),
    it({
      name: 'drops native Git\'s own config parameters when the caller had none, and propagates the hook exit status',
      fn: async function testAbsentAndExit(): Promise<void> {
        await using fixture = await createShimFixture({},);
        expect(await runShim({ fixture, env: { HOOK_EXIT: '3', }, },),).toBe(3,);
        /** Hook report. */
        const report = await hookReport(fixture,);
        expect(report,).toEqual({
          args: ['extra argument',],
          workTree: fixture.path,
          lease: 'lease-token',
          nativeOverridesVisible: false,
          callerName: 'unset',
        },);
      },
    },),
    it({
      name: 'skips an event the user disabled',
      fn: async function testDisabled(): Promise<void> {
        await using fixture = await createShimFixture({ disabledEvents: ['pre-commit',], },);
        expect(await runShim({ fixture, env: { HOOK_EXIT: '1', }, },),).toBe(0,);
        expect(await hookReport(fixture,),).toBe('hook did not run',);
      },
    },),
    it({
      name: 'waits for the hook lock by default and runs once it is released',
      fn: async function testHookLockWait(): Promise<void> {
        await using fixture = await createShimFixture({},);
        /** Lock held by this process as another preparation would hold it. */
        const held = await acquireOwnerLock({ lockDirectory: fixture.hookLockPath, },);
        /** Shim run blocked on the lock. */
        const run = runShim({ fixture, },);
        await wait(300,);
        expect(await hookReport(fixture,),).toBe('hook did not run',);
        await held[Symbol.asyncDispose]();
        expect(await run,).toBe(0,);
        expect(await hookReport(fixture,),).not.toBe('hook did not run',);
      },
    },),
    it({
      name: 'retires a hook lock whose holder exited but was never reaped, instead of waiting forever',
      fn: async function testZombieHolder(): Promise<void> {
        if (process.platform !== 'linux')
          return;
        await using fixture = await createShimFixture({},);
        await using zombie = await startZombie(resolveProcessBirthIdentity,);
        await mkdir(fixture.hookLockPath,);
        await writeFile(join(fixture.hookLockPath, 'owner.json',), `${JSON.stringify({ schemaVersion: 1, token: 'zombie', ownerPid: zombie.pid, ownerBirthIdentity: zombie.identity, },)}\n`,);
        /** Shim outcome, bounded so a regression fails instead of hanging. */
        const outcome = await Promise.race([
          runShim({ fixture, },),
          (async function timeout(): Promise<string> {
            await wait(5_000,);
            return 'still waiting on the zombie holder';
          })(),
        ],);
        expect(outcome,).toBe(0,);
        expect(await hookReport(fixture,),).not.toBe('hook did not run',);
      },
    },),
    it({
      name: 'runs without the hook lock when the plan skips it',
      fn: async function testSkipHookLock(): Promise<void> {
        await using fixture = await createShimFixture({ skipHookLock: true, },);
        await using _held = await acquireOwnerLock({ lockDirectory: fixture.hookLockPath, },);
        expect(await runShim({ fixture, },),).toBe(0,);
        expect(await hookReport(fixture,),).not.toBe('hook did not run',);
      },
    },),
  ],
},);
