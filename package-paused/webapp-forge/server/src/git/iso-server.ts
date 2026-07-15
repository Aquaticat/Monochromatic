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
 * `server/TROUBLESHOOTING.isomorphic-git.md`: bare directories under
 * `WEBAPP_FORGE_GITDIR_ROOT` are the source of truth.
 */

import nodeFs from 'node:fs';
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import * as git from 'isomorphic-git';

import {
  applyRefUpdate,
  ensureRepoExists,
  indexPackData,
} from './iso-server-refs.ts';
import { collectReachable, } from './iso-server-walk.ts';
import {
  parseReceivePackBody,
  parseUploadPackBody,
  type RefUpdateTriplet,
  writeReceivePackResponse,
  writeUploadPackResponse,
} from './pack-protocol.ts';

export { buildInfoRefsAdvertisement, } from './iso-server-advertisement.ts';
export { ensureRepoExists, } from './iso-server-refs.ts';

/**
 * Length of the OID hex prefix used for git's loose-object directory layout.
 */
const HEX_PREFIX_LEN = 2;

/**
 * Argument bundle for repo identification.
 */
type RepoArgs = {
  readonly owner: string;
  readonly repo: string;
};

/**
 * Receive-pack outcome reported back to the caller. The `applied`
 * field lets the dispatcher emit one `push` event per accepted ref
 * update.
 */
export type ReceivePackOutcome = {
  /**
   * Bytes to write back to the client.
   */
  readonly body: Uint8Array;
  /**
   * Successfully applied (oldOid, newOid, refName) triplets.
   */
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
export async function handleUploadPack(
  row: RepoArgs & { readonly body: Uint8Array; },
): Promise<Uint8Array> {
  /**
   * Resolved gitdir for the requested repo.
   */
  const gitdir = await ensureRepoExists(row,);
  /**
   * Parsed upload-pack request driving the rest of the handler.
   */
  const request = parseUploadPackBody(row.body,);
  /**
   * Client opted into 64k side-band frames; checked before generic side-band.
   */
  const useSideBand64k = request.capabilities
    .includes('side-band-64k',);
  /**
   * Either form of side-band selects the multiplexed response shape.
   */
  const useSideBand = useSideBand64k
    || request
    .capabilities
    .includes('side-band',);
  /**
   * Object ids the server still needs to send after subtracting client haves.
   */
  const oids = await collectReachable({
    gitdir,
    wants: request.wants,
    haves: request.haves,
  },);
  /**
   * Packfile bytes; populated from packObjects only when the want set is non-empty.
   */
  const packfile = await (async function buildPackfile(): Promise<Uint8Array> {
    if (oids.length
      === 0)
      return new Uint8Array(0,);
    /**
     * Pack-generation result; `packfile` is undefined for empty packs.
     */
    const result = await git.packObjects({
      fs: nodeFs,
      gitdir,
      oids,
      write: false,
    },);
    if (result.packfile
      === undefined)
      return new Uint8Array(0,);
    return new Uint8Array(result.packfile,);
  })();
  /**
   * Wire chunks framing the packfile plus protocol scaffolding.
   */
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
export async function handleReceivePack(
  row: RepoArgs & { readonly body: Uint8Array; },
): Promise<ReceivePackOutcome> {
  /**
   * Resolved gitdir for the requested repo.
   */
  const gitdir = await ensureRepoExists(row,);
  /**
   * Parsed receive-pack request: triplets, packfile, capabilities.
   */
  const request = parseReceivePackBody(row.body,);
  /**
   * Client opted into 64k side-band frames; checked before generic side-band.
   */
  const useSideBand64k = request.capabilities
    .includes('side-band-64k',);
  /**
   * Either form of side-band selects the multiplexed response shape.
   */
  const useSideBand = useSideBand64k
    || request
    .capabilities
    .includes('side-band',);
  if (request.triplets
    .length
    === 0) {
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
  /**
   * Indexing outcome; isolated so the try/catch state stays scoped to the inner IIFE.
   */
  const {
    unpackOk,
    unpackError,
  } = await (async function tryIndexPack(): Promise<{
    unpackOk: boolean;
    unpackError: string | undefined;
  }> {
    if (request.packfile
      .byteLength
      === 0) {
      return {
        unpackOk: true,
        unpackError: undefined,
      };
    }
    try {
      await indexPackData({
        gitdir,
        packBytes: request.packfile,
      },);
      return {
        unpackOk: true,
        unpackError: undefined,
      };
    }
    catch (err: unknown) {
      return {
        unpackOk: false,
        unpackError: err instanceof Error ? err.message : 'index failed',
      };
    }
  })();
  /**
   * Per-ref outcomes mirrored back into the receive-pack response body.
   */
  const refResults: {
    refName: string;
    ok: boolean;
    error?: string;
  }[] = [];
  /**
   * Successfully applied triplets surfaced to the dispatcher for events.
   */
  const applied: RefUpdateTriplet[] = [];
  if (unpackOk) {
    for (const triplet of request.triplets) {
      /* oxlint-disable no-await-in-loop -- ref updates are atomic per ref; sequential is correct */
      /**
       * Per-ref apply result; sequential because each touches one ref atomically.
       */
      const result = await applyRefUpdate({
        gitdir,
        triplet,
      },);
      /* oxlint-enable no-await-in-loop */
      refResults.push(result.error
        === undefined
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
  }
  else {
    for (const triplet of request.triplets) {
      refResults.push({
        refName: triplet.refName,
        ok: false,
        error: unpackError ?? 'unpack failed',
      },);
    }
  }
  /**
   * Final response bytes; shape depends on whether indexing surfaced an error.
   */
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
export async function getRef(
  row: RepoArgs & { readonly ref: string; },
): Promise<string | undefined> {
  /**
   * Resolved gitdir; created on demand by `ensureRepoExists`.
   */
  const gitdir = await ensureRepoExists(row,);
  try {
    return await git.resolveRef({
      fs: nodeFs,
      gitdir,
      ref: row.ref,
    },);
  }
  catch {
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
export async function listRefs(
  row: RepoArgs & { readonly filepath: string; },
): Promise<readonly string[]> {
  /**
   * Resolved gitdir; created on demand by `ensureRepoExists`.
   */
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
export async function readLooseObjectBytes(
  row: RepoArgs & { readonly oid: string; },
): Promise<Uint8Array> {
  /**
   * Resolved gitdir; created on demand by `ensureRepoExists`.
   */
  const gitdir = await ensureRepoExists(row,);
  /**
   * Loose-object path follows git's `xx/yyy...` two-char prefix layout.
   */
  const path = join(
    gitdir,
    'objects',
    row.oid
      .slice(
      0,
      HEX_PREFIX_LEN,
    ),
    row.oid
      .slice(HEX_PREFIX_LEN,),
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
  /**
   * Running sum of every chunk's byte length to size the output buffer.
   */
  let total = 0;
  for (const chunk of chunks)
    total += chunk.byteLength;
  /**
   * Destination buffer sized exactly to the total chunk length.
   */
  const out = new Uint8Array(total,);
  /**
   * Write position advancing through `out` as each chunk is copied.
   */
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
