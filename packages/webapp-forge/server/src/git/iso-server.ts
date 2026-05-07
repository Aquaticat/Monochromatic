/**
 * Server-side git operations layered on isomorphic-git's public API
 * plus the wire helpers in `pack-protocol.ts`.
 *
 * This file is the public entry point for the route handlers in
 * `server/routes/git.ts`. The implementation is split across:
 *
 * - `iso-server-walk.ts`: object-graph walking for upload-pack
 * - `iso-server-refs.ts`: ref reads/writes + pack indexing
 * - `iso-server-advertisement.ts`: `info/refs` advertisement builder
 *
 * Filesystem strategy: option (a) from
 * `server/TROUBLESHOOTING.isomorphic-git.md` -- bare directories under
 * `WEBAPP_FORGE_GITDIR_ROOT` are the source of truth.
 */

import { readFile, } from 'node:fs/promises';
import nodeFs from 'node:fs';
import { join, } from 'node:path';

// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- the package re-exports ESM as a wildcard namespace
// eslint-disable-next-line import/no-namespace -- isomorphic-git is a flat-named CJS module, namespace import is the only ergonomic shape
import * as git from 'isomorphic-git';

import {
  parseReceivePackBody,
  parseUploadPackBody,
  type RefUpdateTriplet,
  writeReceivePackResponse,
  writeUploadPackResponse,
} from './pack-protocol.ts';
import { collectReachable, } from './iso-server-walk.ts';
import {
  applyRefUpdate,
  ensureRepoExists,
  indexPackData,
} from './iso-server-refs.ts';

export { buildInfoRefsAdvertisement, } from './iso-server-advertisement.ts';
export { ensureRepoExists, } from './iso-server-refs.ts';

/** Length of the OID hex prefix used for git's loose-object directory layout. */
const HEX_PREFIX_LEN = 2;

/** Argument bundle for repo identification. */
type RepoArgs = {
  owner: string;
  repo: string;
};

/**
 * Receive-pack outcome reported back to the caller. The `applied`
 * field lets the dispatcher emit one `push` event per accepted ref
 * update.
 */
export type ReceivePackOutcome = {
  /** Bytes to write back to the client. */
  readonly body: Uint8Array;
  /** Successfully applied (oldOid, newOid, refName) triplets. */
  readonly applied: readonly RefUpdateTriplet[];
};

/**
 * Handles a `POST /x/y.git/git-upload-pack` request.
 *
 * @param row - inputs
 *
 * @returns response body bytes
 *
 * @example
 * ```ts
 * const body = await handleUploadPack({ owner, repo, body: requestBody });
 * ```
 */
export async function handleUploadPack(row: RepoArgs & { body: Uint8Array, },): Promise<Uint8Array> {
  const gitdir = await ensureRepoExists(row,);
  const request = parseUploadPackBody(row.body,);
  const useSideBand64k = request.capabilities.includes('side-band-64k',);
  const useSideBand = useSideBand64k || request.capabilities.includes('side-band',);
  const oids = await collectReachable({
    gitdir,
    wants: request.wants,
    haves: request.haves,
  },);
  let packfile = new Uint8Array(0,);
  if (oids.length > 0) {
    const result = await git.packObjects({
      fs: nodeFs,
      gitdir,
      oids,
      write: false,
    },);
    if (result.packfile !== undefined)
      packfile = new Uint8Array(result.packfile,);
  }
  const chunks = writeUploadPackResponse({
    packfile,
    useSideBand,
    useSideBand64k,
  },);
  return concatChunks(chunks,);
}

/**
 * Handles a `POST /x/y.git/git-receive-pack` request.
 *
 * @param row - inputs
 *
 * @returns response body bytes plus the applied triplets so the caller
 *          can emit `push` events for them
 *
 * @example
 * ```ts
 * const { body, applied } = await handleReceivePack({ owner, repo, body: requestBody });
 * ```
 */
export async function handleReceivePack(row: RepoArgs & { body: Uint8Array, },): Promise<ReceivePackOutcome> {
  const gitdir = await ensureRepoExists(row,);
  const request = parseReceivePackBody(row.body,);
  const useSideBand64k = request.capabilities.includes('side-band-64k',);
  const useSideBand = useSideBand64k || request.capabilities.includes('side-band',);
  if (request.triplets.length === 0) {
    return {
      body: concatChunks(writeReceivePackResponse({
        unpackOk: true,
        refResults: [],
        useSideBand,
        useSideBand64k,
      },),),
      applied: [],
    };
  }
  let unpackOk = true;
  let unpackError: string | undefined = undefined;
  if (request.packfile.byteLength > 0) {
    try {
      await indexPackData({
        gitdir,
        packBytes: request.packfile,
      },);
    } catch (err: unknown) {
      unpackOk = false;
      unpackError = err instanceof Error ? err.message : 'index failed';
    }
  }
  const refResults: {
    refName: string;
    ok: boolean;
    error?: string;
  }[] = [];
  const applied: RefUpdateTriplet[] = [];
  if (unpackOk) {
    for (const triplet of request.triplets) {
      // eslint-disable-next-line no-await-in-loop -- ref updates are atomic per ref; sequential is correct
      const result = await applyRefUpdate({
        gitdir,
        triplet,
      },);
      refResults.push(result.error === undefined
        ? {
          refName: triplet.refName,
          ok: result.ok,
        }
        : {
          refName: triplet.refName,
          ok: result.ok,
          error: result.error,
        },);
      if (result.ok)
        applied.push(triplet,);
    }
  } else {
    for (const triplet of request.triplets) {
      refResults.push({
        refName: triplet.refName,
        ok: false,
        error: unpackError ?? 'unpack failed',
      },);
    }
  }
  const body = concatChunks(writeReceivePackResponse(unpackError === undefined
    ? {
      unpackOk,
      refResults,
      useSideBand,
      useSideBand64k,
    }
    : {
      unpackOk,
      unpackError,
      refResults,
      useSideBand,
      useSideBand64k,
    },),);
  return {
    body,
    applied,
  };
}

/**
 * Reads the contents of a single ref. Returns `undefined` when the
 * ref does not exist.
 *
 * @param row - inputs
 *
 * @returns the OID, or `undefined` when missing
 *
 * @example
 * ```ts
 * const sha = await getRef({ owner, repo, ref: 'refs/heads/main' });
 * ```
 */
export async function getRef(row: RepoArgs & { ref: string, },): Promise<string | undefined> {
  const gitdir = await ensureRepoExists(row,);
  try {
    return await git.resolveRef({
      fs: nodeFs,
      gitdir,
      ref: row.ref,
    },);
  } catch {
    return undefined;
  }
}

/**
 * Lists every ref under the given filepath prefix.
 *
 * @param row - inputs
 *
 * @returns ref names below the prefix (e.g. `'main'` for `'refs/heads'`)
 *
 * @example
 * ```ts
 * const heads = await listRefs({ owner, repo, filepath: 'refs/heads' });
 * ```
 */
export async function listRefs(row: RepoArgs & { filepath: string, },): Promise<readonly string[]> {
  const gitdir = await ensureRepoExists(row,);
  return git.listRefs({
    fs: nodeFs,
    gitdir,
    filepath: row.filepath,
  },);
}

/**
 * Reads a packed object's bytes from disk; helper used by integration tests
 * to inspect a pushed pack's loose objects.
 *
 * @param row - inputs
 *
 * @returns object bytes
 *
 * @example
 * ```ts
 * const bytes = await readLooseObjectBytes({ owner, repo, oid });
 * ```
 */
export async function readLooseObjectBytes(row: RepoArgs & { oid: string, },): Promise<Uint8Array> {
  const gitdir = await ensureRepoExists(row,);
  const path = join(
    gitdir,
    'objects',
    row.oid.slice(
      0,
      HEX_PREFIX_LEN,
    ),
    row.oid.slice(HEX_PREFIX_LEN,),
  );
  return new Uint8Array(await readFile(path,),);
}

/**
 * Concatenates byte chunks into a single `Uint8Array`.
 *
 * @param chunks - ordered chunks
 *
 * @returns a single `Uint8Array` containing every chunk in order
 *
 * @example
 * ```ts
 * concatChunks([new Uint8Array([1]), new Uint8Array([2])]);
 * ```
 */
function concatChunks(chunks: readonly Uint8Array[],): Uint8Array {
  let total = 0;
  for (const chunk of chunks)
    total += chunk.byteLength;
  const out = new Uint8Array(total,);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(
      chunk,
      cursor,
    );
    cursor += chunk.byteLength;
  }
  return out;
}
