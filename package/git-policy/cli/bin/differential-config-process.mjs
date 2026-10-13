/**
 Shell-free process and file helpers of the repository-configuration differential.

 Every command runs from a complete argument array under a hermetic environment, so no host configuration,
 shell or inherited variable changes what either wrapper decides.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed
// in this file on its own instead of depending on a sibling module that carries the same reference.
/// <reference types="node" />
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

/** The real Git every fixture step and both wrappers resolve. */
export const REAL_GIT = '/usr/bin/git';

/** Seconds a wrapped command may run before the differential stops waiting for it. */
const PROBE_TIMEOUT_SECONDS = 120;
/** Milliseconds per second. */
const MILLISECONDS_PER_SECOND = 1_000;

/** A fixture step, a missing prerequisite or a candidate set that does not isolate its policy. */
export class DifferentialError extends Error {
  name = 'DifferentialError';
}

/**
 Hermetic environment of one run: no host configuration, fixed identities, nothing inherited.

 @param {{ home: string, path: string, extra?: Record<string, string> }} request - disposable home, search path and
   variables added on top
 @returns {Record<string, string>} complete environment
 */
export function hermeticEnvironment({
  home,
  path,
  extra = {},
}) {
  return {
    HOME: home,
    PATH: path,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Differential',
    GIT_AUTHOR_EMAIL: 'differential@example.invalid',
    GIT_COMMITTER_NAME: 'Differential',
    GIT_COMMITTER_EMAIL: 'differential@example.invalid',
    LC_ALL: 'C',
    ...extra,
  };
}

/**
 What one finished process showed its caller.

 @typedef {{ code: number, stdout: string, stderr: string }} Observed
 */

/**
 Read a captured stream to text.

 @param {import('node:stream').Readable | null} stream - a piped output stream of a started process
 @returns {Promise<string>} its decoded content
 */
async function readText(stream) {
  if (stream === null)
    throw new DifferentialError('A process was started without a piped output stream.');
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of stream) {
    if (!Buffer.isBuffer(chunk))
      throw new DifferentialError('A process output stream produced a non-byte chunk.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks)
    .toString('utf8');
}

/**
 Run one argument array without a shell, bounded in time, and capture its output whatever the exit code.

 @param {{ command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv }} request -
   executable, arguments, working directory and complete environment
 @returns {Promise<Observed>} exit code and decoded output; a command that cannot start, times out or is killed by a
   signal throws, because it decided nothing
 */
export async function observe({
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
      timeout: PROBE_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND,
    },
  );
  const [
    stdout,
    stderr,
    closed,
  ] = await Promise.all([
    readText(child.stdout),
    readText(child.stderr),
    once(
      child,
      'close',
    ),
  ]);
  const [code] = /** @type {unknown[]} */ (closed);
  if ((typeof code) !== 'number')
    throw new DifferentialError(`${command} ${args.join(' ')} ended without an exit code in ${cwd}: ${stderr}`);
  return {
    code,
    stdout,
    stderr,
  };
}

/**
 Run a real Git step of fixture setup and require success.

 @param {{ root: string, home: string, args: readonly string[] }} request - fixture, disposable home and arguments
 @returns {Promise<void>} resolves once Git exited zero
 */
export async function setupGit({
  root,
  home,
  args,
}) {
  const outcome = await observe({
    command: REAL_GIT,
    args,
    cwd: root,
    env: hermeticEnvironment({
      home,
      path: '/usr/bin:/bin',
    }),
  });
  if (outcome.code !== 0)
    throw new DifferentialError(`Fixture step git ${args.join(' ')} failed: ${outcome.stderr}`);
}

/**
 Write files below a root, creating directories.

 @param {{ root: string, files: Record<string, string> }} request - root and file contents by relative path
 @returns {Promise<void>} resolves once every file is written
 */
export async function writeFiles({
  root,
  files,
}) {
  await Promise.all(Object.entries(files)
    .map(async function writeOne([
      relative,
      content,
    ]) {
      const target = join(
        root,
        relative,
      );
      await mkdir(
        dirname(target),
        { recursive: true },
      );
      await writeFile(
        target,
        content,
      );
    }));
}
