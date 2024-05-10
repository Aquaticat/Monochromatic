## API Report File for "@monochromatic.dev/module-fs-path"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

/// <reference types="node" />

import { Abortable } from 'events';
import { access } from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import { chmod } from 'node:fs/promises';
import { chown } from 'node:fs/promises';
import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { cp } from 'node:fs/promises';
import { FileHandle } from 'fs/promises';
import { FormatInputPathObject } from 'path';
import { lchown } from 'node:fs/promises';
import { link } from 'node:fs/promises';
import { lstat } from 'node:fs/promises';
import { lutimes } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { Mode } from 'fs';
import { ObjectEncodingOptions } from 'fs';
import { opendir } from 'node:fs/promises';
import { OpenMode } from 'fs';
import { ParsedPath } from 'node:path';
import { PathLike } from 'fs';
import { readdir } from 'node:fs/promises';
import { readlink } from 'node:fs/promises';
import { realpath } from 'node:fs/promises';
import { rename } from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { statfs } from 'node:fs/promises';
import { Stream } from 'stream';
import { symlink } from 'node:fs/promises';
import { truncate } from 'node:fs/promises';
import { unlink } from 'node:fs/promises';
import { utimes } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

// @public (undocumented)
export const fs: Readonly<{
    chmod: typeof chmod;
    chown: typeof chown;
    lchown: typeof lchown;
    cp: typeof cp;
    lutimes: typeof lutimes;
    link: typeof link;
    lstat: typeof lstat;
    mkdtemp: typeof mkdtemp;
    readlink: typeof readlink;
    realpath: typeof realpath;
    rename: typeof rename;
    statfs: typeof statfs;
    symlink: typeof symlink;
    truncate: typeof truncate;
    unlink: typeof unlink;
    utimes: typeof utimes;
    constants: typeof constants;
    appendFile: typeof appendFile;
    writeFile: typeof writeFile;
    copyFile: typeof copyFile;
    mkdir: typeof mkdir;
    readdir: typeof readdir;
    access: typeof access;
    opendir: typeof opendir;
    rm: typeof rm;
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
    stat: typeof stat;
    accessM: typeof fsAccessM;
    exists: (path: PathLike, mode?: number | undefined) => Promise<boolean>;
    outputFile: (file: PathLike | FileHandle, data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | Stream, options?: BufferEncoding | (ObjectEncodingOptions & {
        mode?: Mode | undefined;
        flag?: OpenMode | undefined;
        flush?: boolean | undefined;
    } & Abortable) | null | undefined) => ReturnType<typeof writeFile>;
    cpFile: (src: PathLike, dest: PathLike, mode?: number | undefined) => ReturnType<typeof copyFile>;
    empty: (path: string) => Promise<void>;
}>;

// @public (undocumented)
export const path: Readonly<{
    isAbsolute: (path: string) => boolean;
    resolve: (...paths: string[]) => string;
    join: (...paths: string[]) => string;
    relative: (from: string, to: string) => string;
    sep: "\\" | "/";
    format: (pathObject: FormatInputPathObject) => string;
    delimiter: ";" | ":";
    normalize: (path: string) => string;
    parseFs: (path: string) => Promise<ParsedPath & Pick<URL, 'search' | 'searchParams' | 'hash'> & {
        path: string;
        absPath: string;
        absDir: string;
    }>;
    split: (path: string) => string[];
}>;

// Warnings were encountered during analysis:
//
// src/index.ts:173:16 - (ae-forgotten-export) The symbol "fsReadFileU" needs to be exported by the entry point index.d.ts
// src/index.ts:201:115 - (ae-forgotten-export) The symbol "fsAccessM" needs to be exported by the entry point index.d.ts

// (No @packageDocumentation comment for this package)

```