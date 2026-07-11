/**
 * Packed shadow-bin TypeScript trust verification. @module
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  assertIncludes,
  assertJsonl,
  execute,
  parseJsonObjectLine,
} from './built-consumer-helpers.ts';

/**
 * Exercises built TypeScript trust, strict invalidation, and relaxed rebuild.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyTypeScriptConsumer({ env: process.env });
 * ```
 */
export async function verifyTypeScriptConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable TypeScript repository.
   */
  const repository = '/work/typescript';
  await mkdir(repository,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: repository,
  },);
  /**
   * Relative tracked source.
   */
  const policyPath = join(
    repository,
    'policy.ts',
  );
  await writeFile(
    policyPath,
    `export const message: string = 'built TypeScript ran';\n`,
  );
  /**
   * TypeScript config with bare package and relative imports.
   */
  const configPath = join(
    repository,
    'cli-git.config.ts',
  );
  await writeFile(
    configPath,
    `import { object } from 'valibot';
import { message } from './policy.ts';
export default {
  trust: { children: Boolean(object({})) },
  plugins: {
    typescript: {
      name: 'typescript',
      policies: [{
        name: 'deny',
        defaultSeverity: 'error',
        warnSafe: true,
        triggers: ['direct-check'],
        check: async () => [{ code: 'denied', message }],
      }],
    },
  },
};
`,
  );
  /**
   * First TypeScript loading use remains blocked.
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
    context: 'untrusted TypeScript wrapper',
  },);
  /**
   * Explicit trust builds and stores one bundle.
   */
  const trusted = await execute({
    command: 'git',
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: trusted.stderr,
    expected: 'Format: typescript',
    context: 'TypeScript trust format',
  },);
  assertIncludes({
    text: trusted.stderr,
    expected: `Tracked source: ${policyPath}`,
    context: 'TypeScript source graph',
  },);
  assertIncludes({
    text: trusted.stderr,
    expected: 'bare package import is bundled but excluded',
    context: 'package warning',
  },);
  /**
   * Stored bundle produces direct policy finding.
   */
  const finding = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'typescript/deny',
      '--all',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: finding.stdout,
    expected: 'built TypeScript ran',
    context: 'stored TypeScript policy',
  },);
  /**
   * Trusted status carries exact identity for relaxed grammar.
   */
  const status = await execute({
    command: 'git',
    args: [
      'cli-git',
      'status',
    ],
    cwd: repository,
    env,
  },);
  /**
   * Parsed compact trust status.
   */
  const statusValue: unknown = JSON.parse(status.stdout,);
  if (((typeof statusValue) !== 'object') || (statusValue === null)
    || (!('filesystemId' in statusValue))
    || ((typeof statusValue.filesystemId) !== 'string'))
    throw new Error(`TypeScript status omitted filesystem identity: ${status.stdout}`,);
  /**
   * Exact per-path relaxed identity.
   */
  const relaxedValue = `${statusValue.filesystemId}:${configPath}`;
  await writeFile(
    policyPath,
    `export const message: string = 'relaxed TypeScript ran';\n`,
  );
  /**
   * Strict mode blocks tracked source change.
   */
  const changed = await execute({
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
  assertIncludes({
    text: changed.stdout,
    expected: '"code":"config-changed"',
    context: 'strict TypeScript change',
  },);
  /**
   * Explicit relaxed entry rebuilds and executes new stored bundle.
   */
  const relaxedEnv: NodeJS.ProcessEnv = {
    ...env,
    CLI_GIT_NO_PARANOID: relaxedValue,
  };
  /**
   * Relaxed rebuilt direct finding.
   */
  const rebuilt = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'typescript/deny',
      '--all',
    ],
    expectedExit: 1,
    cwd: repository,
    env: relaxedEnv,
  },);
  assertIncludes({
    text: rebuilt.stdout,
    expected: 'relaxed TypeScript ran',
    context: 'relaxed rebuilt policy',
  },);
  await writeFile(
    policyPath,
    `export const message: string = 'raced TypeScript ran';\n`,
  );
  /**
   * Independent packed-bin relaxed rebuild race.
   */
  const raceResults = await Promise.all([
    execute({
      command: 'git',
      args: [
        'cli-git',
        'check',
        '--policy',
        'typescript/deny',
        '--all',
      ],
      expectedExit: [
        1,
        2,
      ],
      cwd: repository,
      env: relaxedEnv,
    },),
    execute({
      command: 'git',
      args: [
        'cli-git',
        'check',
        '--policy',
        'typescript/deny',
        '--all',
      ],
      expectedExit: [
        1,
        2,
      ],
      cwd: repository,
      env: relaxedEnv,
    },),
  ],);
  if (!raceResults.some(function ranRebuilt(result,) {
    return result.stdout
      .includes('raced TypeScript ran',);
  },))
    throw new Error('Concurrent relaxed rebuild produced no usable stored bundle.',);
  /**
   * Retry after contention deterministically loads valid record.
   */
  const afterRace = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--policy',
      'typescript/deny',
      '--all',
    ],
    expectedExit: 1,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: afterRace.stdout,
    expected: 'raced TypeScript ran',
    context: 'post-race stored bundle',
  },);
  await writeFile(
    policyPath,
    `export const message: string = 'malformed entry blocked';\n`,
  );
  /**
   * Malformed relaxation warns in pure JSONL and retains strict block.
   */
  const malformed = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    expectedExit: 2,
    cwd: repository,
    env: {
      ...env,
      CLI_GIT_NO_PARANOID: 'bad%20entry',
    },
  },);
  /**
   * Canonical non-policy trust warning.
   */
  const warning = parseJsonObjectLine({
    text: malformed.stderr,
    context: 'malformed relaxed warning',
  },);
  if ((warning.schemaVersion !== 1)
    || (warning.type !== 'trust-warning')
    || (warning.code !== 'relaxed-entry-malformed'))
    throw new Error(`malformed relaxed warning mismatch\n${malformed.stderr}`,);
  assertJsonl({
    text: malformed.stdout,
    expectedCode: 'config-changed',
    context: 'malformed strict block',
  },);
  /**
   * Final exact cleanup.
   */
  const untrust = await execute({
    command: 'git',
    args: [
      'cli-git',
      'untrust',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: untrust.stdout,
    expected: '"removed":true',
    context: 'TypeScript untrust',
  },);
}
