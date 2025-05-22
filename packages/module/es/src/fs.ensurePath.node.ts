import {
  constants,
  type Stats,
} from 'node:fs';
import {
  access,
  chmod,
  mkdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { parse } from 'node:path';
import {
  fileURLToPath,
  pathToFileURL,
} from 'node:url';
import { tryCatchAsync } from './function.tryCatch.ts';
import { logtapeGetLogger } from './logtape.shared.ts';

const l = logtapeGetLogger(['m', 'fs', 'ensurePath.node']);

export async function ensurePath(path: string): Promise<string> {
  const cleanPath = fileURLToPath(new URL(path, pathToFileURL(process.cwd())));
  const parsedPath = parse(cleanPath);

  if (parsedPath.ext) {
    l.info`path ${path} is a file.`;
    return await ensureFile(path);
  }

  return await ensureDir(path);
}

export async function ensureDir(path: string): Promise<string> {
  const pathStat = await tryCatchAsync(async function tryer(): Promise<Stats> {
    return await stat(path);
  }, async function catcher(error): Promise<boolean> {
    if (error.code === 'ENOENT') {
      l.info`stat error ${error}, path ${path} does not exist. Need to create it.`;
      await mkdir(path, { recursive: true });
      return true; // Signal that retry is possible
    }
    // For other errors, don't retry
    l.error`Cannot recover from error: ${error}`;
    return false;
  });

  if (pathStat.isDirectory()) {
    l.info`path ${path} already exists and is a directory, checking for accessibility.`;

    try {
      await access(path, constants.R_OK | constants.W_OK);
      l.info`path ${path} is accessible. No further actions needed.`;
      return path;
    } catch {
      l.info`path ${path} cannot be accessed. Trying to change permissions.`;
      await chmod(path, constants.R_OK | constants.W_OK);
      return path;
    }
  }

  throw new Error(`Path ${path} exists but is not a directory.`);
}

export async function ensureFile(path: string): Promise<string> {
  const cleanPath = fileURLToPath(new URL(path, pathToFileURL(process.cwd())));
  const parsedPath = parse(cleanPath);
  const pathStat = await tryCatchAsync(async function tryer(): Promise<Stats> {
    return await stat(path);
  }, async function catcher(error): Promise<boolean> {
    if (error.code === 'ENOENT') {
      l.info`stat error ${error}, path ${path} does not exist. Need to create it.`;
      await ensureDir(parsedPath.dir);
      await writeFile(cleanPath, '', { flag: 'wx' });

      // Signal that retry is possible
      return true;
    }
    // For other errors, don't retry
    l.error`Cannot recover from error: ${error}`;
    return false;
  });

  if (pathStat.isFile()) {
    l.info`path ${path} already exists and is a file, checking for accessibility.`;

    try {
      await access(path, constants.R_OK | constants.W_OK);
      l.info`path ${path} is accessible. No further actions needed.`;
      return path;
    } catch {
      l.info`path ${path} cannot be accessed. Trying to change permissions.`;
      await chmod(path, constants.R_OK | constants.W_OK);
      return path;
    }
  }

  throw new Error(`Path ${path} exists but is not a file.`);
}
