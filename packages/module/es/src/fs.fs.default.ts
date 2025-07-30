/*import { FsaNodeFs } from 'memfs/lib/fsa-to-node';
import type { IFileSystemDirectoryHandle } from 'memfs/lib/fsa/types';
import type { FsPromisesApi } from 'memfs/lib/node/types';

let fsPromises: FsPromisesApi | null = null;
let initializePromise: Promise<FsPromisesApi> | null = null;

async function initialize(): Promise<FsPromisesApi> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    throw new Error('Origin Private File System isn\'t available.');
  }
  const opfsRoot: FileSystemDirectoryHandle = await navigator.storage.getDirectory();
  const fsaNodeFs = new FsaNodeFs(opfsRoot as unknown as IFileSystemDirectoryHandle);
  fsPromises = fsaNodeFs.promises;
  return fsPromises;
}

export async function getFsPromises(): Promise<FsPromisesApi> {
  if (fsPromises) {
    return await fsPromises;
  }
  if (!initializePromise) {
    initializePromise = initialize();
  }
  return initializePromise;
}

// Export wrapped methods for convenience
export async function mkdir(
  path: string,
  options?: { recursive?: boolean; mode?: number; },
): Promise<string | undefined> {
  const fs = await getFsPromises();
  return fs.mkdir(path, options);
}

export async function writeFile(
  path: string,
  data: string | Uint8Array,
  options?: any,
): Promise<void> {
  const fs = await getFsPromises();
  return fs.writeFile(path, data, options);
}*/

/*
 import { FsaNodeFs } from 'memfs/lib/fsa-to-node';
 import type { IFileSystemDirectoryHandle } from 'memfs/lib/fsa/types';
 import type { FsPromisesApi } from 'memfs/lib/node/types';
 import { memoize } from './function.memoize.ts';

 async function initialize(): Promise<FsPromisesApi> {
 const opfsRoot: FileSystemDirectoryHandle = await navigator.storage.getDirectory();
 const fsaNodeFs = new FsaNodeFs(opfsRoot as unknown as IFileSystemDirectoryHandle);
 return fsaNodeFs.promises;
 }

 const memoized = memoize(initialize);

 export async function mkdir(
 path: string,
 options?: { recursive?: boolean; },
 ): Promise<string | undefined> {
 const fs = await memoized();
 return fs.mkdir(path, options);
 }

 export async function writeFile(
 path: string,
 data: string | Uint8Array,
 options?: any,
 ): Promise<void> {
 const fs = await memoized();
 return fs.writeFile(path, data, options);
 }
 */

import {
  appendFile,
  copy,
  createFile,
  exists,
  mkdir,
  move,
  readDir,
  type ReadDirEntry,
  readTextFile,
  remove,
  stat,
  writeFile,
} from 'happy-opfs';
import { unwrapResult, } from './result.unwrap.ts';

async function myMkdir(path: string, _options: { recursive: true; },): Promise<string> {
  const absPath = path.startsWith('/',) ? path : `/${path}`;
  unwrapResult(await mkdir(absPath,),);

  return path;
}

async function myStat(
  path: string,
): Promise<
  { handle: FileSystemHandle; } & FsStats
> {
  const absPath = path.startsWith('/',) ? path : `/${path}`;
  const fsHandle = unwrapResult(await stat(absPath,),);

  return {
    handle: fsHandle,
    isDirectory: () => fsHandle.kind === 'directory',
    isFile: () => fsHandle.kind === 'file',
  };
}

type FsStats = { isDirectory: () => boolean; isFile: () => boolean; };

/**
 * Can be very inaccurate.
 * Written here just so that fs.constants.* won't just error.
 */
const fsConstants = {
  /*  UV_FS_SYMLINK_DIR: 1,
   UV_FS_SYMLINK_JUNCTION: 2,
   O_RDONLY: 0,
   O_WRONLY: 1,
   O_RDWR: 2,
   UV_DIRENT_UNKNOWN: 0,
   UV_DIRENT_FILE: 1,
   UV_DIRENT_DIR: 2,
   UV_DIRENT_LINK: 3,
   UV_DIRENT_FIFO: 4,
   UV_DIRENT_SOCKET: 5,
   UV_DIRENT_CHAR: 6,
   UV_DIRENT_BLOCK: 7,
   S_IFMT: 61_440,
   S_IFREG: 32_768,
   S_IFDIR: 16_384,
   S_IFCHR: 8192,
   S_IFIFO: 4096,
   S_IFLNK: 40_960,
   O_CREAT: 64,
   O_EXCL: 128,
   UV_FS_O_FILEMAP: 0,
   O_TRUNC: 512,
   O_APPEND: 1024,*/
  S_IRUSR: 256,
  // S_IWUSR: 128,
  // F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  /*  X_OK: 1,
   UV_FS_COPYFILE_EXCL: 1,
   COPYFILE_EXCL: 1,
   UV_FS_COPYFILE_FICLONE: 2,
   COPYFILE_FICLONE: 2,
   UV_FS_COPYFILE_FICLONE_FORCE: 4,
   COPYFILE_FICLONE_FORCE: 4,*/
};

async function access(path: string, _mode: number,): Promise<void> {
  // no-op for opfs because opfs doesn't have permissions.
  const absPath = path.startsWith('/',) ? path : `/${path}`;

  const pathExists: boolean = unwrapResult(await exists(absPath,),);

  if (!pathExists)
    throw new Error(`Path ${path} does not exist.`,);
}

async function chmod(path: string, _mode: number,): Promise<void> {
  // no-op for opfs because opfs doesn't have permissions.
  const absPath = path.startsWith('/',) ? path : `/${path}`;

  const pathExists: boolean = unwrapResult(await exists(absPath,),);

  if (!pathExists)
    throw new Error(`Path ${path} does not exist.`,);
}

async function myWriteFile(path: string, data: string,
  options: { flag: 'w' | 'wx' | 'a' | 'ax'; } = { flag: 'w', },): Promise<void>
{
  const absPath = path.startsWith('/',) ? path : `/${path}`;

  const append = options.flag.includes('a',);
  const create = true;
  unwrapResult(await writeFile(absPath, data, { append, create, },),);
}

async function myAppendFile(path: string, data: string,): Promise<void> {
  const absPath = path.startsWith('/',) ? path : `/${path}`;

  unwrapResult(await appendFile(absPath, data,),);
}

async function cp(
  src: string,
  dest: string,
  options: { recursive: boolean; } = { recursive: false, },
): Promise<void> {
  const absSrc = src.startsWith('/',) ? src : `/${src}`;
  const absDest = dest.startsWith('/',) ? dest : `/${dest}`;
  if (options.recursive)
    unwrapResult(await copy(absSrc, absDest,),);
  else
    throw new Error('Copying non-recursively is not supported.',);
}

async function myExists(path: string,): Promise<boolean> {
  const absPath = path.startsWith('/',) ? path : `/${path}`;
  return unwrapResult(await exists(absPath,),);
}

async function myReadDir(path: string,
  options: { withFileTypes: true; recursive: boolean; },): Promise<ReadDirEntry[]>;
async function myReadDir(path: string,
  options: { withFileTypes: false; recursive: boolean; },): Promise<string[]>;
async function myReadDir(path: string,
  options: { withFileTypes: boolean; recursive: boolean; } = {
    withFileTypes: false,
    recursive: false,
  },): Promise<string[] | ReadDirEntry[]>
{
  const absPath = path.startsWith('/',) ? path : `/${path}`;
  const result = unwrapResult(
    await readDir(absPath, { recursive: options.recursive, },),
  );

  const entries = await Array.fromAsync(result,);

  return options.withFileTypes ? entries : entries.map(function getPathOnly(entry,) {
    return entry.path;
  },);
}

async function myReadTextFile(path: string,): Promise<string> {
  const absPath = path.startsWith('/',) ? path : `/${path}`;
  return unwrapResult(await readTextFile(absPath,),);
}

async function rm(path: string,
  options: { force: boolean; recursive: true; },): Promise<void>
{
  const absPath = path.startsWith('/',) ? path : `/${path}`;
  try {
    unwrapResult(await remove(absPath,),);
  }
  catch (error) {
    if (!options.force)
      throw error;
  }
}

export {
  access,
  chmod,
  cp,
  createFile,
  fsConstants,
  type FsStats,
  move,
  myAppendFile as appendFile,
  myExists as exists,
  myMkdir as mkdir,
  myReadDir as readdir,
  myReadTextFile as readTextFile,
  myStat as stat,
  myWriteFile as writeFile,
  rm,
};
