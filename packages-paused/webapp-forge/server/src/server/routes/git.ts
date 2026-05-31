/**
 * Git smart-HTTP route handlers.
 *
 * Three URLs (everything else is the standard git protocol):
 *
 * - `GET  /:owner/:repo.git/info/refs?service=git-upload-pack`
 * - `GET  /:owner/:repo.git/info/refs?service=git-receive-pack`
 * - `POST /:owner/:repo.git/git-upload-pack`
 * - `POST /:owner/:repo.git/git-receive-pack`
 *
 * Body bytes flow into `iso-server.ts`; this file only deals with HTTP framing
 * and pushing the resulting refs onto the event log.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  HTTPError,
} from 'h3';

import {
  getRepoByOwnerLogin,
  insertEvent,
  nextSequence,
} from '../../data/queries.ts';
import {
  buildInfoRefsAdvertisement,
  handleReceivePack,
  handleUploadPack,
} from '../../git/iso-server.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_OK,
} from '../../lib/http.ts';

/**
 * Standard headers attached to a smart-HTTP refs advertisement.
 *
 * @param service - the negotiated service (`git-upload-pack` or `git-receive-pack`)
 *
 * @returns response headers
 *
 * @example
 * ```ts
 * const headers = refsAdvertisementHeaders('git-upload-pack');
 * ```
 */
function refsAdvertisementHeaders(service: string,): Headers {
  /**
   * Fresh `Headers` instance per call so callers may freely mutate it.
   */
  const headers = new Headers();
  headers.set(
    'content-type',
    `application/x-${service}-advertisement`,
  );
  headers.set(
    'cache-control',
    'no-cache',
  );
  return headers;
}

/**
 * Standard headers attached to a smart-HTTP RPC response (upload-pack/receive-pack).
 *
 * @param service - the negotiated service (`git-upload-pack` or `git-receive-pack`)
 *
 * @returns response headers
 *
 * @example
 * ```ts
 * const headers = rpcResultHeaders('git-upload-pack');
 * ```
 */
function rpcResultHeaders(service: string,): Headers {
  /**
   * Fresh `Headers` instance per call so callers may freely mutate it.
   */
  const headers = new Headers();
  headers.set(
    'content-type',
    `application/x-${service}-result`,
  );
  headers.set(
    'cache-control',
    'no-cache',
  );
  return headers;
}

/**
 * Strips the `.git` suffix from `:repo` route param. Throws 400 when
 * the param does not end in `.git` (clients always include it).
 *
 * @param raw - param value
 *
 * @returns repo name without the suffix
 *
 * @example
 * ```ts
 * stripGitSuffix('demo.git'); // 'demo'
 * ```
 */
function stripGitSuffix(raw: string,): string {
  if (!raw.endsWith('.git',)) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: 'expected repo path to end in .git',
    },);
  }
  /**
   * Suffix length the `slice` below trims off.
   */
  const TAIL = '.git'.length;
  return raw.slice(
    0,
    raw.length
      - TAIL,
  );
}

/**
 * Reads the request body in full. h3 hands us a Web `Request`; using
 * `req.bytes()` gives a `Uint8Array` directly without buffering through
 * a string and back.
 *
 * @param request - incoming request
 *
 * @returns body bytes
 *
 * @example
 * ```ts
 * const body = await readRequestBytes(event.req);
 * ```
 */
async function readRequestBytes(request: Request,): Promise<Uint8Array> {
  /**
   * Buffered request body backing the returned view.
   */
  const buf = await request.arrayBuffer();
  return new Uint8Array(buf,);
}

/**
 * `GET /:owner/:repo.git/info/refs?service=git-upload-pack|git-receive-pack`.
 */
export const gitInfoRefsHandler: EventHandlerWithFetch = defineHandler(
  async function handleInfoRefs(event,) {
    /**
     * Owner login segment of the route path.
     */
    const owner = event.context
      .params
      ?.owner;
    /**
     * Raw `:repo.git` segment of the route path.
     */
    const repoRaw = event.context
      .params
      ?.repo;
    if ((owner === undefined)
      || (owner === '')
      || (repoRaw === undefined)
      || (repoRaw === ''))
    {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing route params',
      },);
    }
    /**
     * Repo name with the `.git` suffix removed.
     */
    const repo = stripGitSuffix(repoRaw,);
    /**
     * Request URL parsed once so query params are reachable below.
     */
    const url = new URL(event.req
      .url,);
    /**
     * Negotiated smart-HTTP service from the `?service=` query param.
     */
    const service = url.searchParams
      .get('service',)
      ?? '';
    if ((service !== 'git-upload-pack') && (service !== 'git-receive-pack')) {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: `unsupported service: ${service}`,
      },);
    }
    /**
     * Advertisement bytes returned in the response body.
     */
    const body = await buildInfoRefsAdvertisement({
      owner,
      repo,
      service,
    },);
    return new Response(
      new Uint8Array(body,),
      {
        status: HTTP_OK,
        headers: refsAdvertisementHeaders(service,),
      },
    );
  },
);

/**
 * `POST /:owner/:repo.git/git-upload-pack`: clone/fetch.
 */
export const gitUploadPackHandler: EventHandlerWithFetch = defineHandler(
  async function handleUploadPackRoute(event,) {
    /**
     * Owner login segment of the route path.
     */
    const owner = event.context
      .params
      ?.owner;
    /**
     * Raw `:repo.git` segment of the route path.
     */
    const repoRaw = event.context
      .params
      ?.repo;
    if ((owner === undefined)
      || (owner === '')
      || (repoRaw === undefined)
      || (repoRaw === ''))
    {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing route params',
      },);
    }
    /**
     * Repo name with the `.git` suffix removed.
     */
    const repo = stripGitSuffix(repoRaw,);
    /**
     * Full request body bytes fed to the iso-server.
     */
    const requestBody = await readRequestBytes(event.req,);
    /**
     * Response body bytes returned from the upload-pack handler.
     */
    const responseBody = await handleUploadPack({
      owner,
      repo,
      body: requestBody,
    },);
    return new Response(
      new Uint8Array(responseBody,),
      {
        status: HTTP_OK,
        headers: rpcResultHeaders('git-upload-pack',),
      },
    );
  },
);

/**
 * `POST /:owner/:repo.git/git-receive-pack`: push.
 *
 * For every accepted ref update we record a `push` event in the
 * forge's event log. Unknown repos are accepted at the git layer
 * (the directory is auto-created) but get no `push` event because
 * there is no DB resource to attach it to. This matches Phase 2
 * scope: real auth and DB-side repo creation come with Better Auth.
 */
export const gitReceivePackHandler: EventHandlerWithFetch = defineHandler(
  async function handleReceivePackRoute(event,) {
    /**
     * Owner login segment of the route path.
     */
    const owner = event.context
      .params
      ?.owner;
    /**
     * Raw `:repo.git` segment of the route path.
     */
    const repoRaw = event.context
      .params
      ?.repo;
    if ((owner === undefined)
      || (owner === '')
      || (repoRaw === undefined)
      || (repoRaw === ''))
    {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'missing route params',
      },);
    }
    /**
     * Repo name with the `.git` suffix removed.
     */
    const repo = stripGitSuffix(repoRaw,);
    /**
     * Full request body bytes fed to the iso-server.
     */
    const requestBody = await readRequestBytes(event.req,);
    /**
     * Receive-pack outcome: response body plus applied ref triplets.
     */
    const outcome = await handleReceivePack({
      owner,
      repo,
      body: requestBody,
    },);
    /**
     * Repo row needed to record push events; missing rows skip the event log.
     */
    const repoRow = await getRepoByOwnerLogin({
      ownerLogin: owner,
      name: repo,
    },);
    if (repoRow !== undefined) {
      /**
       * Timestamp shared by every push event emitted in this loop iteration.
       */
      const now = Date.now();
      for (const triplet of outcome.applied) {
        /* oxlint-disable no-await-in-loop -- one event row per ref; serial is intentional for ordering */
        /**
         * Per-resource monotonic sequence used by the dispatcher.
         */
        const sequenceNumber = await nextSequence({
          resourceType: 'repo',
          resourceId: repoRow.id,
        },);
        /* oxlint-enable no-await-in-loop */
        // oxlint-disable-next-line no-await-in-loop -- ditto: events must land in ref-update order
        await insertEvent({
          resourceType: 'repo',
          resourceId: repoRow.id,
          kind: 'push',
          payload: {
            refName: triplet.refName,
            oldOid: triplet.oldOid,
            newOid: triplet.newOid,
          },
          sequenceNumber,
          createdAt: now,
        },);
      }
    }
    return new Response(
      new Uint8Array(outcome.body,),
      {
        status: HTTP_OK,
        headers: rpcResultHeaders('git-receive-pack',),
      },
    );
  },
);
