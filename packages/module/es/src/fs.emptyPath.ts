import {
  access,
  chmod,
  fsConstants as constants,
  type FsStats as Stats,
  mkdir,
  readdir,
  readTextFile,
  rm,
  stat,
  writeFile,
} from '@monochromatic-dev/module-es/fs.fs.ts';
import { pathParse } from '@monochromatic-dev/module-es/fs.pathParse.ts';
import { trimPathLeadingSlash } from './fs.pathJoin.shared.ts';
import { tryCatchAsync } from './function.tryCatch.ts';
import { logtapeGetLogger } from './logtape.shared.ts';

const l = logtapeGetLogger(['m', 'fs', 'ensurePath']);

export async function emptyPath(path: string): Promise<string> {
  const cleanPath: string = trimPathLeadingSlash(new URL(path, 'file:').pathname);
  const parsedPath = pathParse(cleanPath);

  if (parsedPath.ext) {
    l.info`path ${path} is a file.`;
    return await emptyFile(path);
  }

  return await emptyDir(path);
}

export async function emptyDir(path: string): Promise<string> {
  const entriesUnder = await readdir(path, { withFileTypes: false, recursive: false });

  const wDirEntries = entriesUnder.map(function prependDir(entry) {
    return `${path}/${entry}`;
  });

  await Promise.all(wDirEntries.map(function toPromise(entry): Promise<void> {
    return rm(entry, { recursive: true, force: true });
  }));

  return path;
}

export async function emptyFile(path: string): Promise<string> {
  const cleanPath: string = trimPathLeadingSlash(new URL(path, 'file:').pathname);
  await writeFile(cleanPath, '');
  return path;
}

export async function removeEmptyFilesInDir(path: string): Promise<string> {
  const entriesUnder = await readdir(path, { withFileTypes: false, recursive: false });

  const wDirEntries = entriesUnder.map(function prependDir(entry) {
    return `${path}/${entry}`;
  });

  await Promise.all(
    wDirEntries.map(async function checkAndRemoveIfEmpty(entry): Promise<void> {
      const stats = await stat(entry);

      if (stats.isFile() && (await readTextFile(entry)).trim() === '') {
        l.debug`Removing empty file ${entry}`;
        await rm(entry, { force: true, recursive: true });
      }
    }),
  );

  return path;
}
