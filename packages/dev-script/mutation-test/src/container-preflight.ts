/**
 * Runtime preflights executed inside the restricted mutation container.
 *
 * @example
 * ```ts
 * await runPreflights('/work/packages/dev-script/file-enforcer');
 * ```
 */

import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import {
  INLINE_NODE_SCRIPT,
  TEST_FILES_ENV,
} from './inline-node.ts';

/**
 * Directory where temporary smoke-test files are written inside the work tree.
 */
const SMOKE_DIR = '.mutation-smoke';

/**
 * Runs latest Node native TypeScript syntax smoke.
 *
 * @example
 * ```ts
 * await nativeTypeScriptSmoke();
 * ```
 */
export async function nativeTypeScriptSmoke(): Promise<void> {
  /**
   * Temporary TypeScript smoke file executed by plain Node.
   */
  const smokeFile = join(
    await mkdtemp(join(
      tmpdir(),
      'mutation-native-ts-',
    ),),
    'smoke.ts',
  );
  await writeFile(
    smokeFile,
    'const answer: number = 42;\nconsole.log(answer);\n',
    'utf8',
  );
  await spawn(
    'node',
    [smokeFile,],
  );
}

/**
 * Writes a smoke file under the package smoke directory.
 *
 * @param options - Package cwd, file name, and content.
 *
 * @returns Package-relative smoke path.
 *
 * @example
 * ```ts
 * await writeSmokeFile({ packageCwd: '/work/pkg', name: 'a.ts', content: 'console.log(1)' });
 * ```
 */
async function writeSmokeFile(options: {
  readonly packageCwd: string;
  readonly name: string;
  readonly content: string;
},): Promise<string> {
  /**
   * Absolute smoke directory under target package.
   */
  const smokeDir = join(
    options.packageCwd,
    SMOKE_DIR,
  );
  await mkdir(
    smokeDir,
    { recursive: true, },
  );
  /**
   * Package-relative smoke file path.
   */
  const relative = join(
    SMOKE_DIR,
    options.name,
  );
  await writeFile(
    join(
      options.packageCwd,
      relative,
    ),
    options.content,
    'utf8',
  );
  return relative;
}

/**
 * Workspace dependency prefix identifying internal packages in a manifest.
 */
const WORKSPACE_SCOPE_PREFIX = '@monochromatic-dev/';

/**
 * Returns whether one installed dependency declares a `./ts` export.
 *
 * Not every workspace package exposes source through a `./ts` subpath
 * (config packages like config-tsdown do not), so the smoke must consult
 * each dependency's own manifest instead of assuming the convention.
 *
 * @param options - Target package cwd and dependency name.
 *
 * @returns Whether `<name>/ts` is resolvable by exports.
 *
 * @example
 * ```ts
 * await hasTsExport({ packageCwd: '/work/packages/module/fs-path', name: '@monochromatic-dev/module-logger' });
 * // true
 * ```
 */
async function hasTsExport(options: {
  readonly packageCwd: string;
  readonly name: string;
},): Promise<boolean> {
  try {
    /**
     * Parsed dependency manifest resolved through the package's own
     * node_modules so pnpm's isolated layout is honored.
     */
    const manifest = JSON.parse(await readFile(
      join(
        options.packageCwd,
        'node_modules',
        options.name,
        'package.json',
      ),
      'utf8',
    ),) as {
      readonly exports?: Readonly<Record<string, unknown>>;
    };
    return (manifest.exports !== undefined)
      && (manifest.exports['./ts'] !== undefined);
  }
  catch (error) {
    console.warn(`[mutation-test] ts-export probe failed for ${options.name}: ${String(error,)}`,);
    return false;
  }
}

/**
 * Reads workspace `/ts` import specs declared by target package's manifest.
 *
 * Derived from `dependencies` plus `devDependencies` so the smoke only
 * exercises imports the package can actually resolve; a hardcoded spec list
 * fails packages that lack those specific dependencies. Dependencies whose
 * exports omit `./ts` are skipped rather than failing the smoke.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @returns Workspace import specs ending in `/ts`, possibly empty.
 *
 * @example
 * ```ts
 * await workspaceImportSpecs('/work/packages/module/fs-path');
 * // ['@monochromatic-dev/module-logger/ts', ...]
 * ```
 */
async function workspaceImportSpecs(packageCwd: string,): Promise<readonly string[]> {
  /**
   * Parsed target package manifest.
   */
  const manifest = JSON.parse(await readFile(
    join(
      packageCwd,
      'package.json',
    ),
    'utf8',
  ),) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };

  /**
   * Workspace-scoped dependency names from both dependency blocks.
   */
  const workspaceNames = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  },)
    .filter(function isWorkspacePackage(name,): boolean {
      return name.startsWith(WORKSPACE_SCOPE_PREFIX,);
    },);

  /**
   * Per-dependency `./ts` export availability, resolved concurrently.
   */
  const exportChecks = await Promise.all(workspaceNames.map(
    async function checkTsExport(name,): Promise<readonly [
      string,
      boolean,
    ]> {
      return [
        name,
        await hasTsExport({
          packageCwd,
          name,
        },),
      ];
    },
  ),);

  return exportChecks
    .filter(function keepExported(entry,): boolean {
      return entry[1];
    },)
    .map(function toTsSpec(entry,): string {
      return `${entry[0]}/ts`;
    },);
}

/**
 * Proves workspace `/ts` imports resolve to real source paths outside node_modules.
 *
 * Specs come from target package's own manifest; packages without workspace
 * dependencies skip this smoke instead of failing on imports they never had.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @example
 * ```ts
 * await workspaceImportSmoke('/work/packages/dev-script/file-enforcer');
 * ```
 */
export async function workspaceImportSmoke(packageCwd: string,): Promise<void> {
  /**
   * Workspace import specs declared by target package.
   */
  const specs = await workspaceImportSpecs(packageCwd,);

  if (specs.length === 0)
    return;

  /**
   * Package-relative workspace import smoke file.
   */
  const smokeFile = await writeSmokeFile({
    packageCwd,
    name: 'workspace-import-smoke.ts',
    content: `import { realpathSync } from 'node:fs';
const specs = ${JSON.stringify(specs,)};
for (const spec of specs) {
  const resolved = import.meta.resolve(spec);
  const real = realpathSync(new URL(resolved));
  if (!real.includes('/work/packages/')) throw new Error(\`workspace import stayed outside /work/packages: \${spec} -> \${real}\`);
  if (real.includes('/node_modules/')) throw new Error(\`workspace import resolved through node_modules: \${spec} -> \${real}\`);
}
console.log('workspace import smoke ok');
`,
  },);
  await spawn(
    'node',
    [smokeFile,],
    { cwd: packageCwd, },
  );
}

/**
 * Proves relative imports with explicit `.ts` specifiers execute under plain Node.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @example
 * ```ts
 * await relativeImportSmoke('/work/packages/dev-script/file-enforcer');
 * ```
 */
export async function relativeImportSmoke(packageCwd: string,): Promise<void> {
  await writeSmokeFile({
    packageCwd,
    name: 'relative-target.ts',
    content: 'export const marker: string = "relative-smoke";\n',
  },);
  /**
   * Package-relative relative-import entry file.
   */
  const smokeFile = await writeSmokeFile({
    packageCwd,
    name: 'relative-entry.ts',
    content: 'import { marker } from "./relative-target.ts";\nconsole.log(marker);\n',
  },);
  await spawn(
    'node',
    [smokeFile,],
    { cwd: packageCwd, },
  );
}

/**
 * Proves the inline Node sequencer executes every selected test file and preserves exit status.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @example
 * ```ts
 * await inlineNodeTwoFileSmoke('/work/packages/dev-script/file-enforcer');
 * ```
 */
export async function inlineNodeTwoFileSmoke(packageCwd: string,): Promise<void> {
  /**
   * First package-relative marker test for inline sequencing.
   */
  const first = await writeSmokeFile({
    packageCwd,
    name: 'inline-first.ts',
    content: 'console.log("inline-first-marker");\n',
  },);
  /**
   * Second package-relative marker test for inline sequencing.
   */
  const second = await writeSmokeFile({
    packageCwd,
    name: 'inline-second.ts',
    content: 'console.log("inline-second-marker");\n',
  },);
  /**
   * Node sequencer result containing both marker outputs.
   */
  const result = await spawn(
    'node',
    [
      '-e',
      INLINE_NODE_SCRIPT,
    ],
    {
      cwd: packageCwd,
      env: {
        ...process.env,
        [TEST_FILES_ENV]: JSON.stringify([
          first,
          second,
        ],),
      },
    },
  );

  if ((!result.stdout
    .includes('inline-first-marker',))
    || (!result.stdout
      .includes('inline-second-marker',)))
    throw new Error(`Inline node smoke did not execute both files: ${result.stdout}`,);
}

/**
 * Runs all container preflights before Stryker starts mutating.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @example
 * ```ts
 * await runPreflights('/work/packages/dev-script/file-enforcer');
 * ```
 */
export async function runPreflights(packageCwd: string,): Promise<void> {
  await nativeTypeScriptSmoke();
  await workspaceImportSmoke(packageCwd,);
  await relativeImportSmoke(packageCwd,);
  await inlineNodeTwoFileSmoke(packageCwd,);
}
