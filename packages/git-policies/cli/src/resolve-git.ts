import { constants, } from 'node:fs';
import {
  access,
  readFile,
} from 'node:fs/promises';
import {
  delimiter,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

/**
 * Package name used to detect shims that delegate to this wrapper.
 * Any candidate whose file content contains this string is a shim for us,
 * whether it's a pnpm shell wrapper, a Bun symlink target, or anything else.
 * Real git binaries are ELF executables that will never contain this string.
 */
const PACKAGE_NAME = '@monochromatic-dev/cli-git';

/**
 * Bundle entry path used by pnpm command shims when they point at this wrapper.
 * pnpm's generated `node_modules/.bin/git` script can reference this built file
 * without naming the package, so package-name detection alone misses it.
 */
const BUNDLED_ENTRY_MARKER = 'packages/git-policies/cli/dist/final/node/index.mjs';

/**
 * Text markers that identify scripts delegating back into this wrapper.
 * Real git binaries should not contain these package-specific strings.
 */
const SELF_SHIM_MARKERS: ReadonlySet<string> = new Set([
  PACKAGE_NAME,
  BUNDLED_ENTRY_MARKER,
],);

/**
 * Options for resolving the real git binary.
 */
type ResolveGitOptions = {
  /**
   * PATH-like string to scan. Defaults to current process PATH so production
   * calls follow shell lookup order, while tests can inject isolated paths.
   */
  readonly pathEnv?: string;
  /**
   * Runtime platform used for executable naming.
   */
  readonly platform?: NodeJS.Platform;
  /**
   * Windows executable extensions in shell lookup order.
   */
  readonly pathExtensions?: string;
};

/**
 * Checks whether a candidate binary is a package manager shim that delegates
 * to this wrapper package. Reads the file content and looks for wrapper-specific markers.
 *
 * @param candidatePath - Absolute path to the candidate binary.
 *
 * @returns `true` if the candidate is a shim for this package.
 */
async function isShimForSelf(candidatePath: string,): Promise<boolean> {
  /**
   * Tagged logger for candidate self-shim detection.
   */
  const rl = tagged({
    tag: isShimForSelf.name,
    l,
  },);

  try {
    /**
     * Raw file bytes decoded as UTF-8; scanned below for self-shim markers.
     */
    const content = await readFile(
      candidatePath,
      'utf8',
    );
    return [...SELF_SHIM_MARKERS,].some(function hasSelfShimMarker(marker,) {
      return content.includes(marker,);
    },);
  }
  catch (error: unknown) {
    rl.debug(`could not read ${candidatePath} as a self-shim candidate: ${String(error,)}`,);
    return false;
  }
}

/**
 * Locates the real git binary by scanning PATH entries, skipping any that
 * resolve back into this package's directory tree as detected by
 * {@link isShimForSelf}.
 *
 * Sequential scanning is intentional: we need the first PATH match
 * and can stop immediately, so parallelizing would waste work.
 *
 * @returns Absolute path to the real git binary.
 *
 * @throws When no real git binary is found on PATH.
 *
 * @example
 * ```ts
 * const gitPath = await resolveGit();
 * // => '/usr/bin/git'
 * ```
 */
export async function resolveGit({
  pathEnv = process.env
    .PATH
    ?? '',
  platform = process.platform,
  pathExtensions = process.env
    .PATHEXT
    ?? '.COM;.EXE;.BAT;.CMD',
}: ResolveGitOptions = {},): Promise<string> {
  /**
   * Tagged logger for git binary resolution.
   */
  const rl = tagged({
    tag: resolveGit.name,
    l,
  },);

  /**
   * Individual PATH entries, scanned in order so the first executable git wins.
   */
  const pathDirs = pathEnv.split(delimiter,);
  /**
   * Platform-specific executable names in native lookup order.
   */
  const executableNames = platform === 'win32'
    ? pathExtensions
      .split(';',)
      .filter(function nonemptyExtension(extension,) {
        return extension.length > 0;
      },)
      .map(function gitExecutableName(extension,) {
        return `git${extension.startsWith('.') ? extension : `.${extension}`}`;
      },)
    : ['git',];
  /**
   * Ordered executable candidates across PATH directories and Windows extensions.
   */
  const candidates = pathDirs.flatMap(function candidatesInDirectory(dir,) {
    return executableNames.map(function executableInDirectory(name,) {
      return join(
        dir,
        name,
      );
    },);
  },);

  for (const candidate of candidates) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      await access(
        candidate,
        constants.X_OK,
      );

      // oxlint-disable-next-line no-await-in-loop -- sequential PATH scan; we need the first match and stop
      if (await isShimForSelf(candidate,)) {
        rl.debug(`skipping self at ${candidate}`,);
        continue;
      }

      rl.debug(`resolved real git at ${candidate}`,);
      return candidate;
    }
    catch (error: unknown) {
      rl.debug(`candidate ${candidate} is not usable as real git: ${String(error,)}`,);
      continue;
    }
  }

  throw new Error(
    'cli-git: could not find real git binary on PATH. '
      + 'Ensure Git is installed and PATH/PATHEXT expose its executable.',
  );
}
