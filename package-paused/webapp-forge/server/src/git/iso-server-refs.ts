/**
 * Ref-update + pack-indexing helpers for the receive-pack code path.
 *
 * Split out of `iso-server.ts` for the max-lines budget. These helpers
 * mutate the gitdir's `refs/` and `objects/pack/` directories.
 */

import { randomBytes, } from 'node:crypto';
import nodeFs from 'node:fs';
import {
  mkdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import * as git from 'isomorphic-git';

import { repoGitdir, } from '../lib/git-config.ts';

/**
 * Default branch for newly initialised repos.
 */
const DEFAULT_BRANCH = 'main';

/**
 * All-zero OID used by the smart-HTTP protocol to mark a ref creation
 * (no prior value) or deletion (no new value).
 */
export const ZERO_OID = '0000000000000000000000000000000000000000';

/**
 * Ensures a bare repo at `${gitdir}` exists; creates it on first call.
 *
 * @param row - repo identity
 *
 * @returns absolute gitdir path
 *
 * @example
 * ```ts
 * const gitdir = await ensureRepoExists({ owner: 'alice', repo: 'demo' });
 * ```
 */
export async function ensureRepoExists(row: {
  readonly owner: string;
  readonly repo: string;
},): Promise<string> {
  /**
   * Resolved gitdir path used both for mkdir and the init call below.
   */
  const gitdir = repoGitdir(row,);
  await mkdir(
    gitdir,
    { recursive: true, },
  );
  // git.init is idempotent when called against an existing gitdir; we
  // call it unconditionally so we don't need to probe with stat() first.
  await git.init({
    fs: nodeFs,
    gitdir,
    bare: true,
    defaultBranch: DEFAULT_BRANCH,
  },);
  return gitdir;
}

/**
 * `(refName, oid)` pair used by {@link listAllRefs}.
 */
export type RefPair = readonly [
  string,
  string,
];

/**
 * Result of a single ref-update apply.
 */
export type RefUpdateResultLite = {
  ok: boolean;
  error?: string;
};

/**
 * Bytes per random tag used in temp pack-file names.
 */
const PACK_TAG_BYTES = 16;

/**
 * Lists refs and HEAD as a flat map.
 *
 * @param row - inputs
 *
 * @returns ordered (HEAD first) `[refName, oid]` pairs; an empty array
 *          when the repo has no refs yet
 *
 * @example
 * ```ts
 * const refs = await listAllRefs({ gitdir });
 * ```
 */
export async function listAllRefs(row: { readonly gitdir: string; },): Promise<RefPair[]> {
  /**
   * Raw ref names under `refs/` reported by isomorphic-git.
   */
  const refsBelow = await git.listRefs({
    fs: nodeFs,
    gitdir: row.gitdir,
    filepath: 'refs',
  },);
  /**
   * Names to resolve in advertisement order; HEAD must come first.
   */
  const refNames: string[] = ['HEAD',];
  for (const r of refsBelow)
    refNames.push(`refs/${r}`,);
  /**
   * Collected `[refName, oid]` pairs after successful resolution.
   */
  const out: RefPair[] = [];
  for (const refName of refNames) {
    /**
     * Resolved object id, or `undefined` when the ref resolution throws.
     */
    let oid: string | undefined = undefined;
    try {
      // oxlint-disable-next-line no-await-in-loop -- ref resolution can hit packed-refs lookup; serial is simpler than batched
      oid = await git.resolveRef({
        fs: nodeFs,
        gitdir: row.gitdir,
        ref: refName,
      },);
    }
    catch {
      continue;
    }
    out.push([
      refName,
      oid,
    ],);
  }
  return out;
}

/**
 * Writes `packBytes` to a temp file under the gitdir's pack directory,
 * then asks isomorphic-git to index it.
 *
 * @param row - inputs
 *
 * @example
 * ```ts
 * await indexPackData({ gitdir, packBytes });
 * ```
 */
export async function indexPackData(row: {
  readonly gitdir: string;
  readonly packBytes: Uint8Array;
},): Promise<void> {
  /**
   * Pack directory under the gitdir; created on demand.
   */
  const packDir = join(
    row.gitdir,
    'objects',
    'pack',
  );
  await mkdir(
    packDir,
    { recursive: true, },
  );
  /**
   * Random suffix avoids collision with concurrent pack writes.
   */
  const tag = randomBytes(PACK_TAG_BYTES,)
    .toString('hex',);
  /**
   * Absolute temp path that holds the pack until indexing succeeds.
   */
  const packPath = join(
    packDir,
    `pack-${tag}.pack`,
  );
  await writeFile(
    packPath,
    row.packBytes,
  );
  try {
    await git.indexPack({
      fs: nodeFs,
      // `dir` is required by the public d.ts but the implementation only
      // uses it to discover the gitdir; passing the gitdir itself is fine.
      dir: row.gitdir,
      gitdir: row.gitdir,
      filepath: join(
        'objects',
        'pack',
        `pack-${tag}.pack`,
      ),
    },);
  }
  catch (err: unknown) {
    // Best-effort cleanup; rethrow so the caller can report the failure.
    try {
      await unlink(packPath,);
    }
    catch {
      // Already gone; nothing to clean up.
    }
    throw err;
  }
}

/**
 * Applies one ref update triplet. Validates that the current ref value
 * matches `oldOid` (or that the ref does not exist when `oldOid` is
 * zeros). On `newOid === ZERO_OID`, the ref is deleted.
 *
 * @param row - inputs
 *
 * @returns success flag and optional error reason
 *
 * @example
 * ```ts
 * const result = await applyRefUpdate({
 *   gitdir,
 *   triplet: { oldOid, newOid, refName: 'refs/heads/main' },
 * });
 * ```
 */
export async function applyRefUpdate(row: {
  readonly gitdir: string;
  readonly triplet: {
    readonly oldOid: string;
    readonly newOid: string;
    readonly refName: string;
  };
},): Promise<RefUpdateResultLite> {
  /**
   * Destructured for ergonomic access through the validation branches.
   */
  const {
    triplet,
    gitdir,
  } = row;
  /**
   * Current ref value, or `undefined` when the ref does not yet exist.
   */
  const currentOid =
    await (async function resolveCurrentOid(): Promise<string | undefined> {
      try {
        return await git.resolveRef({
          fs: nodeFs,
          gitdir,
          ref: triplet.refName,
        },);
      }
      catch {
        return undefined;
      }
    })();
  // Validate old-OID: caller asserts what they think the ref points at.
  // Ignore zero comparison (creating a new ref).
  if ((triplet.oldOid
    !== ZERO_OID) && (currentOid !== triplet
      .oldOid)) {
    return {
      ok: false,
      error: triplet.oldOid
        !== currentOid ? 'fetch-first' : 'unknown',
    };
  }
  if (triplet.newOid
    === ZERO_OID) {
    if (currentOid === undefined)
      return { ok: true, };
    try {
      await git.deleteRef({
        fs: nodeFs,
        gitdir,
        ref: triplet.refName,
      },);
      return { ok: true, };
    }
    catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'delete failed',
      };
    }
  }
  try {
    await git.writeRef({
      fs: nodeFs,
      gitdir,
      ref: triplet.refName,
      value: triplet.newOid,
      force: true,
    },);
    return { ok: true, };
  }
  catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'write failed',
    };
  }
}
