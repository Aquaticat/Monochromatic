/**
 * Built cli-git manual-push integration tests.
 *
 * @module
 */
import {
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
