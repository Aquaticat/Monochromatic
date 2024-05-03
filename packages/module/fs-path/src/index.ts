import {
  access as fsAccess,
  appendFile as fsAppendFile,
  chmod as fsChmod,
  chown as fsChown,
  constants as fsConstants,
  copyFile as fsCopyFile,
  cp as fsCp,
  lchown as fsLchown,
  link as fsLink,
  lstat as fsLstat,
  lutimes as fsLutimes,
  mkdir as fsMkdir,
  mkdtemp as fsMkdtemp,
  opendir as fsOpendir,
  readdir as fsReaddir,
  readFile as fsReadFile,
  readlink as fsReadlink,
  realpath as fsRealpath,
  rename as fsRename,
  rm as fsRm,
  stat as fsStat,
  statfs as fsStatfs,
  symlink as fsSymlink,
  truncate as fsTruncate,
  unlink as fsUnlink,
  utimes as fsUtimes,
  writeFile as fsWriteFile,
} from 'node:fs/promises';

import {
  delimiter as pathDelimiter,
  format as pathFormat,
  isAbsolute as pathIsAbsolute,
  join as pathJoin,
  normalize as pathNormalize,
  parse as pathParse,
  type ParsedPath,
  relative as pathRelative,
  resolve as pathResolve,
  sep as pathSep,
} from 'node:path';

import { constants as fsC } from 'node:fs';

import {
  mapParallelAsync,
  tryCatchAsync,
} from 'rambdax';

export const path = Object.freeze({
  isAbsolute: pathIsAbsolute,
  resolve: pathResolve,
  join: pathJoin,
  relative: pathRelative,
  sep: pathSep,
  format: pathFormat,
  delimiter: pathDelimiter,
  normalize: pathNormalize,
  parseFs: async function pathParseFs(
    ...args: Parameters<typeof pathParse>
  ): Promise<ParsedPath & Pick<URL, 'search' | 'searchParams' | 'hash'>> {
    const pathUrl = new URL(args[0], 'path://');
    const pathSearch = pathUrl.search;
    const pathHash = pathUrl.hash;
    const pathWoTrailingHash = (args[0].endsWith('#')) ? args[0].slice(0, -'#'.length) : args[0];
    const pathWoHash = pathHash ? pathWoTrailingHash.slice(0, -pathHash.length) : pathWoTrailingHash;
    const pathWoSearch = pathSearch ? pathWoHash.slice(0, -pathSearch.length) : pathWoHash;
    try {
      if ((await fsStat(pathWoSearch)).isDirectory()) {
        const eliminatedDots = pathWoSearch.replaceAll('.', 'replacedDot');
        const pathObjOfEliminatedDots = pathParse(eliminatedDots);
        return {
          ...pathObjOfEliminatedDots,
          dir: pathObjOfEliminatedDots.dir.replaceAll('replacedDot', '.'),
          base: pathObjOfEliminatedDots.base.replaceAll('replacedDot', '.'),
          name: pathObjOfEliminatedDots.name.replaceAll('replacedDot', '.'),
          search: pathSearch,
          searchParams: pathUrl.searchParams,
          hash: pathHash,
        };
      }
      return { ...pathParse(pathWoSearch), search: pathSearch, searchParams: pathUrl.searchParams, hash: pathHash };
    } catch {
      return { ...pathParse(pathWoSearch), search: pathSearch, searchParams: pathUrl.searchParams, hash: pathHash };
    }
  },
  split: function pathSplit(path: string) {
    return path.split(pathSep);
  },
});

const mFsC = {
  ...fsC,
  S_IAA: fsC.S_IRUSR
    | fsC.S_IWUSR
    | fsC.S_IXUSR
    | fsC.S_IRGRP
    | fsC.S_IWGRP
    | fsC.S_IXGRP
    | fsC.S_IROTH
    | fsC.S_IWOTH
    | fsC.S_IXOTH,
  S_IAUSR: fsC.S_IRUSR
    | fsC.S_IWUSR
    | fsC.S_IXUSR,
  S_IAGRP: fsC.S_IRGRP
    | fsC.S_IWGRP
    | fsC.S_IXGRP,
  S_IAOTH: fsC.S_IROTH
    | fsC.S_IWOTH
    | fsC.S_IXOTH,
  S_IRA: fsC.S_IRUSR | fsC.S_IRGRP | fsC.S_IROTH,
  S_IWA: fsC.S_IWUSR | fsC.S_IWGRP | fsC.S_IWOTH,
  S_IXA: fsC.S_IXUSR | fsC.S_IXGRP | fsC.S_IXOTH,
};

async function fsReadFileU(path: string): Promise<string>;
async function fsReadFileU(...args: Parameters<typeof fsReadFile>): ReturnType<typeof fsReadFile> {
  if (args[1]) {
    if (typeof args[1] === 'string' || typeof args[1].encoding === 'string') {
      return await fsReadFile(...args);
    }
    return await fsReadFile(args[0], { ...args[1], encoding: 'utf8' });
  }
  return await fsReadFile(args[0], 'utf8');
}

async function fsAccessM(...args: Parameters<typeof fsAccess>): ReturnType<typeof fsAccess> {
  const pathUrl = new URL(args[0], 'path://');
  const pathSearch = pathUrl.search;
  const pathHash = pathUrl.hash;
  const pathWoTrailingHash = (String(args[0]).endsWith('#')) ? String(args[0]).slice(0, -'#'.length) : args[0];
  const pathWoHash = pathHash ? String(pathWoTrailingHash).slice(0, -pathHash.length) : pathWoTrailingHash;
  const pathWoSearch = pathSearch ? String(pathWoHash).slice(0, -pathSearch.length) : pathWoHash;
  try {
    return await fsAccess(pathWoSearch);
  } catch {
    await fsChmod(pathWoSearch, mFsC.S_IAA);
  }
  return await fsAccess(pathWoSearch);
}

const fsExists: (...args: Parameters<typeof fsAccessM>) => Promise<boolean> = tryCatchAsync(
  async function accessTrue(...args: Parameters<typeof fsAccessM>) {
    await fs.accessM(...args);
    return true;
  },
  false,
);

export const fs = Object.freeze({
  chmod: fsChmod,
  chown: fsChown,
  lchown: fsLchown,
  cp: fsCp,
  lutimes: fsLutimes,
  link: fsLink,
  lstat: fsLstat,
  mkdtemp: fsMkdtemp,
  readlink: fsReadlink,
  realpath: fsRealpath,
  rename: fsRename,
  statfs: fsStatfs,
  symlink: fsSymlink,
  truncate: fsTruncate,
  unlink: fsUnlink,
  utimes: fsUtimes,
  constants: fsConstants,
  appendFile: fsAppendFile,
  writeFile: fsWriteFile,
  copyFile: fsCopyFile,
  mkdir: fsMkdir,
  readdir: fsReaddir,
  access: fsAccess,
  opendir: fsOpendir,
  rm: fsRm,
  C: mFsC,
  readFileU: fsReadFileU,
  readFileMU: async function fsReadFileMU(...args: Parameters<typeof fsReadFileU>): ReturnType<typeof fsReadFileU> {
    await fs.accessM(args[0]);
    return await fsReadFileU(...args);
  },
  stat: fsStat,

  accessM: fsAccessM,

  exists: fsExists,

  outputFile: async function fsOutputFile(...args: Parameters<typeof fsWriteFile>): ReturnType<typeof fsWriteFile> {
    if (typeof args[0] === 'string') {
      try {
        await fsAccess((await path.parseFs(args[0])).dir);
      } catch (e) {
        try {
          await fsMkdir((await path.parseFs(args[0])).dir, { recursive: true });
        } catch (e) {
        }
      }
    }
    await fsWriteFile(...args);
    return;
  },
  cpFile: async function fsCpFile(...args: Parameters<typeof fsCopyFile>): ReturnType<typeof fsCopyFile> {
    if (typeof args[1] === 'string') {
      try {
        await fsAccess((await path.parseFs(args[1])).dir);
      } catch (e) {
        try {
          await fsMkdir((await path.parseFs(args[1])).dir, { recursive: true });
        } catch (e) {
        }
      }
    }
    await fsCopyFile(...args);
    return;
  },
  empty: async function fsEmpty(path: string) {
    if ((await fsStat(path)).isFile()) {
      await fsWriteFile(path, '');
      return;
    }

    if ((await fsStat(path)).isDirectory()) {
      /* TODO: Replace this with async iterator helper for true parallel. #priority:low
         See https://github.com/tc39/proposal-async-iterator-helpers#concurrency */
      const subFsPaths = await fsReaddir(path);
      await mapParallelAsync(async function removeSubFsPath(subFsPath) {
        return await fsRm(pathJoin(path, subFsPath), { recursive: true });
      }, subFsPaths);
      return;
    }

    throw new TypeError(`path ${path} points to an unsupported fs type`);
  },
});
