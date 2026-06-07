/**
 * Temporary runtime image build context staging.
 *
 * @example
 * ```ts
 * await using context = await stageRuntimeBuildContext({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test' });
 * ```
 */

import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';

import {
  runtimeInputFiles,
  type RuntimeInputFile,
} from './runtime-inputs.ts';

/**
 * Prefix for temporary runtime build contexts.
 */
const RUNTIME_CONTEXT_PREFIX = 'mutation-runtime-context-';

/**
 * Staged runtime build context removed when disposed.
 */
export type StagedRuntimeBuildContext = {
  /**
   * Temporary build context root.
   */
  readonly root: string;
  /**
   * Runtime package root inside temporary context.
   */
  readonly packageRoot: string;
  /**
   * Removes temporary build context.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable runtime build context metadata.
 *
 * @param options - Staged root and staged package root.
 *
 * @returns Frozen disposable build context.
 *
 * @example
 * ```ts
 * stagedRuntimeBuildContext({ root: '/tmp/context', packageRoot: '/tmp/context/packages/dev-script/mutation-test' });
 * ```
 */
function stagedRuntimeBuildContext(options: {
  readonly root: string;
  readonly packageRoot: string;
},): StagedRuntimeBuildContext {
  /**
   * Temporary build context root.
   */
  const { root, } = options;
  /**
   * Runtime package root inside temporary context.
   */
  const { packageRoot, } = options;

  return Object.freeze({
    root,
    packageRoot,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        root,
        {
          recursive: true,
          force: true,
        },
      );
    },
  },);
}

/**
 * Copies one runtime image input file into the staged context.
 *
 * @param options - Staging root and input file metadata.
 *
 * @example
 * ```ts
 * await copyRuntimeInput({ contextRoot: '/tmp/context', file });
 * ```
 */
async function copyRuntimeInput(options: {
  readonly contextRoot: string;
  readonly file: RuntimeInputFile;
},): Promise<void> {
  /**
   * Runtime input file to copy into context.
   */
  const { file, } = options;
  /**
   * Destination file path inside staged context.
   */
  const destination = join(
    options.contextRoot,
    file.relativePath,
  );

  await mkdir(
    dirname(destination,),
    { recursive: true, },
  );
  await copyFile(
    file.absolutePath,
    destination,
  );
}

/**
 * Stages minimal runtime image build context in a temporary directory.
 *
 * @param options - Repository and runtime package roots.
 *
 * @returns Disposable staged runtime build context.
 *
 * @example
 * ```ts
 * await stageRuntimeBuildContext({ repoRoot: '/repo', packageRoot: '/repo/packages/dev-script/mutation-test' });
 * ```
 */
export async function stageRuntimeBuildContext(options: {
  readonly repoRoot: string;
  readonly packageRoot: string;
},): Promise<StagedRuntimeBuildContext> {
  /**
   * Temporary context root.
   */
  const contextRoot = await mkdtemp(join(
    tmpdir(),
    RUNTIME_CONTEXT_PREFIX,
  ),);
  /**
   * Files to copy into temporary context.
   */
  const files = await runtimeInputFiles(options,);

  await Promise.all(files.map(function copyInput(file,): Promise<void> {
    return copyRuntimeInput({
      contextRoot,
      file,
    },);
  },),);

  return stagedRuntimeBuildContext({
    root: contextRoot,
    packageRoot: join(
      contextRoot,
      'packages',
      'dev-script',
      'mutation-test',
    ),
  },);
}
