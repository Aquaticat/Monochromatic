// isolatedDeclarations is turned off for this package, due to the reexports.

import {
  access as nodeFsAccess,
  appendFile as nodeFsAppendFile,
  chmod as nodeFsChmod,
  chown as nodeFsChown,
  constants as nodeFsConstants,
  copyFile as nodeFsCopyFile,
  cp as nodeFsCp,
  type FileHandle,
  lchown as nodeFsLchown,
  link as nodeFsLink,
  lstat as nodeFsLstat,
  lutimes as nodeFsLutimes,
  mkdir as nodeFsMkdir,
  mkdtemp as nodeFsMkdtemp,
  opendir as nodeFsOpendir,
  readdir as nodeFsReaddir,
  readFile as nodeFsReadFile,
  readlink as nodeFsReadlink,
  realpath as nodeFsRealpath,
  rename as nodeFsRename,
  rm as nodeFsRm,
  stat as nodeFsStat,
  // Waiting for implementation in bun
  // statfs as nodeFsStatfs,

  symlink as nodeFsSymlink,
  truncate as nodeFsTruncate,
  unlink as nodeFsUnlink,
  utimes as nodeFsUtimes,
  writeFile as nodeFsWriteFile,
} from 'node:fs/promises';

import {
  delimiter as nodePathDelimiter,
  format as nodePathFormat,
  isAbsolute as nodePathIsAbsolute,
  join as nodePathJoin,
  normalize as nodePathNormalize,
  parse as nodePathParse,
  type ParsedPath,
  relative as nodePathRelative,
  resolve as nodePathResolve,
  sep as nodePathSep,
} from 'node:path';

import {
  constants as nodeFsC,
  type Dirent,
  type PathLike,
} from 'node:fs';

import {
  mapParallelAsync,
  tryCatchAsync,
} from 'rambdax';

export const pathEncodeImportSafeStr = (pathStr: string): string =>
  pathStr
    .replaceAll('.', 'ReplacedDot')
    .replaceAll('/', 'ReplacedSlash')
    .replaceAll('-', 'ReplacedHyphen');

export const pathDecodeImportSafeStr = (importSafeStr: string): string =>
  importSafeStr
    .replaceAll('ReplacedDot', '.')
    .replaceAll('ReplacedSlash', '/')
    .replaceAll('ReplacedHyphen', '-');

export const pathParseFs = async (
  ...args: Parameters<typeof nodePathParse>
): Promise<
  ParsedPath & Pick<URL, 'search' | 'searchParams' | 'hash'> & {
    path: string;
    absPath: string;
    absDir: string;
    currentDir: string;
    currentAbsDir: string;
  }
> => {
  const pathUrl = new URL(args[0], 'path://');
  const pathSearch = pathUrl.search;
  const pathHash = pathUrl.hash;
  const pathWoTrailingHash = (args[0].endsWith('#'))
    ? args[0].slice(0, -'#'.length)
    : args[0];
  const pathWoHash = pathHash
    ? pathWoTrailingHash.slice(0, -pathHash.length)
    : pathWoTrailingHash;
  const pathWoSearch = pathSearch
    ? pathWoHash.slice(0, -pathSearch.length)
    : pathWoHash;
  try {
    if ((await nodeFsStat(pathWoSearch)).isDirectory()) {
      const eliminatedDots = pathWoSearch.replaceAll('.', 'replacedDot');
      const pathObjOfEliminatedDots = nodePathParse(eliminatedDots);
      const missingAbsDir = {
        ...pathObjOfEliminatedDots,
        dir: pathObjOfEliminatedDots.dir.replaceAll('replacedDot', '.'),
        base: pathObjOfEliminatedDots.base.replaceAll('replacedDot', '.'),
        name: pathObjOfEliminatedDots.name.replaceAll('replacedDot', '.'),
        search: pathSearch,
        searchParams: pathUrl.searchParams,
        hash: pathHash,
        path: pathWoSearch,
        absPath: nodePathResolve(pathWoSearch),
      };
      return {
        ...missingAbsDir,
        absDir: nodePathResolve(missingAbsDir.dir),
        currentDir: pathWoSearch,
        currentAbsDir: missingAbsDir.absPath,
      };
    }
    const missingAbsDir = {
      ...nodePathParse(pathWoSearch),
      search: pathSearch,
      searchParams: pathUrl.searchParams,
      hash: pathHash,
      path: pathWoSearch,
      absPath: nodePathResolve(pathWoSearch),
    };
    return {
      ...missingAbsDir,
      absDir: nodePathResolve(missingAbsDir.dir),
      currentDir: missingAbsDir.dir,
      currentAbsDir: nodePathResolve(missingAbsDir.dir),
    };
  } catch {
    const missingAbsDir = {
      ...nodePathParse(pathWoSearch),
      search: pathSearch,
      searchParams: pathUrl.searchParams,
      hash: pathHash,
      path: pathWoSearch,
      absPath: nodePathResolve(pathWoSearch),
    };
    return {
      ...missingAbsDir,
      absDir: nodePathResolve(missingAbsDir.dir),
      currentDir: missingAbsDir.dir,
      currentAbsDir: nodePathResolve(missingAbsDir.dir),
    };
  }
};

export const pathSplit = (path: string): string[] => path.split(nodePathSep);

export const path: Readonly<{
  isAbsolute: typeof nodePathIsAbsolute;
  resolve: typeof nodePathResolve;
  join: typeof nodePathJoin;
  relative: typeof nodePathRelative;
  sep: typeof nodePathSep;
  format: typeof nodePathFormat;
  delimiter: typeof nodePathDelimiter;
  normalize: typeof nodePathNormalize;
  parseFs: typeof pathParseFs;
  split: typeof pathSplit;
  encodeImportSafeStr: typeof pathEncodeImportSafeStr;
  decodeImportSafeStr: typeof pathDecodeImportSafeStr;
}> = Object.freeze({
  isAbsolute: nodePathIsAbsolute,
  resolve: nodePathResolve,
  join: nodePathJoin,
  relative: nodePathRelative,
  sep: nodePathSep,
  format: nodePathFormat,
  delimiter: nodePathDelimiter,
  normalize: nodePathNormalize,
  parseFs: pathParseFs,
  split: pathSplit,
  encodeImportSafeStr: pathEncodeImportSafeStr,
  decodeImportSafeStr: pathDecodeImportSafeStr,
});

const fsCS_IAA: number = nodeFsC.S_IRUSR
  | nodeFsC.S_IWUSR
  | nodeFsC.S_IXUSR
  | nodeFsC.S_IRGRP
  | nodeFsC.S_IWGRP
  | nodeFsC.S_IXGRP
  | nodeFsC.S_IROTH
  | nodeFsC.S_IWOTH
  | nodeFsC.S_IXOTH;

const fsCS_IAUSR: number = nodeFsC.S_IRUSR
  | nodeFsC.S_IWUSR
  | nodeFsC.S_IXUSR;

const fsCS_IAGRP: number = nodeFsC.S_IRGRP
  | nodeFsC.S_IWGRP
  | nodeFsC.S_IXGRP;

const fsCS_IAOTH: number = nodeFsC.S_IROTH
  | nodeFsC.S_IWOTH
  | nodeFsC.S_IXOTH;

const fsCS_IRA: number = nodeFsC.S_IRUSR | nodeFsC.S_IRGRP | nodeFsC.S_IROTH;
const fsCS_IWA: number = nodeFsC.S_IWUSR | nodeFsC.S_IWGRP | nodeFsC.S_IWOTH;
const fsCS_IXA: number = nodeFsC.S_IXUSR | nodeFsC.S_IXGRP | nodeFsC.S_IXOTH;

const fsC_Part2: {
  S_IAA: number;
  S_IAUSR: number;
  S_IAGRP: number;
  S_IAOTH: number;
  S_IRA: number;
  S_IWA: number;
  S_IXA: number;
} = {
  S_IAA: fsCS_IAA,
  S_IAUSR: fsCS_IAUSR,
  S_IAGRP: fsCS_IAGRP,
  S_IAOTH: fsCS_IAOTH,
  S_IRA: fsCS_IRA,
  S_IWA: fsCS_IWA,
  S_IXA: fsCS_IXA,
};
export const fsC: typeof nodeFsC & typeof fsC_Part2 = {
  ...nodeFsC,
  ...fsC_Part2,
};

export async function fsReadFileU(path: string): Promise<string>;
export async function fsReadFileU(
  ...args: Parameters<typeof nodeFsReadFile>
): ReturnType<typeof nodeFsReadFile> {
  if (args[1]) {
    if (typeof args[1] === 'string' || typeof args[1].encoding === 'string') {
      return await nodeFsReadFile(...args);
    }
    return await nodeFsReadFile(args[0], { ...args[1], encoding: 'utf8' });
  }
  return await nodeFsReadFile(args[0], 'utf8');
}

export async function fsAccessM(
  ...args: Parameters<typeof nodeFsAccess>
): ReturnType<typeof nodeFsAccess> {
  const pathUrl = new URL(args[0], 'path://');
  const pathSearch = pathUrl.search;
  const pathHash = pathUrl.hash;
  const pathWoTrailingHash = (String(args[0]).endsWith('#'))
    ? String(args[0]).slice(0, -'#'.length)
    : args[0];
  const pathWoHash = pathHash
    ? String(pathWoTrailingHash).slice(0, -pathHash.length)
    : pathWoTrailingHash;
  const pathWoSearch = pathSearch
    ? String(pathWoHash).slice(0, -pathSearch.length)
    : pathWoHash;
  try {
    return await nodeFsAccess(pathWoSearch);
  } catch {
    await nodeFsChmod(pathWoSearch, fsC.S_IAA);
  }
  return await nodeFsAccess(pathWoSearch);
}

export const fsExists: (
  ...args: Parameters<typeof nodeFsAccess>
) => Promise<PathLike | false> = tryCatchAsync(
  async function accessTrue(
    ...args: Parameters<typeof fsAccessM>
  ): Promise<PathLike | false> {
    await fsAccessM(...args);
    return args[0];
  },
  false,
);

export const fsExistsDir = async (
  ...args: Parameters<typeof nodeFsAccess>
): Promise<PathLike | false> =>
  await fsExists(...args) && (await nodeFsStat(args[0])).isDirectory() && args[0];
export const fsExistsFile = async (
  ...args: Parameters<typeof nodeFsAccess>
): Promise<PathLike | false> =>
  await fsExists(...args) && (await nodeFsStat(args[0])).isFile() && args[0];

export const fsReadFileMU = async (
  ...args: Parameters<typeof fsReadFileU>
): ReturnType<typeof fsReadFileU> => {
  await fs.accessM(args[0]);
  return await fsReadFileU(...args);
};

export const fsEmpty = async (path: string): Promise<string> => {
  if ((await nodeFsStat(path)).isFile()) {
    await nodeFsWriteFile(path, '');
    return path;
  }

  if ((await nodeFsStat(path)).isDirectory()) {
    /* TODO: Replace this with async iterator helper for true parallel. #priority:low
         See https://github.com/tc39/proposal-async-iterator-helpers#concurrency */
    const subFsPaths = await nodeFsReaddir(path);
    await mapParallelAsync(async function removeSubFsPath(subFsPath) {
      return await nodeFsRm(nodePathJoin(path, subFsPath), { recursive: true });
    }, subFsPaths);
    return path;
  }

  throw new TypeError(`path ${path} points to an unsupported fs type`);
};

export const fsCpFile = async (
  ...args: Parameters<typeof nodeFsCopyFile>
): Promise<PathLike> => {
  if (typeof args[1] === 'string') {
    try {
      await nodeFsAccess((await path.parseFs(args[1])).dir);
    } catch (e) {
      try {
        await nodeFsMkdir((await path.parseFs(args[1])).dir, { recursive: true });
      } catch (e) {
      }
    }
  }
  await nodeFsCopyFile(...args);
  return args[1];
};

export const fsOutputFile = async (
  ...args: Parameters<typeof nodeFsWriteFile>
): Promise<PathLike | FileHandle> => {
  if (typeof args[0] === 'string') {
    try {
      await nodeFsAccess((await path.parseFs(args[0])).dir);
    } catch (e) {
      try {
        await nodeFsMkdir((await path.parseFs(args[0])).dir, { recursive: true });
      } catch (e) {
      }
    }
  }
  await nodeFsWriteFile(...args);
  return args[0];
};

export const fsToPathStr = (dr: Dirent): string => nodePathJoin(dr.parentPath, dr.name);

export const fs: Readonly<{
  chmod: typeof nodeFsChmod;
  chown: typeof nodeFsChown;
  lchown: typeof nodeFsLchown;
  cp: typeof nodeFsCp;
  lutimes: typeof nodeFsLutimes;
  link: typeof nodeFsLink;
  lstat: typeof nodeFsLstat;
  mkdtemp: typeof nodeFsMkdtemp;
  readlink: typeof nodeFsReadlink;
  realpath: typeof nodeFsRealpath;
  rename: typeof nodeFsRename;

  // Waiting for implementation in bun
  // statfs: typeof nodeFsStatfs;

  symlink: typeof nodeFsSymlink;
  truncate: typeof nodeFsTruncate;
  unlink: typeof nodeFsUnlink;
  utimes: typeof nodeFsUtimes;
  constants: typeof nodeFsC;
  appendFile: typeof nodeFsAppendFile;
  writeFile: typeof nodeFsWriteFile;
  copyFile: typeof nodeFsCopyFile;
  mkdir: typeof nodeFsMkdir;
  readdir: typeof nodeFsReaddir;
  access: typeof nodeFsAccess;
  opendir: typeof nodeFsOpendir;
  rm: typeof nodeFsRm;
  C: typeof fsC;
  readFileU: typeof fsReadFileU;
  readFileMU: typeof fsReadFileMU;
  stat: typeof nodeFsStat;
  accessM: typeof fsAccessM;
  exists: typeof fsExists;
  existsDir: typeof fsExistsDir;
  existsFile: typeof fsExistsFile;
  outputFile: typeof fsOutputFile;
  cpFile: typeof fsCpFile;
  empty: typeof fsEmpty;
  toPathStr: typeof fsToPathStr;
}> = Object.freeze({
  chmod: nodeFsChmod,
  chown: nodeFsChown,
  lchown: nodeFsLchown,
  cp: nodeFsCp,
  lutimes: nodeFsLutimes,
  link: nodeFsLink,
  lstat: nodeFsLstat,
  mkdtemp: nodeFsMkdtemp,
  readlink: nodeFsReadlink,
  realpath: nodeFsRealpath,
  rename: nodeFsRename,

  // Waiting for implementation in bun
  // statfs: nodeFsStatfs,

  symlink: nodeFsSymlink,
  truncate: nodeFsTruncate,
  unlink: nodeFsUnlink,
  utimes: nodeFsUtimes,
  constants: nodeFsConstants,
  appendFile: nodeFsAppendFile,
  writeFile: nodeFsWriteFile,
  copyFile: nodeFsCopyFile,
  mkdir: nodeFsMkdir,
  readdir: nodeFsReaddir,
  access: nodeFsAccess,
  opendir: nodeFsOpendir,
  rm: nodeFsRm,
  C: fsC,
  readFileU: fsReadFileU,
  readFileMU: fsReadFileMU,
  stat: nodeFsStat,

  accessM: fsAccessM,

  exists: fsExists,

  existsDir: fsExistsDir,

  existsFile: fsExistsFile,

  outputFile: fsOutputFile,

  cpFile: fsCpFile,

  empty: fsEmpty,

  toPathStr: fsToPathStr,
});
