/** Reuse identical immutable release files while keeping independent module paths. @module */
import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, readFile, readdir, realpath, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { caughtValueText } from '@monochromatic-dev/module-caught-value/ts';
import { nativeBuildLog } from './build-contract.ts';

//region Only the new verified release is changed before publication.
/**
 Share unchanged file content without rewriting paths owned by running sessions.
 The build performs no writes to release contents after this step.
 @param output - new verified release not yet published
 @param active - previous stable release link or directory
 @returns complete reused-file and byte counts
 @throws original filesystem error when comparison or linking fails
 */
export async function reuseNativeBuildFiles({ output, active }: {
  readonly output: string;
  readonly active: string;
}): Promise<{ readonly files: number; readonly bytes: number }> {
  const l = tagged({ tag: reuseNativeBuildFiles.name, l: nativeBuildLog });
  l.debug('comparing verified release with the previous immutable graph');
  let previous: string;
  try {
    previous = await realpath(active);
  }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    l.debug(caughtValueText(error));
    return { files: 0, bytes: 0 };
  }
  const paths = await readdir(output, { recursive: true });
  /** Sequential mapping bounds open files and comparison memory independently of graph size. */
  const contributions = await Array.fromAsync(paths, async function reuseFile(path) {
    const target = join(output, path);
    const original = join(previous, path);
    const metadata = await lstat(target);
    if (!metadata.isFile()) return { files: 0, bytes: 0 };
    let prior;
    try {
      prior = await lstat(original);
    }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      tagged({ tag: reuseFile.name, l }).debug(caughtValueText(error));
      return { files: 0, bytes: 0 };
    }
    if (!prior.isFile() || prior.dev !== metadata.dev || prior.mode !== metadata.mode
      || prior.size !== metadata.size || prior.ino === metadata.ino) return { files: 0, bytes: 0 };
    const currentHash = createHash('sha256').update(await readFile(target)).digest('hex');
    const previousHash = createHash('sha256').update(await readFile(original)).digest('hex');
    if (currentHash !== previousHash) return { files: 0, bytes: 0 };
    const staged = `${target}.${randomUUID()}.shared`;
    await link(original, staged);
    await rename(staged, target);
    return { files: 1, bytes: metadata.size };
  });
  const reused = { files: 0, bytes: 0 };
  for (const contribution of contributions) {
    reused.files += contribution.files;
    reused.bytes += contribution.bytes;
  }
  l.debug(`reused immutable release files: ${JSON.stringify(reused)}`);
  return reused;
}
//endregion
