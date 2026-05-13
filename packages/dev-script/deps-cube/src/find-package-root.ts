/**
 * Resolves this package's root directory at load time by walking up from
 * `import.meta.dirname` until a `package.json` whose `name` matches
 * {@link PACKAGE_NAME} is found.
 *
 * Why this module exists: two call sites need the same root — {@link
 * cli.ts} for the output `dist/<file>.html` path, and {@link render-html.ts}
 * for the `Bun.build` entry path of the browser-side controller. Both
 * must resolve the package root regardless of whether they're running
 * from `<pkg>/src/` (source mode, `bun src/cli.ts`) or
 * `<pkg>/dist/final/node/` (built mode, `bin: dist/final/node/cli.mjs`).
 * A single shared module solves it for both and caches the result.
 *
 * The walk validates the matched `package.json` by name so a missing or
 * malformed local manifest fails loudly instead of silently landing on
 * a parent monorepo `package.json`.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import {
  dirname,
  resolve as resolvePath,
} from 'node:path';

//region Constants

/**
 * Name of this package as recorded in its `package.json`. Used by
 * {@link findPackageRoot} to confirm the walk landed on this package's
 * own manifest.
 */
export const PACKAGE_NAME = '@monochromatic-dev/dev-script-deps-cube';

//endregion Constants

//region Walk

/**
 * Walks up from `dir` searching for a `package.json` whose `name`
 * field equals `name`, and returns the directory that contains it.
 * Recursion terminates either at the matching package (success) or at
 * the filesystem root (throws).
 *
 * The name check is defensive: if the local `package.json` were
 * deleted or corrupted, the walk would otherwise silently land on a
 * parent manifest. Matching by name forces an explicit error instead.
 *
 * @param dir - Starting directory; the function tests `dir/package.json` first, then recurses to `dirname(dir)`.
 * @param name - Expected `name` value in the matched `package.json`.
 *
 * @returns Absolute path of the directory containing the matching `package.json`.
 *
 * @throws When no matching `package.json` is found up to the filesystem root.
 *
 * @example
 * ```ts
 * const root = await findPackageRoot({ dir: import.meta.dirname, name: '\@scope/pkg' });
 * ```
 */
export async function findPackageRoot(
  {
    dir,
    name,
  }: {
    dir: string;
    name: string;
  },
): Promise<string> {
  const candidate = resolvePath(dir, 'package.json',);
  try {
    const contents = await readFile(candidate, 'utf8',);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns `any`; package.json shape is well-known and we only consume the optional `name` field, which the `===` check tolerates if absent.
    const parsed = JSON.parse(contents,) as { name?: string; };
    if (parsed.name === name) return dir;
  } catch {
    // candidate file missing, unreadable, or malformed JSON: keep walking upward
  }
  const parent = dirname(dir,);
  if (parent === dir) {
    throw new Error(
      `could not find package.json with name ${name} walking up from ${dir}`,
    );
  }
  return findPackageRoot({
    dir: parent,
    name,
  },);
}

//endregion Walk

//region Module-level resolution

/**
 * Absolute path of this package's root directory.
 *
 * Resolved once at module load via {@link findPackageRoot} using
 * `import.meta.dirname` as the starting point. The value is identical
 * whether this module is loaded from `<pkg>/src/find-package-root.ts`
 * (source mode) or `<pkg>/dist/final/node/find-package-root.mjs`
 * (built mode after tsdown bundles a separate file) — both walk up to
 * the same package root.
 *
 * Even after tsdown bundles every module of this package into a single
 * `cli.mjs`, `import.meta.dirname` at that bundle's evaluation time
 * points at `dist/final/node/`, and the walk still terminates at the
 * package root one or two levels above.
 */
export const PACKAGE_ROOT: string = await findPackageRoot({
  dir: import.meta.dirname,
  name: PACKAGE_NAME,
},);

//endregion Module-level resolution
