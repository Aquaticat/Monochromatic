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
 * File included in runtime image input hashing.
 */
type RuntimeInputFile = {
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
      options.packageRoot,
      'package.json',
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
async function runtimeInputFiles(options: {
  readonly repoRoot: string;
  readonly packageRoot: string;
},): Promise<readonly RuntimeInputFile[]> {
  /**
   * Absolute runtime source paths.
   */
  const sourceFiles = await runtimeSourceFiles(options.packageRoot,);
  /**
   * Relative paths sorted for stable hashing.
   */
  const relativePaths = sortStrings([
    ...staticRuntimeInputFiles(options,),
    ...sourceFiles,
  ].map(function relativeInputPath(absolutePath,): string {
    return toPosixPath(relative(
      options.repoRoot,
      absolutePath,
    ),);
  },),);

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
