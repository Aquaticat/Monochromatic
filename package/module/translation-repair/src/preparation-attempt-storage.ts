import {
  chmod,
  mkdtemp,
  open,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { PreparationAttemptError, } from './preparation-attempt-error.ts';

//region Fixed preparation namespace storage

/**
 * Owner-only directory access for private plan contents and future acquisition records.
 */
const PRIVATE_ATTEMPT_DIRECTORY_MODE = 0o700;

/**
 * Owner-only namespace file access; no plan bytes are shared with other users.
 */
const PRIVATE_ATTEMPT_FILE_MODE = 0o600;

/**
 * Namespace filenames are fixed; this is not an arbitrary journal record-store interface.
 */
export type PreparationAttemptFile = 'root-plan.json' | 'attempt.json';

/**
 * Filesystem operations needed by namespace creation, injectable for deterministic write-failure and ordering tests.
 * Implementations must allocate fresh private directories and use exclusive synced file creation.
 *
 * @example
 * ```ts
 * const storage: PreparationAttemptStorage = preparationAttemptStorage;
 * ```
 */
export type PreparationAttemptStorage = {
  /**
   * Allocates a new private directory, never reopens a previous attempt.
   */
  readonly allocate: (args: { readonly parentDir: string; },) => Promise<string>;
  /**
   * Writes only the fixed namespace files with exclusive creation and completed sync.
   */
  readonly write: (args: {
    readonly dir: string;
    readonly file: PreparationAttemptFile;
    readonly text: string
  },) => Promise<void>;
};

/**
 * Allocates an exclusively created directory under an existing caller-owned parent.
 *
 * @param parentDir - existing private runs parent
 *
 * @returns New directory after its permission boundary is set
 *
 * @throws PreparationAttemptError when allocation or permission setting fails
 *
 * @example
 * ```ts
 * const dir = await allocate({ parentDir });
 * ```
 */
async function allocate({ parentDir, }: { readonly parentDir: string; },): Promise<string> {
  /**
   * Allocates before permission handling so a failed chmod can still name the created directory.
   *
   * @returns Fresh path without reopening prior state
   *
   * @throws PreparationAttemptError when allocation fails
   *
   * @example
   * ```ts
   * const dir = await make();
   * ```
   */
  async function make(): Promise<string> {
    try {
      return await mkdtemp(join(
        parentDir,
        'preparation-',
      ),);
    }
    catch (error) {
      throw new PreparationAttemptError({
        operation: 'create-directory',
        dir: parentDir,
        cause: error,
      },);
    }
  }
  /**
   * The actual newly created path is retained if permission setting fails.
   */
  const dir = await make();
  try {
    await chmod(
      dir,
      PRIVATE_ATTEMPT_DIRECTORY_MODE,
    );
  }
  catch (error) {
    throw new PreparationAttemptError({
      operation: 'create-directory',
      dir,
      cause: error,
    },);
  }
  return dir;
}

/**
 * Creates and syncs one fixed namespace file without replacing existing bytes.
 *
 * @param dir - freshly owned attempt directory
 *
 * @param file - fixed plan or identity filename
 *
 * @param text - complete encoded bytes
 *
 * @throws Error when opening, writing, syncing or closing fails
 *
 * @example
 * ```ts
 * await write({ dir, file: 'root-plan.json', text });
 * ```
 */
async function write({
  dir,
  file,
  text,
}: {
  readonly dir: string;
  readonly file: PreparationAttemptFile;
  readonly text: string
},): Promise<void> {
  if ((file !== 'root-plan.json') && (file !== 'attempt.json'))
    throw new PreparationAttemptError({
      operation: 'file-name',
      dir,
    },);
  /**
   * Exclusive fixed-name handle is closed only after its content sync completes.
   */
  await using handle = await open(
    join(
      dir,
      file,
    ),
    'wx',
    PRIVATE_ATTEMPT_FILE_MODE,
  );
  await handle.writeFile(
    text,
    'utf8',
  );
  await handle.sync();
}

/**
 * Native namespace-only adapter, also available to compose deterministic fault-injection tests.
 */
export const preparationAttemptStorage: PreparationAttemptStorage = {
  allocate,
  write,
};

//endregion Fixed preparation namespace storage
