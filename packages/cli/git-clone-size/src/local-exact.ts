import { BYTES_PER_KIB, } from '@monochromatic-dev/module-const/ts';

import { DEFAULT_MAX_PACK_BYTES, } from './constants.ts';
import {
  l,
  tagged,
} from './log.ts';
import { objectsDirSize, } from './objects-size.ts';
import { measurePackBytes, } from './pack-bytes.ts';
import { spawnResult, } from './spawn.ts';
import type { Confidence, } from './types.ts';

/**
 * Exact (or size-pack proxy) measurement of a complete local repository.
 */
export type LocalExactResult = {
  readonly fullBytes: number;
  readonly shallowBytes: number;
  readonly confidence: Confidence;
  readonly basis: string;
  readonly footprintBytes: number;
};

/**
 * Argument vector that lists every object a full clone receives: everything
 * reachable from local heads and tags, the ref classes a clone fetches. NOT
 * `--all`, which would pull local-only remote-tracking refs a clone never sends.
 */
const FULL_REV_LIST: readonly string[] = [
  'rev-list',
  '--objects',
  '--branches',
  '--tags',
];

/**
 * Argument vector listing only the tip snapshot, for the depth-1 shallow side.
 */
const TIP_REV_LIST: readonly string[] = [
  'rev-list',
  '--objects',
  '--max-count=1',
  'HEAD',
];

/**
 * Packer argument vector shared by both sides, so the ratio is apples-to-apples
 * on one well-packed pack.
 */
const PACK_ARGS: readonly string[] = [
  'pack-objects',
  '--stdout',
  '--delta-base-offset',
];

/**
 * Reads the already-packed size from `git count-objects -v` (`size-pack`,
 * reported in KiB) as a cheap high-confidence proxy for huge repos.
 *
 * @param path - repository directory
 *
 * @returns packed object-store bytes, or 0 when unavailable
 *
 * @example
 * ```ts
 * const bytes = await countObjectsSizePack({ path: '/repo' });
 * ```
 */
export async function countObjectsSizePack({ path, }: { readonly path: string; },): Promise<number> {
  /**
   * Captured `count-objects -v` report and exit code.
   */
  const {
    stdout,
    exitCode,
  } = await spawnResult({
    command: 'git',
    args: [
      '-C',
      path,
      'count-objects',
      '-v',
    ],
  },);
  if (exitCode !== 0)
    return 0;
  /**
   * `size-pack: <KiB>` line value, parsed by splitting on the colon.
   */
  const line = stdout
    .split('\n',)
    .find(function isSizePack(text,) {
      return text.startsWith('size-pack:',);
    },);
  if (line === undefined)
    return 0;
  /**
   * KiB figure after the colon.
   */
  const kib = Number.parseInt(
    (line.split(':',)
      .at(1,)
      ?? '').trim(),
    10,
  );
  return Number.isFinite(kib,) ? kib * BYTES_PER_KIB : 0;
}

/**
 * Measures the exact shallow tip pack for a local repo. Cheap even on huge
 * repos, so it runs on both the exact and size-pack-fallback paths.
 *
 * @param path - repository directory
 *
 * @returns tip pack bytes
 */
async function measureTip({ path, }: { readonly path: string; },): Promise<number> {
  return await measurePackBytes({
    cwd: path,
    revListArgs: TIP_REV_LIST,
    packArgs: PACK_ARGS,
  },);
}

/**
 * Exactly measures a complete local repository's full and shallow object-store
 * sizes by packing the clone-reachable object set with `pack-objects`, the same
 * packing a fresh `git clone` produces. Correct by reachability, so alternates,
 * `--shared` clones, and linked worktrees are handled without summing the
 * alternate store. Above `maxPackBytes`, falls back to the `count-objects`
 * size-pack proxy (still high confidence, wider band) to avoid repack-level cost.
 * Never runs `git gc`/`git repack`, so the user's repo is never mutated.
 *
 * @param path - complete local repository directory
 *
 * @param maxPackBytes - size above which the size-pack proxy is used
 *
 * @returns full/shallow bytes, confidence, basis label, and storage footprint
 *
 * @example
 * ```ts
 * const result = await localExact({ path: '/repo', maxPackBytes: DEFAULT_MAX_PACK_BYTES });
 * ```
 */
export async function localExact(
  {
    path,
    maxPackBytes = DEFAULT_MAX_PACK_BYTES,
  }: {
    readonly path: string;
    readonly maxPackBytes?: number
  },
): Promise<LocalExactResult> {
  /**
   * Tagged logger naming the local-exact measurement.
   */
  const rl = tagged({
    tag: localExact.name,
    l,
  },);

  /**
   * Raw on-disk store footprint, a separate explicitly-labeled secondary metric
   * (NOT the full-clone size: it can include unreachable or alternate objects).
   */
  const footprintBytes = await objectsDirSize({ repoPath: path, },);

  /**
   * Packed size proxy, used to gate the heavy exact pack.
   */
  const sizePackBytes = await countObjectsSizePack({ path, },);

  if (sizePackBytes > maxPackBytes) {
    rl.debug(`repo size-pack ${String(sizePackBytes,)}B exceeds cap ${String(maxPackBytes,)}B; size-pack proxy`,);
    return {
      basis: 'local count-objects size-pack (huge-repo fallback)',
      confidence: 'high',
      footprintBytes,
      fullBytes: sizePackBytes,
      shallowBytes: await measureTip({ path, },),
    };
  }

  try {
    /**
     * Tip pack first (cheap), then the full pack (the heavy step).
     */
    const shallowBytes = await measureTip({ path, },);
    /**
     * Full clone-reachable pack, near-exact for a fresh clone.
     */
    const fullBytes = await measurePackBytes({
      cwd: path,
      revListArgs: FULL_REV_LIST,
      packArgs: PACK_ARGS,
    },);
    rl.debug(`local exact: full=${String(fullBytes,)}B shallow=${String(shallowBytes,)}B`,);
    return {
      basis: 'local pack-objects (exact)',
      confidence: 'very high',
      footprintBytes,
      fullBytes,
      shallowBytes,
    };
  }
  catch (error: unknown) {
    rl.debug(`pack-objects failed (${String(error,)}); falling back to size-pack proxy`,);
    return {
      basis: 'local count-objects size-pack (pack-objects failed)',
      confidence: 'high',
      footprintBytes,
      fullBytes: sizePackBytes,
      shallowBytes: await measureTip({ path, },),
    };
  }
}
