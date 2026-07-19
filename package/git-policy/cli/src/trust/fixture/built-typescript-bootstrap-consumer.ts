/**
 * Packed TypeScript trust bootstrap baseline without consumer installation state. @module
 */
import {
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';

/**
 * Exercises packed TypeScript trust with no consumer tsconfig or node_modules.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyTypeScriptBootstrapConsumer({ env: process.env });
 * ```
 */
export async function verifyTypeScriptBootstrapConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Consumer repository outside packed wrapper installation ancestry.
   */
  const repository = '/work/typescript-bootstrap-clean';
  await mkdir(repository,);
  /**
   * Initial entries proving package-manager and TypeScript project state are absent.
   */
  const initialEntries = await readdir(repository,);
  if (initialEntries.length !== 0)
    throw new Error(`clean TypeScript bootstrap repository was not empty: ${initialEntries.join(', ')}`,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: repository,
  },);
  /**
   * Package-root authoring import resolved only from installed cli-git artifact.
   */
  const configPath = join(
    repository,
    'cli-git.config.ts',
  );
  await writeFile(
    configPath,
    `import { defineConfig } from '@monochromatic-dev/git-policy-cli';
export default defineConfig({});
`,
  );
  /**
   * Explicit trust result through packed wrapper.
   */
  const trust = await execute({
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
    text: trust.stderr,
    expected: 'Format: typescript',
    context: 'clean TypeScript bootstrap trust',
  },);
  if (trust.stderr.includes('UNRESOLVED_IMPORT',))
    throw new Error(`clean TypeScript bootstrap leaked unresolved import\n${trust.stderr}`,);
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'untrust',
    ],
    cwd: repository,
    env,
  },);
}
