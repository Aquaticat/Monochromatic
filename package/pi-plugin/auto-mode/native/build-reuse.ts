/** Reuse identical immutable release files while keeping independent module paths. @module */
import { createHash, randomUUID } from 'node:crypto';
import type { Stats } from 'node:fs';
import { link, lstat, readFile, readdir, realpath, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { caughtValueText } from '@monochromatic-dev/module-caught-value/ts';
import { nativeBuildLog } from './build-contract.ts';

/** A missing old entry is normal for a first build or a newly added file. */
const NO_PREVIOUS_BUILD_ENTRY: unique symbol = Symbol('new build entry has no previous counterpart');

/**
 Pin the previous release before another build can change its public link.
 @param active - original stable command location
 @returns previous immutable directory or first-build sentinel
 @throws original filesystem error for failures other than an absent old installation
 */
async function previousRelease(active: string): Promise<string | typeof NO_PREVIOUS_BUILD_ENTRY> {
  /** Release lookup diagnostics retain the build operation. */
  const l = tagged({ tag: previousRelease.name, l: nativeBuildLog });
  l.debug('resolving previous immutable release');
  try {
    return await realpath(active);
  }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    l.debug(caughtValueText(error));
    return NO_PREVIOUS_BUILD_ENTRY;
  }
}

/**
 Missing previous files remain valid new files in the unpublished release.
 @param original - corresponding file in the pinned previous release
 @returns original file metadata or new-file sentinel
 @throws original filesystem error when metadata cannot be read for another reason
 */
async function previousMetadata(original: string): Promise<Stats | typeof NO_PREVIOUS_BUILD_ENTRY> {
  /** Existing-file comparison retains its own diagnostic tag. */
  const l = tagged({ tag: previousMetadata.name, l: nativeBuildLog });
  l.debug('reading previous build-entry metadata');
  try {
    return await lstat(original);
  }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    l.debug(caughtValueText(error));
    return NO_PREVIOUS_BUILD_ENTRY;
  }
}

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
  /** Build comparison records counts without logging file contents. */
  const l = tagged({ tag: reuseNativeBuildFiles.name, l: nativeBuildLog });
  l.debug('comparing verified release with the previous immutable graph');
  /** A pinned directory keeps concurrent publication from changing comparison inputs. */
  const previous = await previousRelease(active);
  if (previous === NO_PREVIOUS_BUILD_ENTRY) return { files: 0, bytes: 0 };
  /** Symbol narrowing is retained explicitly inside the asynchronous mapper. */
  const previousDirectory: string = previous;
  /** Enumeration stays inside the unpublished release and does not follow dependency links. */
  const paths = await readdir(output, { recursive: true });
  /** Sequential mapping bounds open files and comparison memory independently of graph size. */
  const contributions = await Array.fromAsync(paths, async function reuseFile(path) {
    /** Only this unpublished path may be replaced. */
    const target = join(output, path);
    /** Existing release paths remain comparison inputs. */
    const original = join(previousDirectory, path);
    /** Entry metadata excludes directories and dependency symlinks. */
    const metadata = await lstat(target);
    if (!metadata.isFile()) return { files: 0, bytes: 0 };
    /** Added files retain independent contents without inventing an old counterpart. */
    const prior = await previousMetadata(original);
    if (prior === NO_PREVIOUS_BUILD_ENTRY) return { files: 0, bytes: 0 };
    if (!prior.isFile() || prior.dev !== metadata.dev || prior.mode !== metadata.mode
      || prior.size !== metadata.size || prior.ino === metadata.ino) return { files: 0, bytes: 0 };
    /** Complete bytes must agree before storage is shared. */
    const currentHash = createHash('sha256').update(await readFile(target)).digest('hex');
    /** Matching metadata alone does not establish equal source content. */
    const previousHash = createHash('sha256').update(await readFile(original)).digest('hex');
    if (currentHash !== previousHash) return { files: 0, bytes: 0 };
    /** The temporary link belongs exclusively to this fresh build occurrence. */
    const staged = `${target}.${randomUUID()}.shared`;
    await link(original, staged);
    await rename(staged, target);
    return { files: 1, bytes: metadata.size };
  });
  /** Accumulation retains exact successful reuse counts, including empty files. */
  const reused = { files: 0, bytes: 0 };
  for (const contribution of contributions) {
    reused.files += contribution.files;
    reused.bytes += contribution.bytes;
  }
  l.debug(`reused immutable release files: ${JSON.stringify(reused)}`);
  return reused;
}
//endregion
