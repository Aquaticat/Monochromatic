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
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import {
  INLINE_NU_SCRIPT,
  TEST_FILES_ENV,
} from './inline-nu.ts';

/**
 * Directory where temporary smoke-test files are written inside the work tree.
 */
const SMOKE_DIR = '.mutation-smoke';

/**
 * Runs latest Node native TypeScript syntax smoke.
 *
 * @returns Promise resolving after smoke exits successfully.
 *
 * @example
 * ```ts
 * await nativeTypeScriptSmoke();
 * ```
 */
export async function nativeTypeScriptSmoke(): Promise<void> {
  const smokeFile = join(
    await mkdtemp(join(tmpdir(), 'mutation-native-ts-',),),
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
  const smokeDir = join(options.packageCwd, SMOKE_DIR,);
  await mkdir(
    smokeDir,
    { recursive: true, },
  );
  const relative = join(SMOKE_DIR, options.name,);
  await writeFile(
    join(options.packageCwd, relative,),
    options.content,
    'utf8',
  );
  return relative;
}

/**
 * Proves workspace `/ts` imports resolve to real source paths outside node_modules.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @returns Promise resolving after import resolution succeeds.
 *
 * @example
 * ```ts
 * await workspaceImportSmoke('/work/packages/dev-script/file-enforcer');
 * ```
 */
export async function workspaceImportSmoke(packageCwd: string,): Promise<void> {
  const smokeFile = await writeSmokeFile({
    packageCwd,
    name: 'workspace-import-smoke.ts',
    content: `import { realpathSync } from 'node:fs';
const specs = ['@monochromatic-dev/module-test/ts', '@monochromatic-dev/module-logger/ts'];
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
 * @returns Promise resolving after smoke exits successfully.
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
 * Proves inline Nushell executes every selected test file and preserves exit status.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @returns Promise resolving after both smoke files execute.
 *
 * @example
 * ```ts
 * await inlineNuTwoFileSmoke('/work/packages/dev-script/file-enforcer');
 * ```
 */
export async function inlineNuTwoFileSmoke(packageCwd: string,): Promise<void> {
  const first = await writeSmokeFile({
    packageCwd,
    name: 'inline-first.ts',
    content: 'console.log("inline-first-marker");\n',
  },);
  const second = await writeSmokeFile({
    packageCwd,
    name: 'inline-second.ts',
    content: 'console.log("inline-second-marker");\n',
  },);
  const result = await spawn(
    'nu',
    [
      '-c',
      INLINE_NU_SCRIPT,
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

  if (!result.stdout.includes('inline-first-marker',)
    || !result.stdout.includes('inline-second-marker',))
    throw new Error(`Inline Nu smoke did not execute both files: ${result.stdout}`,);
}

/**
 * Runs all container preflights before Stryker starts mutating.
 *
 * @param packageCwd - Target package cwd inside `/work`.
 *
 * @returns Promise resolving after all preflights pass.
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
  await inlineNuTwoFileSmoke(packageCwd,);
}
