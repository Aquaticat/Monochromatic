/**
 * Packed wrapper, direct-check, and trust-management JSONL boundaries.
 *
 * @module
 */
import {
  assertIncludes,
  assertJsonl,
  execute,
} from './built-consumer-helpers.ts';

/**
 * Verifies setup, untrusted, and declined-trust failure routing.
 *
 * @param repository - disposable repository with untrusted config
 *
 * @param env - PATH-first packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyJsonlFailureBoundaries({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyJsonlFailureBoundaries({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Successful namespace help from packed shadow git.
   */
  const namespaceHelp = await execute({
    command: 'git',
    args: ['cli-git', '--help',],
    expectedExit: 0,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: namespaceHelp.stdout,
    expected: 'Usage: git cli-git',
    context: 'packed namespace help',
  },);
  if (namespaceHelp.stderr !== '')
    throw new Error(`packed namespace help leaked stderr\n${namespaceHelp.stderr}`,);

  /**
   * Successful trust help from packed shadow git.
   */
  const trustHelp = await execute({
    command: 'git',
    args: ['cli-git', 'trust', '--help',],
    expectedExit: 0,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: trustHelp.stdout,
    expected: 'recursive descendant authority',
    context: 'packed trust help',
  },);
  if (trustHelp.stderr !== '')
    throw new Error(`packed trust help leaked stderr\n${trustHelp.stderr}`,);

  /**
   * Direct-check setup failure outside Git worktree.
   */
  const unavailableDirectCheck = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    expectedExit: 2,
    cwd: '/work',
    env,
  },);
  assertJsonl({
    text: unavailableDirectCheck.stdout,
    expectedCode: 'transaction-failed',
    context: 'direct check outside worktree',
  },);
  if (unavailableDirectCheck.stderr !== '')
    throw new Error(`direct check setup failure leaked stderr\n${unavailableDirectCheck.stderr}`,);

  /**
   * First config-loading wrapper use blocked before execution.
   */
  const untrusted = await execute({
    command: 'git',
    args: ['future-command',],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: untrusted.stderr,
    expectedCode: 'config-untrusted',
    context: 'untrusted wrapper',
  },);
  if (untrusted.stdout !== '')
    throw new Error(`untrusted wrapper leaked stdout\n${untrusted.stdout}`,);

  /**
   * Direct config-untrusted failure routed only to stdout.
   */
  const untrustedDirectCheck = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: untrustedDirectCheck.stdout,
    expectedCode: 'config-untrusted',
    context: 'untrusted direct check',
  },);
  if (untrustedDirectCheck.stderr !== '')
    throw new Error(`untrusted direct check leaked stderr\n${untrustedDirectCheck.stderr}`,);

  /**
   * Unavailable trust consent remains stdout JSONL beside stderr disclosure.
   */
  const unavailableTrust = await execute({
    command: 'git',
    args: [
      'cli-git',
      'trust',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertJsonl({
    text: unavailableTrust.stdout,
    expectedCode: 'trust-consent-unavailable',
    context: 'unavailable trust consent',
  },);
  assertIncludes({
    text: unavailableTrust.stdout,
    expected: 'git cli-git trust --yes',
    context: 'unavailable trust remediation',
  },);
  assertIncludes({
    text: unavailableTrust.stderr,
    expected: 'Exact snapshot state: new',
    context: 'unavailable trust disclosure',
  },);
}
