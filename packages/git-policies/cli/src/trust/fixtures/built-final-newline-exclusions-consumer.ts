/**
 * Packed final-newline hk exclusion parity verification.
 *
 * @module
 */
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  initializeBareRemote,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Fuzz seed path excluded from every final-newline lifecycle.
 */
const FUZZ_PATH = 'packages/fuzz/forbidden-strings/seeds/newline-fixture';
/**
 * TOML parser fixture path excluded from every final-newline lifecycle.
 */
const TOML_PATH = 'packages/test-fixture/toml-edit/src/newline-fixture.toml';
/**
 * Compact tsdown output path excluded from every final-newline lifecycle.
 */
const TSDOWN_PATH = 'pkg/dist/final/node/index.mjs';
/**
 * Committed plugin bundle path excluded from every final-newline lifecycle.
 */
const BUNDLE_PATH = 'pkg/bundle/node/index.mjs';
/**
 * Named hk exclusion families exercised through packed lifecycle paths.
 */
const EXCLUDED_PATHS = [
  FUZZ_PATH,
  TOML_PATH,
  TSDOWN_PATH,
  BUNDLE_PATH,
] as const;

/**
 * Exercises all migrated hk exclusion families through check, fix, commit, and push.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyFinalNewlineExclusions({ env: process.env });
 * ```
 */
export async function verifyFinalNewlineExclusions({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable exclusion-parity repository.
   */
  const repository = '/work/final-newline-exclusions';
  /**
   * Disposable bare remote for pre-push parity.
   */
  const remote = '/work/final-newline-exclusions-origin.git';
  await initializePostCommitRepository(repository,);
  await initializeBareRemote(remote,);
  await writeFile(
    `${repository}/cli-git.config.mjs`,
    'export default {};\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.mjs',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '--message=config baseline',
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: repository,
    env,
  },);
  await Promise.all(EXCLUDED_PATHS.map(async function writeExcluded(path,): Promise<void> {
    /**
     * Parent directory for excluded fixture path.
     */
    const parent = path.slice(
      0,
      path.lastIndexOf('/',)
    );
    await mkdir(
      `${repository}/${parent}`,
      { recursive: true, },
    );
    await writeFile(
      `${repository}/${path}`,
      `missing newline in ${path}`,
    );
  },),);
  /**
   * Exact index bytes before read-only check and index-neutral fix.
   */
  const indexBefore = Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'final-newline',
      '--',
      ...EXCLUDED_PATHS,
    ],
    cwd: repository,
    env,
  },);
  /**
   * No-op direct fix over excluded paths.
   */
  const fixed = await execute({
    command: 'git',
    args: [
      'cli-git',
      'fix',
      '--policy',
      'final-newline',
      '--',
      ...EXCLUDED_PATHS,
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: fixed.stdout,
    expected: '',
    context: 'excluded direct-fix output',
  },);
  assertFixtureEqual({
    actual: Buffer.from(await readFile(`${repository}/.git/index`,))
      .toString('base64',),
    expected: indexBefore,
    context: 'excluded direct-fix index bytes',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      ...EXCLUDED_PATHS,
    ],
    cwd: repository,
  },);
  /**
   * Packed pre-commit invocation retaining exact excluded bytes.
   */
  const committed = await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '--message=excluded bytes',
      '--',
      ...EXCLUDED_PATHS,
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: committed.stderr,
    expected: '',
    context: 'excluded pre-commit output',
  },);
  await Promise.all(EXCLUDED_PATHS.map(async function assertCommittedBytes(path,): Promise<void> {
    /**
     * Exact committed excluded blob.
     */
    const blob = await execute({
      command: '/usr/bin/git',
      args: [
        'show',
        `HEAD:${path}`,
      ],
      cwd: repository,
    },);
    assertFixtureEqual({
      actual: blob.stdout,
      expected: `missing newline in ${path}`,
      context: `${path} committed bytes`,
    },);
  },),);
  await execute({
    command: '/usr/bin/git',
    args: [
      'remote',
      'add',
      'origin',
      remote,
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'push',
      '--quiet',
      'origin',
      'main:main',
    ],
    cwd: repository,
    env,
  },);
}
