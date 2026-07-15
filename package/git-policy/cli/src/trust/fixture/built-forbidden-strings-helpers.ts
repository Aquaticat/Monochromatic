/**
 * Packed forbidden-strings policy consumer helpers.
 *
 * @module
 */
import {
  chmod,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  assertJsonl,
  execute,
  type CommandResult,
} from './built-consumer-helpers.ts';

/**
 * Fake scanner executable mode.
 */
const EXECUTABLE_MODE = 0o755;
/**
 * Packed policy finding code.
 */
export const FINDING_CODE = 'security/forbidden-strings/forbidden-string';
/**
 * Fake scanner directory.
 */
export const SCANNER_DIRECTORY = '/work/forbidden-scanner-bin';
/**
 * Fake scanner executable.
 */
const SCANNER_PATH = `${SCANNER_DIRECTORY}/forbidden-strings`;

/**
 * Writes fake file-only scanner used to observe adapter behavior.
 *
 * @example
 * ```ts
 * await writeForbiddenScanner();
 * ```
 */
export async function writeForbiddenScanner(): Promise<void> {
  await mkdir(
    SCANNER_DIRECTORY,
    { recursive: true, },
  );
  await writeFile(
    SCANNER_PATH,
    `#!${process.execPath}
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const paths = process.argv.slice(2);
for (const path of paths) {
  const content = readFileSync(path, 'utf8');
  if (content.includes('SIGNAL_SCANNER')) process.kill(process.pid, 'SIGTERM');
  if (content.includes('STATUS_TWO')) { process.exitCode = 2; break; }
  if (content.includes('MALFORMED_SCANNER')) { process.stderr.write('malformed-output\\n'); process.exitCode = 1; break; }
  if (content.includes('READ_ERROR_SCANNER')) { process.stderr.write(path + ': read error: fixture\\n'); process.exitCode = 1; break; }
  if (content.includes('POST_ONLY_FORBIDDEN')) {
    const state = process.cwd() + '/.scanner-post-state';
    if (!existsSync(state)) { writeFileSync(state, 'seen'); continue; }
    process.stderr.write(path + ':1:1..19 rule=2\\n'); process.exitCode = 1; break;
  }
  if (content.includes('FORBIDDEN_SCANNER')) {
    process.stderr.write(path + ':1:1..17 rule=1\\n'); process.exitCode = 1; break;
  }
}
`,
  );
  await chmod(
    SCANNER_PATH,
    EXECUTABLE_MODE,
  );
}

/**
 * Creates trusted repository with shipped optional policy.
 *
 * @param repository - local Git repository path
 *
 * @param env - packed wrapper environment
 *
 * @param severity - configured policy severity
 *
 * @param executable - scanner command or path
 *
 * @example
 * ```ts
 * await initializeForbiddenRepository({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function initializeForbiddenRepository({
  repository,
  env,
  severity = 'error',
  executable = 'forbidden-strings',
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
  severity?: 'error' | 'warn';
  executable?: string;
}>): Promise<void> {
  await mkdir(
    repository,
    { recursive: true, },
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.email',
      'policy@example.invalid',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.name',
      'Policy Fixture',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/cli-git.config.ts`,
    `import { defineConfig, forbiddenStringsPlugin } from '@monochromatic-dev/git-policy-cli/ts';
export default defineConfig({
  plugins: { security: forbiddenStringsPlugin },
  policies: {
    'security/forbidden-strings': ['${severity}', { executable: '${executable}' }],
  },
},);
`,
  );
  await writeFile(
    `${repository}/baseline.txt`,
    'clean\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.ts',
      'baseline.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'baseline',
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
}

/**
 * Returns current commit identity.
 *
 * @param repository - Git repository path
 *
 * @returns exact commit OID
 *
 * @example
 * ```ts
 * await forbiddenHeadOid('/work/repo');
 * ```
 */
export async function forbiddenHeadOid(repository: string,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      'HEAD',
    ],
    cwd: repository,
  },)).stdout;
}

/**
 * Asserts plugin infrastructure event.
 *
 * @param result - wrapper result
 *
 * @param context - assertion context
 *
 * @example
 * ```ts
 * assertForbiddenPluginThrew({ result, context: 'scanner failure' });
 * ```
 */
export function assertForbiddenPluginThrew({
  result,
  context,
}: Readonly<{
  result: CommandResult;
  context: string;
}>): void {
  assertJsonl({
    text: result.stdout,
    expectedCode: 'plugin-threw',
    context,
  },);
  if (result.stderr !== '')
    throw new Error(`${context} leaked direct failure to stderr\n${result.stderr}`,);
}
