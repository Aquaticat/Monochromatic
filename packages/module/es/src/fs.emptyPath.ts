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
  // Check if path has query parameters (e.g., ?raw or ?vue=css)
  const queryIndex = path.indexOf('?');
  const cleanPath = queryIndex > -1 ? path.substring(0, queryIndex) : path;

  const parsedPath = pathParse(cleanPath);

  if (parsedPath.ext) {
    l.info`path ${path} is a file.`;
    return await emptyFile(path);
  }

  return await emptyDir(cleanPath);
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
  // Check if path has query parameters (e.g., ?raw or ?vue=css)
  const queryIndex = path.indexOf('?');
  const cleanPath = queryIndex > -1 ? path.substring(0, queryIndex) : path;

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
