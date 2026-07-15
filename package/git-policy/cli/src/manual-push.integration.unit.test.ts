/**
 * Built cli-git manual-push integration tests.
 *
 * @module
 */
import {
  chmod,
  mkdir,
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
import nanoSpawn, {
  type Result,
  SubprocessError,
} from 'nano-spawn';
import {
  ManualPushProbeError,
  probeManualPushUpdates,
} from './policy-engine/manual-push-probe.ts';

/** Real Git fixture executable. */
const REAL_GIT = '/usr/bin/git';
/** Built wrapper entry. */
const WRAPPER = join(import.meta.dirname, '..', 'dist', 'final', 'node', 'index.mjs',);
/** Fixture author email. */
const USER_EMAIL = 'manual-push@example.invalid';
/** Fixture author name. */
const USER_NAME = 'manual push fixture';

/** Disposable manual-push fixture. */
type ManualPushFixture = Readonly<{
  /** Private subprocess environment. */
  env: NodeJS.ProcessEnv;
  /** Local repository. */
  repository: string;
  /** Bare destination repository. */
  remote: string;
  /** Removes fixture. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates local and bare repositories with isolated trust storage.
 *
 * @returns initialized fixture
 */
async function createFixture(): Promise<ManualPushFixture> {
  /** Disposable root. */
  const root = await mkdtemp(join(tmpdir(), 'cli-git-manual-push-',),);
  /** Local repository path. */
  const repository = join(root, 'repository',);
  /** Bare destination path. */
  const remote = join(root, 'remote.git',);
  /** Isolated home path. */
  const home = join(root, 'home',);
  await mkdir(home,);
  await Promise.all([
    nanoSpawn(REAL_GIT, ['init', '--quiet', repository,],),
    nanoSpawn(REAL_GIT, ['init', '--bare', '--quiet', remote,],),
  ],);
  await nanoSpawn(REAL_GIT, ['config', 'user.email', USER_EMAIL,], { cwd: repository, },);
  await nanoSpawn(REAL_GIT, ['config', 'user.name', USER_NAME,], { cwd: repository, },);
  await nanoSpawn(REAL_GIT, ['remote', 'add', 'origin', remote,], { cwd: repository, },);
  return {
    repository,
    remote,
    env: {
      ...process.env,
      HOME: home,
      PATH: `/usr/bin:/bin:${process.env.PATH ?? ''}`,
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
}

/**
 * Runs built wrapper with isolated environment.
 *
 * @param fixture - disposable repositories
 *
 * @param args - wrapper arguments
 *
 * @returns captured successful result
 */
async function runWrapper({
  fixture,
  args,
}: Readonly<{
  fixture: ManualPushFixture;
  args: readonly string[];
}>): Promise<Result> {
  return await nanoSpawn(
    process.execPath,
    [
      WRAPPER,
      ...args,
    ],
    {
      cwd: fixture.repository,
      env: fixture.env,
    },
  );
}

/**
 * Installs and trusts self-contained manual-push policy config.
 *
 * @param fixture - disposable repositories
 *
 * @param checkBody - policy callback body
 */
async function installPolicy({
  fixture,
  checkBody,
}: Readonly<{
  fixture: ManualPushFixture;
  checkBody: string;
}>): Promise<void> {
  await writeFile(
    join(fixture.repository, 'cli-git.config.mjs',),
    `export default {
  plugins: {
    probe: {
      name: 'probe',
      policies: [{
        name: 'manual',
        defaultSeverity: 'error',
        warnSafe: true,
        triggers: ['manual-push'],
        check: async ({ context }) => { ${checkBody} },
      }],
    },
  },
};
`,
  );
  await nanoSpawn(REAL_GIT, ['add', 'cli-git.config.mjs',], { cwd: fixture.repository, },);
  await nanoSpawn(REAL_GIT, ['commit', '--quiet', '-m', 'policy',], { cwd: fixture.repository, },);
  await runWrapper({
    fixture,
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
  },);
}

/**
 * Captures expected wrapper failure.
 *
 * @param fixture - disposable repositories
 *
 * @param args - wrapper arguments
 *
 * @returns subprocess failure
 */
async function captureFailure({
  fixture,
  args,
}: Readonly<{
  fixture: ManualPushFixture;
  args: readonly string[];
}>): Promise<SubprocessError> {
  try {
    await runWrapper({ fixture, args, },);
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError)
      return error;
    throw error;
  }
  throw new Error('Expected wrapper failure.',);
}

/**
 * Reports whether destination ref is absent.
 *
 * @param fixture - disposable repositories
 *
 * @param ref - fully qualified remote ref
 *
 * @returns whether real Git reports absence
 */
async function remoteRefMissing({
  fixture,
  ref,
}: Readonly<{
  fixture: ManualPushFixture;
  ref: string;
}>): Promise<boolean> {
  try {
    await nanoSpawn(
      REAL_GIT,
      [
        'show-ref',
        '--verify',
        '--quiet',
        ref,
      ],
      { cwd: fixture.remote, },
    );
    return false;
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError)
      return true;
    throw error;
  }
}

await describe({
  name: 'built manual-push lifecycle',
  concurrency: 1,
  children: [
    it({
      name: 'blocks a transient forbidden blob before remote creation',
      fn: async function testTransientBlob() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `const candidates = await context.git.candidates();
const contents = await Promise.all(candidates.map(async candidate => new TextDecoder().decode(await candidate.bytes())));
return contents.some(content => content.includes('forbidden-transient')) ? [{ code: 'forbidden', message: 'transient content observed' }] : [];`,
        },);
        await writeFile(join(fixture.repository, 'transient.txt',), 'forbidden-transient\n',);
        await nanoSpawn(REAL_GIT, ['add', 'transient.txt',], { cwd: fixture.repository, },);
        await nanoSpawn(REAL_GIT, ['commit', '--quiet', '-m', 'introduce',], { cwd: fixture.repository, },);
        await rm(join(fixture.repository, 'transient.txt',),);
        await nanoSpawn(REAL_GIT, ['add', 'transient.txt',], { cwd: fixture.repository, },);
        await nanoSpawn(REAL_GIT, ['commit', '--quiet', '-m', 'remove',], { cwd: fixture.repository, },);
        const failure = await captureFailure({
          fixture,
          args: ['push', 'origin', 'HEAD:refs/heads/main',],
        },);
        expect(failure.exitCode,).toBe(1,);
        expect(failure.stderr,).toContain('transient content observed',);
        expect(await remoteRefMissing({
          fixture,
          ref: 'refs/heads/main',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'reports multiple authoritative ref updates before forwarding',
      fn: async function testMultipleUpdates() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `const updates = await context.git.pushUpdates();
return updates.length === 2 ? [{ code: 'two', message: updates.map(update => update.remoteRef).sort().join(',') }] : [];`,
        },);
        const failure = await captureFailure({
          fixture,
          args: [
            'push',
            'origin',
            'HEAD:refs/heads/main',
            'HEAD:refs/heads/other',
          ],
        },);
        expect(failure.stderr,).toContain('refs/heads/main,refs/heads/other',);
      },
    },),
    it({
      name: 'uses authoritative prior oid for default ordinary push',
      fn: async function testDefaultPush() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `const updates = await context.git.pushUpdates();
return [{ code: 'observe', message: updates.map(update => update.remoteOid).join(',') }];`,
        },);
        await nanoSpawn(REAL_GIT, [
          'push',
          '--quiet',
          '--set-upstream',
          'origin',
          'HEAD:refs/heads/main',
        ], { cwd: fixture.repository, },);
        /** Authoritative remote state before local advance. */
        const priorOid = (await nanoSpawn(REAL_GIT, ['rev-parse', 'HEAD',], {
          cwd: fixture.repository,
        },)).stdout;
        await writeFile(join(fixture.repository, 'ordinary.txt',), 'ordinary\n',);
        await nanoSpawn(REAL_GIT, ['add', 'ordinary.txt',], { cwd: fixture.repository, },);
        await nanoSpawn(REAL_GIT, ['commit', '--quiet', '-m', 'ordinary',], { cwd: fixture.repository, },);
        const failure = await captureFailure({
          fixture,
          args: ['push', 'origin',],
        },);
        expect(failure.stderr,).toContain(priorOid,);
        expect((await nanoSpawn(REAL_GIT, ['rev-parse', 'refs/heads/main',], {
          cwd: fixture.remote,
        },)).stdout,).toBe(priorOid,);
      },
    },),
    it({
      name: 'reports authoritative destination during force update',
      fn: async function testForceUpdate() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `const updates = await context.git.pushUpdates();
return [{ code: 'force', message: updates.map(update => update.remoteOid).join(',') }];`,
        },);
        await nanoSpawn(REAL_GIT, ['push', '--quiet', 'origin', 'HEAD:refs/heads/main',], {
          cwd: fixture.repository,
        },);
        await writeFile(join(fixture.repository, 'remote-newer.txt',), 'newer\n',);
        await nanoSpawn(REAL_GIT, ['add', 'remote-newer.txt',], { cwd: fixture.repository, },);
        await nanoSpawn(REAL_GIT, ['commit', '--quiet', '-m', 'remote newer',], {
          cwd: fixture.repository,
        },);
        await nanoSpawn(REAL_GIT, ['push', '--quiet', 'origin', 'HEAD:refs/heads/main',], {
          cwd: fixture.repository,
        },);
        /** Destination state before force attempt. */
        const remoteOid = (await nanoSpawn(REAL_GIT, ['rev-parse', 'HEAD',], {
          cwd: fixture.repository,
        },)).stdout;
        await nanoSpawn(REAL_GIT, ['reset', '--hard', '--quiet', 'HEAD^',], {
          cwd: fixture.repository,
        },);
        await runWrapper({
          fixture,
          args: ['cli-git', 'trust', '--yes',],
        },);
        const failure = await captureFailure({
          fixture,
          args: ['push', '--force', 'origin', 'HEAD:refs/heads/main',],
        },);
        expect(failure.stderr,).toContain(remoteOid,);
        expect((await nanoSpawn(REAL_GIT, ['rev-parse', 'refs/heads/main',], {
          cwd: fixture.remote,
        },)).stdout,).toBe(remoteOid,);
      },
    },),
    it({
      name: 'materializes annotated tag, tree, and blob targets',
      fn: async function testNonCommitTargets() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `const candidates = await context.git.candidates();
return [{ code: 'objects', message: candidates.map(candidate => candidate.path).sort().join(',') }];`,
        },);
        await nanoSpawn(REAL_GIT, ['tag', '--annotate', '--message', 'tag', 'annotated',], {
          cwd: fixture.repository,
        },);
        /** Current tree object. */
        const treeOid = (await nanoSpawn(REAL_GIT, ['rev-parse', 'HEAD^{tree}',], {
          cwd: fixture.repository,
        },)).stdout;
        /** Standalone blob object. */
        const blobOid = (await nanoSpawn(REAL_GIT, ['hash-object', '-w', '--stdin',], {
          cwd: fixture.repository,
          stdio: [
            { string: 'standalone blob\n', },
            'pipe',
            'pipe',
          ],
        },)).stdout;
        const failure = await captureFailure({
          fixture,
          args: [
            'push',
            'origin',
            'refs/tags/annotated:refs/tags/annotated',
            `${treeOid}:refs/trees/current`,
            `${blobOid}:refs/blobs/standalone`,
          ],
        },);
        expect(failure.stderr,).toContain('refs/blobs/standalone',);
        expect(failure.stderr,).toContain('cli-git.config.mjs',);
      },
    },),
    it({
      name: 'skips manual policies for explicit dry run',
      fn: async function testDryRun() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `return [{ code: 'blocked', message: 'policy should not run' }];`,
        },);
        await runWrapper({
          fixture,
          args: ['push', '--dry-run', 'origin', 'HEAD:refs/heads/main',],
        },);
        expect(await remoteRefMissing({
          fixture,
          ref: 'refs/heads/main',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'rejects destination state changed after negotiation',
      fn: async function testStaleDestination() {
        await using fixture = await createFixture();
        /** Fake Git executable that invokes private hook then reports changed destination. */
        const fakeGit = join(fixture.repository, 'fake-git.mjs',);
        /** Destination value advertised during negotiation. */
        const advertisedOid = '1111111111111111111111111111111111111111';
        /** Destination value observed by ls-remote. */
        const authoritativeOid = '2222222222222222222222222222222222222222';
        await writeFile(fakeGit, `#!${process.execPath}
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === 'ls-remote') {
  process.stdout.write('${authoritativeOid}\\trefs/heads/main\\n');
} else {
  const setting = args.find(argument => argument.startsWith('core.hooksPath='));
  if (setting === undefined) throw new Error('missing hooks path');
  const hook = setting.slice('core.hooksPath='.length) + '/pre-push';
  const result = spawnSync(hook, ['origin', 'mock://remote'], {
    env: process.env,
    input: 'refs/heads/main 3333333333333333333333333333333333333333 refs/heads/main ${advertisedOid}\\n',
    encoding: 'utf8',
  });
  process.exitCode = result.status ?? 1;
  process.stderr.write(result.stderr ?? '');
}
`,);
        await chmod(fakeGit, 0o755,);
        try {
          await probeManualPushUpdates({
            gitPath: fakeGit,
            cwd: fixture.repository,
            args: ['push', 'origin', 'HEAD:refs/heads/main',],
          },);
        }
        catch (error: unknown) {
          expect(error,).toBeInstanceOf(ManualPushProbeError,);
          expect(String(error,),).toContain('Remote ref changed during manual-push discovery',);
          return;
        }
        throw new Error('Expected stale destination rejection.',);
      },
    },),
    it({
      name: 'routes indeterminate probe failure as infrastructure error',
      fn: async function testIndeterminateProbe() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: 'return [];',
        },);
        await nanoSpawn(REAL_GIT, ['remote', 'set-url', 'origin', join(fixture.repository, 'missing.git',),], {
          cwd: fixture.repository,
        },);
        const failure = await captureFailure({
          fixture,
          args: ['push', 'origin', 'HEAD:refs/heads/main',],
        },);
        expect(failure.exitCode,).toBe(2,);
        expect(failure.stderr,).toContain('content-unavailable',);
      },
    },),
    it({
      name: 'allows pure deletion without content candidates',
      fn: async function testPureDeletion() {
        await using fixture = await createFixture();
        await installPolicy({
          fixture,
          checkBody: `const candidates = await context.git.candidates();
return candidates.length === 0 ? [] : [{ code: 'content', message: 'unexpected content' }];`,
        },);
        await nanoSpawn(REAL_GIT, ['push', '--quiet', 'origin', 'HEAD:refs/heads/main',], { cwd: fixture.repository, },);
        await nanoSpawn(REAL_GIT, ['config', 'receive.denyDeleteCurrent', 'ignore',], { cwd: fixture.remote, },);
        await runWrapper({
          fixture,
          args: ['push', 'origin', ':refs/heads/main',],
        },);
        expect(await remoteRefMissing({
          fixture,
          ref: 'refs/heads/main',
        },),).toBe(true,);
      },
    },),
  ],
},);
