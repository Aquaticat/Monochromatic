/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { access as fsAccess, appendFile as fsAppendFile, chmod as fsChmod, chown as fsChown, copyFile as fsCopyFile, cp as fsCp, lchown as fsLchown, link as fsLink, lstat as fsLstat, lutimes as fsLutimes, mkdir as fsMkdir, mkdtemp as fsMkdtemp, opendir as fsOpendir, readdir as fsReaddir, readlink as fsReadlink, realpath as fsRealpath, rename as fsRename, rm as fsRm, stat as fsStat, statfs as fsStatfs, symlink as fsSymlink, truncate as fsTruncate, unlink as fsUnlink, utimes as fsUtimes, writeFile as fsWriteFile } from 'node:fs/promises';
import { type ParsedPath } from 'node:path';
import { constants as fsC, type PathLike } from 'node:fs';
export declare const path: Readonly<{
    isAbsolute: (path: string) => boolean;
    resolve: (...paths: string[]) => string;
    join: (...paths: string[]) => string;
    relative: (from: string, to: string) => string;
    sep: "\\" | "/";
    format: (pathObject: import("path").FormatInputPathObject) => string;
    delimiter: ";" | ":";
    normalize: (path: string) => string;
    parseFs: (path: string) => Promise<ParsedPath & Pick<URL, 'search' | 'searchParams' | 'hash'> & {
        path: string;
        absPath: string;
        absDir: string;
        currentDir: string;
        currentAbsDir: string;
    }>;
    split: (path: string) => string[];
}>;
declare function fsReadFileU(path: string): Promise<string>;
declare function fsAccessM(...args: Parameters<typeof fsAccess>): ReturnType<typeof fsAccess>;
export declare const fs: Readonly<{
    chmod: typeof fsChmod;
    chown: typeof fsChown;
    lchown: typeof fsLchown;
    cp: typeof fsCp;
    lutimes: typeof fsLutimes;
    link: typeof fsLink;
    lstat: typeof fsLstat;
    mkdtemp: typeof fsMkdtemp;
    readlink: typeof fsReadlink;
    realpath: typeof fsRealpath;
    rename: typeof fsRename;
    statfs: typeof fsStatfs;
    symlink: typeof fsSymlink;
    truncate: typeof fsTruncate;
    unlink: typeof fsUnlink;
    utimes: typeof fsUtimes;
    constants: typeof fsC;
    appendFile: typeof fsAppendFile;
    writeFile: typeof fsWriteFile;
    copyFile: typeof fsCopyFile;
    mkdir: typeof fsMkdir;
    readdir: typeof fsReaddir;
    access: typeof fsAccess;
    opendir: typeof fsOpendir;
    rm: typeof fsRm;
    C: {
        S_IAA: number;
        S_IAUSR: number;
        S_IAGRP: number;
        S_IAOTH: number;
        S_IRA: number;
        S_IWA: number;
        S_IXA: number;
        F_OK: number;
        R_OK: number;
        W_OK: number;
        X_OK: number;
        COPYFILE_EXCL: number;
        COPYFILE_FICLONE: number;
        COPYFILE_FICLONE_FORCE: number;
        O_RDONLY: number;
        O_WRONLY: number;
        O_RDWR: number;
        O_CREAT: number;
        O_EXCL: number;
        O_NOCTTY: number;
        O_TRUNC: number;
        O_APPEND: number;
        O_DIRECTORY: number;
        O_NOATIME: number;
        O_NOFOLLOW: number;
        O_SYNC: number;
        O_DSYNC: number;
        O_SYMLINK: number;
        O_DIRECT: number;
        O_NONBLOCK: number;
        S_IFMT: number;
        S_IFREG: number;
        S_IFDIR: number;
        S_IFCHR: number;
        S_IFBLK: number;
        S_IFIFO: number;
        S_IFLNK: number;
        S_IFSOCK: number;
        S_IRWXU: number;
        S_IRUSR: number;
        S_IWUSR: number;
        S_IXUSR: number;
        S_IRWXG: number;
        S_IRGRP: number;
        S_IWGRP: number;
        S_IXGRP: number;
        S_IRWXO: number;
        S_IROTH: number;
        S_IWOTH: number;
        S_IXOTH: number;
        UV_FS_O_FILEMAP: number;
    };
    readFileU: typeof fsReadFileU;
    readFileMU: (path: string) => ReturnType<typeof fsReadFileU>;
    stat: typeof fsStat;
    accessM: typeof fsAccessM;
    exists: (path: PathLike, mode?: number | undefined) => Promise<PathLike | false>;
    existsDir: (path: PathLike, mode?: number | undefined) => Promise<PathLike | false>;
    existsFile: (path: PathLike, mode?: number | undefined) => Promise<PathLike | false>;
    outputFile: (file: PathLike | import("fs/promises").FileHandle, data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | import("stream").Stream, options?: BufferEncoding | (import("fs").ObjectEncodingOptions & {
        mode?: import("fs").Mode | undefined;
        flag?: import("fs").OpenMode | undefined;
        flush?: boolean | undefined;
    } & import("events").Abortable) | null | undefined) => Promise<PathLike | import("fs/promises").FileHandle>;
    cpFile: (src: PathLike, dest: PathLike, mode?: number | undefined) => Promise<PathLike>;
    empty: (path: string) => Promise<void>;
}>;
export {};
//# sourceMappingURL=index.d.ts.map