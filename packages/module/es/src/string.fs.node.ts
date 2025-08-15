import {
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from './fs.fs.node.ts';
import { pathJoin, } from './fs.pathJoin.node.ts';
import * as shared from './string.fs.shared.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';
import { randomUUID, } from './string.random.ts';

/**
 * Creates a StringFs implementation using Node.js filesystem operations.
 * Provides persistent file-based storage where each key corresponds to a file within a dedicated directory.
 * The directory structure is created automatically and files are managed atomically.
 *
 * @param options - Configuration options for filesystem StringFs
 * @param options.baseDir - Base directory path for storage (defaults to temp directory with random name)
 * @param options.l - Logger instance for tracing operations
 * @param options.id - Unique identifier for this storage instance (auto-generated if not provided)
 * @returns Promise resolving to StringFs implementation backed by Node.js filesystem
 * @throws Error when directory creation fails, file operations fail, or filesystem permissions are insufficient
 *
 * @example
 * ```ts
 * // Using default directory in temp
 * const fs = await getFsStringFs();
 * await fs.set('config.json', '{"theme": "dark"}');
 * const config = await fs.get('config.json'); // '{"theme": "dark"}'
 *
 * // Using custom base directory
 * const customFs = await getFsStringFs({
 *   baseDir: '/var/data/my-app',
 *   id: 'production-storage'
 * });
 * ```
 */
export async function getFsStringFs(
  { baseDir: passedBaseDir, l: passedL, id: passedId, }: {
    baseDir?: string;
    l?: Logger;
    id?: string;
  } = {},
): Promise<shared.StringFs> {
  /** Logger instance for tracing filesystem operations and debugging directory access */
  const l: Logger = passedL ?? consoleLogger;
  l.trace('getFsStringFs',);

  /** Unique identifier used as directory name within base directory for storage isolation */
  const id = passedId ?? randomUUID();

  /** Base directory path where StringFs directory will be created - defaults to temp with random name */
  const baseDir: string = passedBaseDir ?? pathJoin('/tmp', `stringfs-${randomUUID()}`,);

  /** Full directory path for this StringFs instance combining base directory and unique ID */
  const storageDir = pathJoin(baseDir, id,);

  // Ensure storage directory exists
  try {
    await mkdir(storageDir, { recursive: true, },);
  }
  catch (error: unknown) {
    throw new Error('mkdir', { cause: error, },);
  }

  return {
    id,
    async get(key: string,): Promise<string | undefined> {
      try {
        /** Full file path for the requested key within the storage directory */
        const filePath = pathJoin(storageDir, key,);
        return await readFile(filePath, { encoding: 'utf8', },);
      }
      catch (error: unknown) {
        // File not found is expected, return undefined
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
          return undefined;
        throw new Error('get', { cause: error, },);
      }
    },
    async set(key: string, value: string,): Promise<void> {
      try {
        /** Full file path for the target key within the storage directory */
        const filePath = pathJoin(storageDir, key,);
        await writeFile(filePath, value, { encoding: 'utf8', },);
      }
      catch (error: unknown) {
        throw new Error('set', { cause: error, },);
      }
    },
    async delete(key: string,): Promise<void> {
      try {
        /** Full file path for the key to delete within the storage directory */
        const filePath = pathJoin(storageDir, key,);
        await unlink(filePath,);
      }
      catch (error: unknown) {
        // File not found is expected, ignore
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
          return;
        throw new Error('delete', { cause: error, },);
      }
    },
    async keys(): Promise<string[]> {
      try {
        /** Array of all filenames in the storage directory representing available keys */
        const entries = await readdir(storageDir,);
        return entries;
      }
      catch (error: unknown) {
        // Directory not found means no keys exist
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
          return [];
        throw new Error('keys', { cause: error, },);
      }
    },
  };
}

export * from './string.fs.shared.ts';
