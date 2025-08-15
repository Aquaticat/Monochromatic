import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { mapIterableAsync, } from './iterable.map.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';

import { direntPath, } from './dirent.path.ts';
import { unary, } from './function.nary.ts';
import * as shared from './string.store.shared.ts';

/** Default priority value for filesystem storage implementations. */
export const fsStringStoreDefaultPriority: number = shared.persistentStringStoreDefaultPriority;

/**
 * Configuration options for filesystem-based string storage.
 */
export type FsStringStoreArguments = shared.StringStoreArguments;

/**
 * Filesystem-based implementation of string storage that persists data to disk.
 * Provides key-value storage using the file system as the backend.
 */
export class FsStringStore implements shared.StringStore {
  /** Root directory for files. */
  public readonly id: string;

  /** Priority tier used by consensus. */
  public priority: number = fsStringStoreDefaultPriority;

  /** Logger used for trace/error output. */
  public l: Logger = consoleLogger;

  /**
   * Creates a new filesystem storage instance.
   * @param path - Root directory path for storing files
   * @param priority - Priority tier for consensus, defaults to 1
   * @param l - Logger instance, defaults to console logger
   */
  constructor({ id, priority, l, }: FsStringStoreArguments,) {
    this.id = id;
    priority && (this.priority = priority);
    l && (this.l = l);
  }

  /**
   * Asynchronous factory that ensures storage directory exists before returning instance.
   * @param fsStorageArguments - Configuration for the storage instance
   * @returns Initialized filesystem storage ready for use
   */
  static async create(
    fsStorageArguments: FsStringStoreArguments,
  ): Promise<FsStringStore> {
    const fsStorage = new FsStringStore(fsStorageArguments,);
    await mkdir(fsStorageArguments.id, { recursive: true, },);
    return fsStorage;
  }

  /**
   * Reads stored value from filesystem by key.
   * @param key - Filename to read from storage directory
   * @returns Stored string content, or undefined if file does not exist
   */
  public async get(key: string,): Promise<string | undefined> {
    this.l.trace(`get ${key}`,);
    try {
      return await readFile(join(this.id, key,), 'utf8',);
    }
    catch (error: unknown) {
      // Return undefined on "file not found" scenarios, rethrow otherwise
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code?: string; }).code;
        if (code === 'ENOENT')
          return undefined;
      }
      throw error;
    }
  }

  /**
   * Writes string value to filesystem using key as filename.
   * @param key - Filename to write in storage directory
   * @param value - String content to persist
   * @returns Storage instance for chaining
   */
  public async set(key: string, value: string,): Promise<this> {
    this.l.trace(`set ${key}`,);
    await writeFile(join(this.id, key,), value,);
    return this;
  }

  /**
   * Removes all files and directories from storage root directory.
   * Recursively deletes everything under the configured path.
   */
  public async clear(): Promise<void> {
    this.l.trace('clear',);
    const targets = (await readdir(this.id, { withFileTypes: true, })).map(unary(direntPath,),);
    await mapIterableAsync(async (p: string,) => {
      await rm(p, { recursive: true, force: true, },);
    }, targets,);
  }

  /**
   * Removes specific entry from storage by key.
   * @param key - Filename to delete from storage directory
   * @returns Whether deletion occurred successfully
   */
  public async delete(key: string,): Promise<boolean> {
    this.l.trace(`delete ${key}`,);
    try {
      await rm(join(this.id, key,), { recursive: true, force: true, },);
      return true;
    }
    catch (error: unknown) {
      this.l.error(`failed to delete ${key} ${JSON.stringify(error,)}`,);
      return false;
    }
  }
}

export * from './string.store.shared.ts';
