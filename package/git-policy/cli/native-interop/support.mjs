/**
 Shared helpers of the native-interoperability drivers.
 They run only inside the image `bin/interop-native-container.mjs` builds,
 where `/opt/cli-git/node_modules/.bin/git` is the incumbent wrapper,
 `/opt/native/bin/git` is the native wrapper,
 and `/usr/bin/git` is Git 2.56.0.
 Every repository is created under a fresh directory below `/work/scratch` and never leaves the container.
 */
/// <reference types="node" />
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

/** Directory whose `git` is the incumbent wrapper. */
export const INCUMBENT_BIN = '/opt/cli-git/node_modules/.bin';
/** Directory whose `git` is the native wrapper. */
export const NATIVE_BIN = '/opt/native/bin';
/** Real Git 2.56.0. */
export const REAL_GIT = '/usr/bin/git';
/** The system search path without either wrapper. */
export const SYSTEM_PATH = '/usr/local/bin:/usr/bin:/bin';

/** A driver step whose result contradicts what it proves. */
export class InteropError extends Error {
  name = 'InteropError';
}

/**
 Environment of one run: no host configuration, fixed identities, the chosen wrapper first on `PATH`.

 @param {{ home: string, wrapperBin?: string, extra?: Record<string, string> }} request -
   disposable home, the directory whose `git` the run starts (none means real Git), and added variables
 @returns {Record<string, string>} complete environment, nothing inherited from the container
 */
export function runEnvironment({
  home,
  wrapperBin,
  extra = {},
}) {
  return {
    HOME: home,
    PATH: wrapperBin === undefined ? SYSTEM_PATH : `${wrapperBin}:${SYSTEM_PATH}`,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Interop Author',
    GIT_AUTHOR_EMAIL: 'author@example.invalid',
    GIT_COMMITTER_NAME: 'Interop Committer',
    GIT_COMMITTER_EMAIL: 'committer@example.invalid',
    LC_ALL: 'C',
    ...extra,
  };
}

/**
 Outcome of one finished process.
 @typedef {{ status: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string }} RunOutcome
 */

/**
 Run one argument array without a shell and capture its output.

 @param {{ command: string, args: readonly string[], cwd: string, env: Record<string, string>, input?: string }} request -
   executable, arguments, working directory, complete environment and optional standard input
 @returns {Promise<RunOutcome>} exit state and decoded output
 */
export async function run({
  command,
  args,
  cwd,
  env,
  input,
}) {
  const child = spawn(
    command,
    [...args],
    {
      cwd,
      env,
      stdio: [
        'pipe',
        'pipe',
        'pipe',
      ],
    },
  );
  /** @type {Buffer[]} */
  const out = [];
  /** @type {Buffer[]} */
  const err = [];
  child.stdout.on(
    'data',
    function collectStdout(chunk) {
      out.push(chunk);
    },
  );
  child.stderr.on(
    'data',
    function collectStderr(chunk) {
      err.push(chunk);
    },
  );
  // A command that never reads its input (or replaced its process) closes the pipe early;
  // the resulting EPIPE says nothing about the command and must not end the driver.
  child.stdin.on(
    'error',
    function ignoreClosedInput() {},
  );
  child.stdin.end(input ?? '');
  const [status, signal] = await once(
    child,
    'close',
  );
  return {
    status,
    signal,
    stdout: Buffer.concat(out)
      .toString('utf8'),
    stderr: Buffer.concat(err)
      .toString('utf8'),
  };
}

/**
 Run a command that must succeed, returning its standard output.

 @param {{ command: string, args: readonly string[], cwd: string, env: Record<string, string>, input?: string }} request -
   as for `run`
 @returns {Promise<string>} standard output
 */
export async function runOk(request) {
  const outcome = await run(request);
  if (outcome.status !== 0)
    throw new InteropError(
      `${request.command} ${request.args.join(' ')} exited ${String(outcome.status)} (${String(outcome.signal)}):\n`
        + `${outcome.stdout}${outcome.stderr}`,
    );
  return outcome.stdout;
}

/**
 Create a disposable repository with one commit made by real Git.

 @param {{ name: string }} request - label for the fresh directory
 @returns {Promise<{ root: string, repository: string, home: string }>} parent directory, repository and home
 */
export async function createRepository({ name }) {
  await mkdir(
    '/work/scratch',
    { recursive: true },
  );
  const root = await mkdtemp(join(
    '/work/scratch',
    `${name}-`,
  ));
  const repository = join(
    root,
    'repository',
  );
  const home = join(
    root,
    'home',
  );
  await mkdir(
    repository,
    { recursive: true },
  );
  await mkdir(
    home,
    { recursive: true },
  );
  const env = runEnvironment({ home });
  await runOk({
    command: REAL_GIT,
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
    cwd: repository,
    env,
  });
  await writeFile(
    join(
      repository,
      'a.txt',
    ),
    'first\n',
  );
  await runOk({
    command: REAL_GIT,
    args: [
      'add',
      '--',
      'a.txt',
    ],
    cwd: repository,
    env,
  });
  await runOk({
    command: REAL_GIT,
    args: [
      'commit',
      '--quiet',
      '--message=initial',
    ],
    cwd: repository,
    env,
  });
  return {
    root,
    repository,
    home,
  };
}

/**
 Fail the driver unless a condition holds.

 @param {{ condition: boolean, message: string }} request - the fact checked and what it proves
 */
export function expect({
  condition,
  message,
}) {
  if (!condition)
    throw new InteropError(message);
  console.log(`ok: ${message}`);
}

/**
 A process started in the background with its eventual outcome.
 @typedef {{ child: import('node:child_process').ChildProcess, outcome: Promise<RunOutcome> }} BackgroundRun
 */

/**
 Start one argument array in the background, capturing its output.

 @param {{ command: string, args: readonly string[], cwd: string, env: Record<string, string> }} request -
   executable, arguments, working directory and complete environment
 @returns {BackgroundRun} the child and a promise of its outcome
 */
export function startBackground({
  command,
  args,
  cwd,
  env,
}) {
  const child = spawn(
    command,
    [...args],
    {
      cwd,
      env,
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /** @type {Buffer[]} */
  const out = [];
  /** @type {Buffer[]} */
  const err = [];
  child.stdout.on(
    'data',
    function collectStdout(chunk) {
      out.push(chunk);
    },
  );
  child.stderr.on(
    'data',
    function collectStderr(chunk) {
      err.push(chunk);
    },
  );
  const outcome = once(
    child,
    'close',
  )
    .then(function finished([status, signal]) {
      return {
        status,
        signal,
        stdout: Buffer.concat(out)
          .toString('utf8'),
        stderr: Buffer.concat(err)
          .toString('utf8'),
      };
    });
  return {
    child,
    outcome,
  };
}

/**
 Wait until a file exists, failing after a bound.

 @param {{ path: string, timeoutMs?: number }} request - file to wait for and the bound
 @returns {Promise<string>} the file's text
 */
export async function waitForFile({
  path,
  timeoutMs = 60_000,
}) {
  const started = Date.now();
  for (;;) {
    try {
      return await readFile(
        path,
        'utf8',
      );
    }
    catch (error) {
      if (error.code !== 'ENOENT')
        throw error;
    }
    if (Date.now() - started > timeoutMs)
      throw new InteropError(`${path} did not appear within ${String(timeoutMs)} ms`);
    await sleep(20);
  }
}

/**
 Pause for a while.

 @param {number} milliseconds - delay
 @returns {Promise<void>} settles after the delay
 */
export function sleep(milliseconds) {
  return new Promise(function schedule(resolveSleep) {
    setTimeout(
      resolveSleep,
      milliseconds,
    );
  });
}

/** Directory of the native crate inside the image, where its release test binary was built. */
export const NATIVE_CRATE = '/work/package/git-policy/cli';

/**
 Path of the release library test binary, which holds the native interoperability probes.

 @returns {Promise<string>} absolute executable path
 */
export async function nativeProbeBinary() {
  const listed = await runOk({
    command: 'cargo',
    args: [
      'test',
      '--offline',
      '--locked',
      '--release',
      '--lib',
      '--no-run',
      '--message-format=json',
    ],
    cwd: NATIVE_CRATE,
    env: {
      ...process.env,
    },
  });
  for (const line of listed.split('\n')) {
    if (!line.startsWith('{'))
      continue;
    const message = JSON.parse(line);
    if (message.reason === 'compiler-artifact' && typeof message.executable === 'string')
      return message.executable;
  }
  throw new InteropError('cargo listed no library test executable');
}

/**
 Run one native probe test with its parameters and return its answer lines.

 @param {{ binary: string, test: string, env: Record<string, string>, cwd: string }} request -
   test binary, exact test path, probe variables and working directory
 @returns {Promise<string[]>} the probe's own output lines, harness lines removed
 */
export async function runNativeProbe({
  binary,
  test,
  env,
  cwd,
}) {
  const stdout = await runOk({
    command: binary,
    args: [
      '--exact',
      test,
      '--ignored',
      '--nocapture',
      '--test-threads=1',
      '--quiet',
    ],
    cwd,
    env: {
      PATH: SYSTEM_PATH,
      HOME: process.env.HOME ?? '/home/tester',
      ...env,
    },
  });
  return stdout.split('\n')
    .filter(function isAnswer(line) {
      return /^(identity|busy|acquired|released)/u.test(line);
    });
}
