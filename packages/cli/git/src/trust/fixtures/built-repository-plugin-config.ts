/**
 * Packed repository-plugin config writer.
 *
 * @module
 */
import { writeFile, } from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';

/**
 * Repository policy severity fixture.
 */
export type RepositoryPolicySeverity = 'default' | 'warn' | 'off';

/**
 * Produces trusted TypeScript config with optional explicit severity.
 *
 * @param severity - omitted default or explicit setting
 *
 * @returns complete TypeScript config source
 *
 * @example
 * ```ts
 * repositoryPluginConfigSource('warn');
 * ```
 */
export function repositoryPluginConfigSource(severity: RepositoryPolicySeverity,): string {
  /**
   * Optional explicit namespaced policy setting.
   */
  const policies = severity === 'default'
    ? ''
    : `\n  policies: { 'mono/forbidden-root-context': '${severity}' },`;
  return `import {
  defineConfig,
  definePlugin,
  definePolicy,
} from '@monochromatic-dev/cli-git';

const policy = definePolicy({
  name: 'forbidden-root-context',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: ['pre-forward', 'direct-check'],
  check: async ({ context }) => {
    const candidates = await context.git.candidates();
    return candidates.some(({ path, change }) => path === 'CONTEXT.md' && change !== 'deleted')
      ? [{
          code: 'root-context-forbidden',
          message: 'Root CONTEXT.md is forbidden; read source code directly.',
          path: 'CONTEXT.md',
        }]
      : [];
  },
});

const plugin = definePlugin({ name: 'repository', policies: [policy] });
export default defineConfig({
  plugins: { mono: plugin },${policies}
});
`;
}

/**
 * Writes,
 * commits,
 * and explicitly trusts one fixture config revision.
 *
 * @param repository - disposable repository
 *
 * @param configPath - root config path
 *
 * @param severity - configured policy severity
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await installRepositoryPluginConfig({ repository, configPath, severity: 'default', env });
 * ```
 */
export async function installRepositoryPluginConfig({
  repository,
  configPath,
  severity,
  env,
}: Readonly<{
  repository: string;
  configPath: string;
  severity: RepositoryPolicySeverity;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await writeFile(
    configPath,
    repositoryPluginConfigSource(severity,),
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'cli-git.config.ts',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      `config ${severity}`,
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
