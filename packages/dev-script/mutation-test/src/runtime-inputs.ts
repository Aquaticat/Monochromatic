/**
 * Runtime image input hashing for stale-image avoidance.
 *
 * @example
 * ```ts
 * await runtimeInputHash({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test' });
 * ```
 */

import { createHash, } from 'node:crypto';
import {
  access,
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  join,
  relative,
} from 'node:path';

import {
  sortStrings,
  toPosixPath,
} from './path-utils.ts';

/**
 * Extension for TypeScript files that change baked runtime behavior.
 */
const TYPESCRIPT_EXTENSION = '.ts';

/**
 * Package manifest filename used by pnpm workspace install.
 */
const PACKAGE_MANIFEST = 'package.json';

/**
 * File included in runtime image input hashing.
 */
export type RuntimeInputFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
};

/**
 * Walks files below a runtime input directory.
 *
 * @param directory - Directory to traverse.
 *
 * @returns Absolute file paths below directory.
 *
 * @example
 * ```ts
 * await walkFiles('/repo/packages/dev-script/mutation-test/src');
 * ```
 */
async function walkFiles(directory: string,): Promise<readonly string[]> {
  /**
   * Directory entries to traverse.
   */
  const entries = await readdir(
    directory,
    { withFileTypes: true, },
  );
  /**
   * Per-entry file lists.
   */
  const nestedFiles = await Promise.all(entries.map(function filesForEntry(entry,): Promise<readonly string[]> {
    /**
     * Absolute entry path.
     */
    const absolutePath = join(
      directory,
      entry.name,
    );

    if (entry.isDirectory())
      return walkFiles(absolutePath,);

    return Promise.resolve(entry.isFile() ? [absolutePath,] : [],);
  },),);

  return nestedFiles.flat();
}

/**
 * Lists TypeScript source files that are baked into the runtime image.
 *
 * @param packageRoot - Runtime package root.
 *
 * @returns Absolute TypeScript source paths.
 *
 * @example
 * ```ts
 * await runtimeSourceFiles('/repo/packages/dev-script/mutation-test');
 * ```
 */
async function runtimeSourceFiles(packageRoot: string,): Promise<readonly string[]> {
  /**
   * Absolute runtime package source directory.
   */
  const sourceRoot = join(
    packageRoot,
    'src',
  );
  /**
   * All files below runtime package source directory.
   */
  const files = await walkFiles(sourceRoot,);

  return files.filter(function isTypeScriptSource(file,): boolean {
    return file.endsWith(TYPESCRIPT_EXTENSION,);
  },);
}

/**
 * Returns whether a file exists.
 *
 * @param path - File path to probe.
 *
 * @returns True when path can be accessed.
 *
 * @example
 * ```ts
 * await fileExists('/repo/package.json');
 * ```
 */
async function fileExists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch {
    return false;
  }
}

/**
 * Lists package manifests two levels below a workspace root.
 *
 * @param workspaceRoot - Root containing package category directories.
 *
 * @returns Absolute package manifest paths.
 *
 * @example
 * ```ts
 * await packageManifestsUnder('/repo/packages');
 * ```
 */
async function packageManifestsUnder(workspaceRoot: string,): Promise<readonly string[]> {
  /**
   * Package category directory entries.
   */
  const categories = await readdir(
    workspaceRoot,
    { withFileTypes: true, },
  );
  /**
   * Manifest lists by package category.
   */
  const manifestsByCategory = await Promise.all(categories
    .filter(function isDirectory(category,): boolean {
      return category.isDirectory();
    },)
    .map(async function manifestsForCategory(category,): Promise<readonly string[]> {
      /**
       * Absolute package category directory.
       */
      const categoryRoot = join(
        workspaceRoot,
        category.name,
      );
      /**
       * Package directory entries within current category.
       */
      const packages = await readdir(
        categoryRoot,
        { withFileTypes: true, },
      );

      /**
       * Candidate package manifests under this category.
       */
      const manifestCandidates = packages
        .filter(function isPackageDirectory(packageEntry,): boolean {
          return packageEntry.isDirectory();
        },)
        .map(function packageManifest(packageEntry,): string {
          return join(
            categoryRoot,
            packageEntry.name,
            PACKAGE_MANIFEST,
          );
        },);
      /**
       * Existence checks for candidate package manifests.
       */
      const manifestChecks = await Promise.all(manifestCandidates.map(async function checkManifest(manifest,): Promise<{
        readonly exists: boolean;
        readonly manifest: string;
      }> {
        return {
          exists: await fileExists(manifest,),
          manifest,
        };
      },),);

      return manifestChecks
        .filter(function hasManifest(check,): boolean {
          return check.exists;
        },)
        .map(function checkedManifest(check,): string {
          return check.manifest;
        },);
    },),);

  return manifestsByCategory.flat();
}

/**
 * Lists workspace package manifests that affect pnpm install in the image.
 *
 * @param repoRoot - Monorepo root.
 *
 * @returns Absolute package manifest paths.
 *
 * @example
 * ```ts
 * await workspacePackageManifests('/repo');
 * ```
 */
async function workspacePackageManifests(repoRoot: string,): Promise<readonly string[]> {
  /**
   * Active package manifests.
   */
  const activeManifests = await packageManifestsUnder(join(
    repoRoot,
    'packages',
  ),);
  /**
   * Deprecated package manifests still included by pnpm workspace globs.
   */
  const deprecatedManifests = await packageManifestsUnder(join(
    repoRoot,
    'packages-deprecated',
  ),);

  return [
    ...activeManifests,
    ...deprecatedManifests,
  ];
}

/**
 * Lists non-source files that affect the baked runtime image.
 *
 * @param options - Repository and runtime package roots.
 *
 * @returns Absolute runtime input paths.
 *
 * @example
 * ```ts
 * staticRuntimeInputFiles({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test' });
 * ```
 */
function staticRuntimeInputFiles(options: {
  readonly repoRoot: string;
  readonly packageRoot: string;
},): readonly string[] {
  return [
    join(
      options.repoRoot,
      'mise.toml',
    ),
    join(
      options.repoRoot,
      PACKAGE_MANIFEST,
    ),
    join(
      options.repoRoot,
      'pnpm-workspace.yaml',
    ),
    join(
      options.repoRoot,
      'pnpm-lock.yaml',
    ),
    join(
      options.packageRoot,
      PACKAGE_MANIFEST,
    ),
    join(
      options.packageRoot,
      'runtime',
      'Containerfile',
    ),
  ];
}

/**
 * Converts absolute path to stable runtime input file metadata.
 *
 * @param options - Repository root and absolute path.
 *
 * @returns Runtime input file metadata.
 *
 * @example
 * ```ts
 * runtimeInputFile({ repoRoot: '/repo', absolutePath: '/repo/mise.toml' });
 * ```
 */
function runtimeInputFile(options: {
  readonly repoRoot: string;
  readonly absolutePath: string;
},): RuntimeInputFile {
  return {
    absolutePath: options.absolutePath,
    relativePath: toPosixPath(relative(
      options.repoRoot,
      options.absolutePath,
    ),),
  };
}

/**
 * Lists ordered runtime image input files.
 *
 * @param options - Repository and runtime package roots.
 *
 * @returns Ordered runtime image input files.
 *
 * @example
 * ```ts
 * await runtimeInputFiles({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test' });
 * ```
 */
export async function runtimeInputFiles(options: {
  readonly repoRoot: string;
  readonly packageRoot: string;
},): Promise<readonly RuntimeInputFile[]> {
  /**
   * Absolute runtime source paths.
   */
  const sourceFiles = await runtimeSourceFiles(options.packageRoot,);
  /**
   * Absolute workspace package manifests.
   */
  const workspaceManifests = await workspacePackageManifests(options.repoRoot,);
  /**
   * Unsorted relative paths for all runtime image inputs.
   */
  const unsortedRelativePaths = [
    ...staticRuntimeInputFiles(options,),
    ...workspaceManifests,
    ...sourceFiles,
  ].map(function relativeInputPath(absolutePath,): string {
    return toPosixPath(relative(
      options.repoRoot,
      absolutePath,
    ),);
  },);
  /**
   * Relative paths sorted for stable hashing.
   */
  const relativePaths = sortStrings([...new Set(unsortedRelativePaths,),],);

  return relativePaths.map(function fileForRelativePath(relativePath,): RuntimeInputFile {
    return runtimeInputFile({
      repoRoot: options.repoRoot,
      absolutePath: join(
        options.repoRoot,
        relativePath,
      ),
    },);
  },);
}

/**
 * Computes a hash for runtime package source and image build inputs.
 *
 * @param options - Repository and runtime package roots.
 *
 * @returns SHA-256 digest for runtime image inputs.
 *
 * @example
 * ```ts
 * await runtimeInputHash({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test' });
 * ```
 */
export async function runtimeInputHash(options: {
  readonly repoRoot: string;
  readonly packageRoot: string;
},): Promise<string> {
  /**
   * Hash accumulator seeded by input paths and bytes.
   */
  const hash = createHash('sha256',);
  /**
   * Ordered runtime input files.
   */
  const files = await runtimeInputFiles(options,);
  /**
   * Runtime input bytes in ordered file order.
   */
  const inputContents = await Promise.all(files.map(function readInputFile(file,): Promise<Buffer> {
    return readFile(file.absolutePath,);
  },),);

  for (const [index, file,] of files.entries()) {
    /**
     * Runtime input bytes matching current ordered file.
     */
    const inputContent = inputContents[index];

    if (inputContent === undefined)
      throw new Error(`Missing runtime input content for ${file.relativePath}`,);

    hash.update(file.relativePath,);
    hash.update('\0',);
    hash.update(inputContent,);
    hash.update('\0',);
  }

  return hash.digest('hex',);
}
