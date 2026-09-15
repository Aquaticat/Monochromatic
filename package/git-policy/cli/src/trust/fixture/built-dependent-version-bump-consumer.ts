/**
 * Packed verification of the repository dependent-version-bump policy on a hand bump.
 *
 * @module
 */
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, } from 'node:path';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Trusted TypeScript config registering the repository plugin under the `mono` namespace.
 */
const DEPENDENT_BUMP_CONFIG = `import {
  defineConfig,
  repositoryPolicyPlugin,
} from '@monochromatic-dev/git-policy-cli';

export default defineConfig({
  plugins: { mono: repositoryPolicyPlugin },
  policies: { 'mono/dependent-version-bump': 'error' },
});
`;

/**
 * Serializes one manifest the way workspace manifests are formatted.
 *
 * @param manifest - manifest object
 *
 * @returns manifest text
 */
function manifestText(manifest: Readonly<Record<string, unknown>>,): string {
  return `${JSON.stringify(
    manifest,
    undefined,
    2,
  )}\n`;
}

/**
 * Fixture workspace files keyed by repository path.
 */
const WORKSPACE_FILES: Readonly<Record<string, string>> = {
  'package/config/pnpr/config.yaml': "auth:\n  oidc:\n    - workloads:\n        - registry: fixture\n          packages:\n            - '@s/app'\n            - '@s/base'\n            - '@s/other'\n            - '@s/tool'\n\nweb:\n  enable: false\n",
  'package/module/base/package.json': manifestText({
    name: '@s/base',
    version: '1.0.0',
  },),
  'package/module/app/package.json': manifestText({
    name: '@s/app',
    version: '2.0.0',
    dependencies: { '@s/base': 'workspace:*', },
  },),
  'package/module/tool/package.json': manifestText({
    name: '@s/tool',
    version: '0.4.9',
    devDependencies: { '@s/base': 'workspace:*', },
  },),
  'package/module/tool/src/index.ts': "import { base } from '@s/base/ts';\n\nexport const tool = base;\n",
  'package/module/other/package.json': manifestText({
    name: '@s/other',
    version: '1.0.0',
    devDependencies: { '@s/base': 'workspace:*', },
  },),
  'package/module/other/src/index.unit.test.ts': "import '@s/base';\n",
};

/**
 * Reads exact Git object text with real Git.
 *
 * @param repository - disposable repository
 *
 * @param revision - Git object expression
 *
 * @returns exact text
 */
async function gitText({
  repository,
  revision,
}: Readonly<{
  repository: string;
  revision: string;
}>,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      revision,
    ],
    cwd: repository,
  },)).stdout;
}

/**
 * Exercises a hand bump that ripples to runtime and bundled dependents only.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyDependentVersionBump({ env: process.env });
 * ```
 */
export async function verifyDependentVersionBump({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Disposable workspace repository.
   */
  const repository = '/work/dependent-version-bump';
  await initializePostCommitRepository(repository,);
  await Promise.all(Object.entries(WORKSPACE_FILES,)
    .map(async function writeWorkspaceFile([path, text,],) {
    await mkdir(
      dirname(`${repository}/${path}`,),
      { recursive: true, },
    );
    await writeFile(
      `${repository}/${path}`,
      text,
    );
  },),);
  await writeFile(
    `${repository}/cli-git.config.ts`,
    DEPENDENT_BUMP_CONFIG,
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      '--all',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'workspace baseline',
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

  await writeFile(
    `${repository}/package/module/base/package.json`,
    manifestText({
      name: '@s/base',
      version: '1.1.0',
    },),
  );
  // Staging a hand bump must succeed: `git add` cannot apply the ripple, so the policy leaves it to the commit.
  await execute({
    command: 'git',
    args: [
      'add',
      'package/module/base/package.json',
    ],
    cwd: repository,
    env,
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'bump base',
      'package/module/base/package.json',
    ],
    cwd: repository,
    env,
  },);

  /**
   * Expected committed manifests after the ripple.
   */
  const expected: Readonly<Record<string, string>> = {
    'package/module/base/package.json': manifestText({
      name: '@s/base',
      version: '1.1.0',
    },),
    'package/module/app/package.json': manifestText({
      name: '@s/app',
      version: '2.0.1',
      dependencies: { '@s/base': 'workspace:*', },
    },),
    'package/module/tool/package.json': manifestText({
      name: '@s/tool',
      version: '0.4.10',
      devDependencies: { '@s/base': 'workspace:*', },
    },),
    'package/module/other/package.json': WORKSPACE_FILES['package/module/other/package.json'] ?? '',
  };
  for (const [path, text,] of Object.entries(expected,)) {
    assertFixtureEqual({
      // oxlint-disable-next-line no-await-in-loop -- Sequential reads keep assertion output ordered by manifest.
      actual: await gitText({
        repository,
        revision: `HEAD:${path}`,
      },),
      expected: text,
      context: `committed ${path}`,
    },);
    assertFixtureEqual({
      // oxlint-disable-next-line no-await-in-loop -- Sequential reads keep assertion output ordered by manifest.
      actual: await readFile(
        `${repository}/${path}`,
        'utf8',
      ),
      expected: text,
      context: `worktree ${path}`,
    },);
  }
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'status',
        '--porcelain',
      ],
      cwd: repository,
    },)).stdout,
    expected: '',
    context: 'dependent bump clean status',
  },);
}
