/**
 * Exact streamed candidate-state snapshots for transaction convergence.
 *
 * @module
 */
import { Buffer, } from 'node:buffer';
import { constants, } from 'node:fs';
import { open, } from 'node:fs/promises';
import type { LazyPolicyGitFacts, } from '../api/context-types.ts';

/**
 * Snapshot files remain private to current account.
 */
const PRIVATE_FILE_MODE = 0o600;
/**
 * Fixed streaming comparison buffer size.
 */
const COMPARISON_BUFFER_SIZE = 2 ** (2 ** (2 + 2));
/**
 * Four-byte unsigned field width.
 */
const UINT32_WIDTH = 4;
/**
 * Eight-byte unsigned field width.
 */
const UINT64_WIDTH = 8;
/**
 * Candidate metadata text encoder.
 */
const ENCODER = new TextEncoder();

/**
 * Encodes unsigned metadata length.
 *
 * @param value - bounded byte length
 *
 * @returns four-byte big-endian field
 */
function encodeUint32(value: number,): Uint8Array {
  /**
   * Fixed-width encoded field.
   */
  const bytes = new Uint8Array(UINT32_WIDTH,);
  new DataView(bytes.buffer,).setUint32(
    0,
    value,
  );
  return bytes;
}

/**
 * Encodes candidate content length.
 *
 * @param value - exact byte length
 *
 * @returns eight-byte big-endian field
 */
function encodeUint64(value: number,): Uint8Array {
  /**
   * Fixed-width encoded field.
   */
  const bytes = new Uint8Array(UINT64_WIDTH,);
  new DataView(bytes.buffer,).setBigUint64(
    0,
    BigInt(value,),
  );
  return bytes;
}

/**
 * Writes exact ordered path, mode, and content bytes to private snapshot.
 *
 * @param gitFacts - private-index lazy candidate facts
 *
 * @param snapshotPath - destination outside worktree
 *
 * @example
 * ```ts
 * await writeCandidateSnapshot({ gitFacts, snapshotPath: '/tmp/state' });
 * ```
 */
export async function writeCandidateSnapshot({
  gitFacts,
  snapshotPath,
}: Readonly<{
  gitFacts: LazyPolicyGitFacts;
  snapshotPath: string;
}>,): Promise<void> {
  /**
   * Candidates sorted by exact repository path for stable comparison.
   */
  const candidates = (await gitFacts.candidates()).toSorted(function comparePathBytes(
    left,
    right,
  ) {
    return Buffer.compare(
      Buffer.from(left.path,),
      Buffer.from(right.path,),
    );
  },);
  /**
   * Private exact snapshot output.
   */
  await using output = await open(
    snapshotPath,
    'w',
    PRIVATE_FILE_MODE,
  );
  for (const candidate of candidates) {
    /**
     * Exact repository path bytes.
     */
    const pathBytes = ENCODER.encode(candidate.path,);
    /**
     * Exact policy mode bytes.
     */
    const modeBytes = ENCODER.encode(candidate.mode,);
    /**
     * Exact current candidate content held one file at a time.
     */
    // oxlint-disable-next-line no-await-in-loop -- Candidate API supplies one file at a time so complete trees never duplicate in memory.
    const contentBytes = await candidate.bytes();
    // oxlint-disable-next-line no-await-in-loop -- Snapshot fields intentionally stream in exact candidate order.
    await output.writeFile(encodeUint32(pathBytes.byteLength,),);
    // oxlint-disable-next-line no-await-in-loop -- Snapshot fields intentionally stream in exact candidate order.
    await output.writeFile(pathBytes,);
    // oxlint-disable-next-line no-await-in-loop -- Snapshot fields intentionally stream in exact candidate order.
    await output.writeFile(encodeUint32(modeBytes.byteLength,),);
    // oxlint-disable-next-line no-await-in-loop -- Snapshot fields intentionally stream in exact candidate order.
    await output.writeFile(modeBytes,);
    // oxlint-disable-next-line no-await-in-loop -- Snapshot fields intentionally stream in exact candidate order.
    await output.writeFile(encodeUint64(contentBytes.byteLength,),);
    // oxlint-disable-next-line no-await-in-loop -- Snapshot fields intentionally stream in exact candidate order.
    await output.writeFile(contentBytes,);
  }
  await output.sync();
}

/**
 * Compares exact files through bounded fixed-size buffers.
 *
 * @param leftPath - prior snapshot
 *
 * @param rightPath - current snapshot
 *
 * @returns whether every byte and total length match
 *
 * @example
 * ```ts
 * await snapshotFilesEqual({ leftPath: '/tmp/one', rightPath: '/tmp/two' });
 * ```
 */
export async function snapshotFilesEqual({
  leftPath,
  rightPath,
}: Readonly<{
  leftPath: string;
  rightPath: string;
}>,): Promise<boolean> {
  /**
   * Prior snapshot input.
   */
  await using left = await open(
    leftPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  /**
   * Current snapshot input.
   */
  await using right = await open(
    rightPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  /**
   * Reusable prior-state buffer.
   */
  const leftBuffer = new Uint8Array(COMPARISON_BUFFER_SIZE,);
  /**
   * Reusable current-state buffer.
   */
  const rightBuffer = new Uint8Array(COMPARISON_BUFFER_SIZE,);
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- Side-effecting file cursor requires bounded iterative reads. */
  /**
   * Prior snapshot initial read state.
   */
  let leftRead = await left.read(leftBuffer,);
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- Side-effecting file cursor requires bounded iterative reads. */
  /**
   * Current snapshot initial read state.
   */
  let rightRead = await right.read(rightBuffer,);
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  while ((leftRead.bytesRead > 0) || (rightRead.bytesRead > 0)) {
    if (leftRead.bytesRead !== rightRead.bytesRead)
      return false;
    if (!leftBuffer.subarray(
      0,
      leftRead.bytesRead,
    )
      .every(function sameByte(
        value,
        index,
      ) {
      return value === rightBuffer[index];
    },))
      return false;
    // oxlint-disable-next-line no-await-in-loop -- Fixed buffers advance both bounded file cursors once per comparison chunk.
    [leftRead, rightRead,] = await Promise.all([
      left.read(leftBuffer,),
      right.read(rightBuffer,),
    ],);
  }
  return true;
}

/**
 * Streams prior private snapshots until exact candidate state repeats.
 *
 * @param snapshotPaths - ordered prior snapshot paths
 *
 * @param currentPath - current exact snapshot path
 *
 * @returns whether any prior state matches
 *
 * @example
 * ```ts
 * await containsExactCandidateSnapshot({ snapshotPaths: ['/tmp/one'], currentPath: '/tmp/current' });
 * ```
 */
export async function containsExactCandidateSnapshot({
  snapshotPaths,
  currentPath,
}: Readonly<{
  snapshotPaths: readonly string[];
  currentPath: string;
}>,): Promise<boolean> {
  for (const snapshotPath of snapshotPaths) {
    // oxlint-disable-next-line no-await-in-loop -- Prior snapshots intentionally stream one at a time to bound memory.
    if (await snapshotFilesEqual({
      leftPath: snapshotPath,
      rightPath: currentPath,
    },))
      return true;
  }
  return false;
}
