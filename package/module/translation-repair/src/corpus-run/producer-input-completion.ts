import { join, } from 'node:path';
import {
  lstat,
  readdir,
} from 'node:fs/promises';
import { isDeepStrictEqual, } from 'node:util';
import { parseProducerInputCompletion, } from './producer-input-completion-record.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import {
  readProducerInputMetadata,
  verifyProducerInputOutputFile,
} from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';

/**
 * Completion metadata is bounded separately from the corpus-derived artifact it describes.
 */
const MAX_COMPLETION_BYTES = 1_048_576;
/**
 * Completed output retains the exact private directory mode, without special permission bits.
 */
const OUTPUT_DIRECTORY_MODE = 0o700;
/**
 * Permission comparison includes special bits rather than only group/other access.
 */
const PERMISSION_MASK = 0o7777;

/**
 * Checks only the exact allowed output inventory and caller-owned private directories.
 *
 * @param host - owning run identity
 *
 * @throws ProducerInputRunError when extra files, home contents, ownership or modes differ
 *
 * @example
 * ```ts
 * await completionDirectories(host);
 * ```
 */
async function completionDirectories(host: ProducerInputHost): Promise<void> {
  try {
    await Promise.all([
      host.run
        .outputDir,
      join(
        host.run
          .outputDir,
        'home'
      )
    ].map(async function verifyDirectory(path): Promise<void> {
      /**
       * Directory checks do not follow a symlink leaf or accept a different group.
       */
      const state = await lstat(path);
      if ((!state.isDirectory()) || (state.uid
        !== host.run
        .uid)
        || (state.gid
          !== host.run
          .gid)
        || ((state.mode & PERMISSION_MASK) !== OUTPUT_DIRECTORY_MODE))
        throw new ProducerInputRunError({
          operation: 'read-output',
          locator: path,
        });
    }));
    if ((!isDeepStrictEqual(
      (await readdir(host.run
        .outputDir)).toSorted(),
      [
        'complete.json',
        'home',
        'unqualified-inputs.json'
      ]
    )) || ((await readdir(join(
      host.run
        .outputDir,
      'home'
    ))).length > 0))
      throw new ProducerInputRunError({
        operation: 'read-output',
        locator: 'output inventory',
      });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({
      operation: 'read-output',
      locator: 'output directories',
    });
  }
}

/**
 * Checks the private output and its internal completion identity without loading corpus-derived bodies.
 * Complete producer output is retained even when this consistency check fails.
 *
 * @param host - owning launch and exclusive output
 *
 * @returns Internally consistent unqualified metadata, never review or execution authority
 *
 * @throws ProducerInputRunError when inventory, identity, ownership or modes differ
 *
 * @example
 * ```ts
 * const completion = await verifyProducerInputCompletion(host);
 * ```
 */
export async function verifyProducerInputCompletion(host: ProducerInputHost): Promise<ProducerInputCompletion> {
  await completionDirectories(host);
  /**
   * Completion has its own metadata ceiling; artifact hashing remains streamed.
   */
  const text = await readProducerInputMetadata({
    path: join(
      host.run
        .outputDir,
      'complete.json'
    ),
    maximumBytes: MAX_COMPLETION_BYTES,
    ownerUid: host.run
      .uid,
    ownerGid: host.run
      .gid,
    operation: 'read-output'
  });
  /**
   * Run identity is reconstructed from host-owned state rather than accepted from a completion certificate.
   */
  const completion = parseProducerInputCompletion({
    text,
    runId: host.run
      .runId,
    launchSha256: host.launchIdentity
      .sha256,
  });
  await verifyProducerInputOutputFile({
    path: join(
      host.run
        .outputDir,
      completion.artifact
        .file
    ),
    expected: completion.artifact,
    ownerUid: host.run
      .uid,
    ownerGid: host.run
      .gid
  });
  await completionDirectories(host);
  return completion;
}
