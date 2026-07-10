/**
 * Exact private-index snapshot comparison.
 *
 * @module
 */
import { readFile, } from 'node:fs/promises';

/**
 * Compares exact candidate-state bytes.
 *
 * @param left - prior bytes
 *
 * @param right - current bytes
 *
 * @returns whether lengths and every byte match
 */
function bytesEqual({
  left,
  right,
}: Readonly<{
  left: Uint8Array;
  right: Uint8Array;
}>,): boolean {
  if (left.byteLength !== right.byteLength)
    return false;
  return left.every(function sameByte(
    value,
    index,
  ) {
    return value === right[index];
  },);
}

/**
 * Streams prior private snapshots until exact candidate bytes repeat.
 *
 * @param snapshotPaths - ordered private snapshot paths
 *
 * @param current - exact current index bytes
 *
 * @returns whether any prior snapshot matches exactly
 *
 * @example
 * ```ts
 * await containsExactSnapshot({ snapshotPaths: ['/tmp/one'], current: bytes });
 * ```
 */
export async function containsExactSnapshot({
  snapshotPaths,
  current,
}: Readonly<{
  snapshotPaths: readonly string[];
  current: Uint8Array;
}>,): Promise<boolean> {
  for (const snapshotPath of snapshotPaths) {
    /**
     * One exact prior state held in memory during streaming comparison.
     */
    // oxlint-disable-next-line no-await-in-loop -- Exact snapshots intentionally stream one at a time to bound memory.
    const prior = new Uint8Array(await readFile(snapshotPath,),);
    if (bytesEqual({
      left: prior,
      right: current,
    },))
      return true;
  }
  return false;
}
