/**
 * Hetzner Cloud HTTP API client and typed helpers.
 *
 * A small `fetch` wrapper adds the bearer token and JSON handling; typed
 * helpers cover the server, SSH key, image, and action endpoints mvm needs.
 * Action polling uses the generic `GET /actions/{id}` because the
 * resource-instance action endpoint is deprecated.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { VM_PREFIX, } from '../../config.ts';
import {
  l,
  tagged,
} from '../../log.ts';
import {
  MVM_LABEL_SELECTOR,
  requireToken,
} from './config.ts';
import type {
  HetznerAction,
  HetznerImage,
  HetznerServer,
  HetznerSshKey,
} from './types.ts';

//region Constants and errors

/**
 * Base URL for the Hetzner Cloud API.
 */
const API_BASE = 'https://api.hetzner.cloud/v1';

/**
 * Items requested per page on list endpoints.
 */
const PER_PAGE = 50;

/**
 * Delay between action-status polls.
 */
const POLL_INTERVAL_MS = 1_000;

/**
 * Maximum time to wait for an action to leave the `running` state.
 */
const ACTION_TIMEOUT_MS = 120_000;

/**
 * Error carrying the HTTP status and Hetzner error code so callers can branch
 * (for example, falling back across locations on `resource_unavailable`).
 *
 * @example
 * ```ts
 * try { await createServer(...); }
 * catch (err) { if (err instanceof HetznerApiError && err.code === 'resource_unavailable') retry(); }
 * ```
 */
export class HetznerApiError extends Error {
  /**
   * HTTP status code of the failed response.
   */
  readonly status: number;
  /**
   * Hetzner error code (e.g. `resource_unavailable`, `not_found`).
   */
  readonly code: string;

  /**
   * @param status - HTTP status code
   *
   * @param code - Hetzner error code
   *
   * @param message - human-readable error message
   */
  constructor(
    {
      status,
      code,
      message,
    }: {
      readonly status: number;
      readonly code: string;
      readonly message: string;
    },
  ) {
    super(message,);
    this.name = 'HetznerApiError';
    this.status = status;
    this.code = code;
  }
}

//endregion Constants and errors

//region Core request

/**
 * Issues an authenticated JSON request to the Hetzner Cloud API.
 *
 * @param method - HTTP method
 *
 * @param path - path under the API base, beginning with `/`
 *
 * @param body - optional JSON request body
 *
 * @returns parsed JSON response, or `undefined` for empty (204) responses
 *
 * @throws HetznerApiError when the response status is not ok
 *
 * @example
 * ```ts
 * const { servers } = await hcloud<{ servers: HetznerServer[] }>({ method: 'GET', path: '/servers' });
 * ```
 */
async function hcloud<T>(
  {
    method,
    path,
    body,
  }: {
    readonly method: string;
    readonly path: string;
    readonly body?: unknown;
  },
): Promise<T> {
  /**
   * Logger scoped to this request so failures are namespaced.
   */
  const rl = tagged({
    tag: hcloud.name,
    l,
  },);
  /**
   * Base headers; `Content-Type` is added only when a body is sent.
   */
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireToken()}`,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  rl.debug(`${method} ${path}`,);

  /**
   * Raw HTTP response; inspected for ok-ness before parsing.
   */
  const res = await fetch(
    `${API_BASE}${path}`,
    {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body,), } : {}),
    },
  );

  if (!res.ok) {
    /**
     * Error code parsed from the body, defaulted when the body is not JSON.
     */
    let code = 'unknown';
    /**
     * Error message parsed from the body, defaulted to the HTTP status text.
     */
    let message = res.statusText;
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Hetzner API error envelope
      const errBody = await res.json() as { error?: { code?: string; message?: string; }; };
      if (errBody.error !== undefined) {
        code = errBody.error.code ?? code;
        message = errBody.error.message ?? message;
      }
    }
    catch {
      rl.debug('error response body was not JSON',);
    }
    throw new HetznerApiError({
      code,
      message,
      status: res.status,
    },);
  }

  if (res.status === 204) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 204 No Content has no body
    return undefined as T;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted Hetzner API JSON response
  return await res.json() as T;
}

//endregion Core request

//region Pagination

/**
 * Fetches every page of a list endpoint, accumulating one resource array.
 *
 * @param path - list path with any filters already applied (no page params)
 *
 * @param key - response envelope key holding the resource array
 *
 * @returns all items across pages, in order
 *
 * @example
 * ```ts
 * const servers = await fetchAllPages<HetznerServer>({ path: '/servers', key: 'servers' });
 * ```
 */
async function fetchAllPages<T>(
  {
    path,
    key,
  }: {
    readonly path: string;
    readonly key: string;
  },
): Promise<readonly T[]> {
  /**
   * Accumulated items across every page.
   */
  const items: T[] = [];
  /**
   * Current page number; advances until the API reports no next page.
   */
  let page = 1;
  /**
   * Separator for appending pagination params, accounting for existing query.
   */
  const sep = path.includes('?',) ? '&' : '?';
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- deliberate sequential pagination
    const body = await hcloud<{
      readonly meta: { readonly pagination: { readonly next_page: number | null; }; };
    } & Readonly<Record<string, readonly T[]>>>({
      method: 'GET',
      path: `${path}${sep}page=${String(page,)}&per_page=${String(PER_PAGE,)}`,
    },);
    items.push(...(body[key] ?? []),);
    /**
     * Next page number, or `null` when this was the last page.
     */
    const next = body.meta.pagination.next_page;
    if (next === null) {
      return items;
    }
    page = next;
  }
}

//endregion Pagination

//region Action polling

/**
 * Polls the generic action endpoint until the action succeeds.
 *
 * @param id - action id from a mutating response
 *
 * @throws Error when the action ends in `error` or does not finish before the timeout
 *
 * @example
 * ```ts
 * const { action } = await createServer(...);
 * await waitForAction({ id: action.id });
 * ```
 */
export async function waitForAction({ id, }: { readonly id: number; },): Promise<void> {
  /**
   * Deadline after which polling gives up.
   */
  const deadline = Date.now() + ACTION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- deliberate serial polling
    const { action, } = await hcloud<{ readonly action: HetznerAction; }>({
      method: 'GET',
      path: `/actions/${String(id,)}`,
    },);
    if (action.status === 'success') {
      return;
    }
    if (action.status === 'error') {
      throw new Error(
        `Hetzner action ${String(id,)} failed: ${action.error?.message ?? 'unknown error'}`,
      );
    }
    // oxlint-disable-next-line no-await-in-loop -- deliberate serial polling
    await wait(POLL_INTERVAL_MS,);
  }
  throw new Error(
    `Hetzner action ${String(id,)} did not finish within ${String(ACTION_TIMEOUT_MS,)}ms`,
  );
}

//endregion Action polling

//region Servers

/**
 * Creates a server in a single location.
 *
 * @param image - image slug or id to boot from
 *
 * @param labels - labels to attach (must include the mvm ownership label)
 *
 * @param location - location code to provision in
 *
 * @param name - full server name including the mvm- prefix
 *
 * @param serverType - server type slug
 *
 * @param sshKeyId - numeric id of the SSH key to inject
 *
 * @returns created server and the boot action to poll
 *
 * @throws HetznerApiError with code `resource_unavailable` when out of stock
 *
 * @example
 * ```ts
 * const { server, action } = await createServer({ name: 'mvm-dev', serverType: 'cx22', location: 'fsn1', image: 'ubuntu-24.04', sshKeyId: 42, labels: { mvm: 'true' } });
 * ```
 */
export async function createServer(
  {
    image,
    labels,
    location,
    name,
    serverType,
    sshKeyId,
  }: {
    readonly image: number | string;
    readonly labels: Readonly<Record<string, string>>;
    readonly location: string;
    readonly name: string;
    readonly serverType: string;
    readonly sshKeyId: number;
  },
): Promise<{ readonly server: HetznerServer; readonly action: HetznerAction; }> {
  return hcloud<{ readonly server: HetznerServer; readonly action: HetznerAction; }>({
    method: 'POST',
    path: '/servers',
    body: {
      image,
      labels,
      location,
      name,
      server_type: serverType,
      ssh_keys: [sshKeyId,],
      start_after_create: true,
    },
  },);
}

/**
 * Lists every mvm-managed server (filtered by the ownership label selector).
 *
 * @returns all mvm-labelled servers
 *
 * @example
 * ```ts
 * const servers = await listMvmServers();
 * ```
 */
export async function listMvmServers(): Promise<readonly HetznerServer[]> {
  return fetchAllPages<HetznerServer>({
    key: 'servers',
    path: `/servers?label_selector=${encodeURIComponent(MVM_LABEL_SELECTOR,)}`,
  },);
}

/**
 * Resolves a single mvm-managed server by its unprefixed name.
 * Filters by the ownership label and exact full name, so it can never operate
 * on an unrelated server that merely shares the `mvm-<name>` name.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns the matching server
 *
 * @throws Error when zero or more than one mvm-labelled server matches
 *
 * @example
 * ```ts
 * const server = await getMvmServerByName({ name: 'dev-01' });
 * ```
 */
export async function getMvmServerByName(
  { name, }: { readonly name: string; },
): Promise<HetznerServer> {
  /**
   * Full server name including the mvm- prefix; the exact match target.
   */
  const fullName = `${VM_PREFIX}${name}`;
  /**
   * mvm-labelled servers whose name exactly matches; the API name filter plus a
   * defensive exact compare guard against substring or unrelated matches.
   */
  const matches = (await fetchAllPages<HetznerServer>({
    key: 'servers',
    path: `/servers?label_selector=${encodeURIComponent(MVM_LABEL_SELECTOR,)}&name=${
      encodeURIComponent(fullName,)
    }`,
  },)).filter(function exactName(server,) {
    return server.name === fullName;
  },);
  /**
   * Destructured head plus tail so the single-match guarantee is enforced
   * without a non-null assertion.
   */
  const [match, ...rest] = matches;
  if (match === undefined) {
    throw new Error(`no mvm-managed Hetzner server named ${name}`,);
  }
  if (rest.length > 0) {
    throw new Error(
      `ambiguous: ${String(matches.length,)} mvm-managed Hetzner servers named ${name}`,
    );
  }
  return match;
}

/**
 * Deletes a server by id.
 *
 * @param id - numeric server id
 *
 * @example
 * ```ts
 * await deleteServer({ id: 576675 });
 * ```
 */
export async function deleteServer({ id, }: { readonly id: number; },): Promise<void> {
  await hcloud<unknown>({
    method: 'DELETE',
    path: `/servers/${String(id,)}`,
  },);
}

//endregion Servers

//region SSH keys

/**
 * Lists every SSH key in the project.
 *
 * @returns all SSH keys
 *
 * @example
 * ```ts
 * const keys = await listSshKeys();
 * ```
 */
export async function listSshKeys(): Promise<readonly HetznerSshKey[]> {
  return fetchAllPages<HetznerSshKey>({
    key: 'ssh_keys',
    path: '/ssh_keys',
  },);
}

/**
 * Uploads an SSH public key.
 *
 * @param name - key name within the project
 *
 * @param publicKey - full public key line
 *
 * @returns the created key
 *
 * @example
 * ```ts
 * const key = await createSshKey({ name: 'mvm-abc', publicKey: 'ssh-ed25519 AAAA...' });
 * ```
 */
export async function createSshKey(
  {
    name,
    publicKey,
  }: {
    readonly name: string;
    readonly publicKey: string;
  },
): Promise<HetznerSshKey> {
  return (await hcloud<{ readonly ssh_key: HetznerSshKey; }>({
    method: 'POST',
    path: '/ssh_keys',
    body: {
      name,
      public_key: publicKey,
    },
  },)).ssh_key;
}

//endregion SSH keys

//region Images

/**
 * Lists images, optionally filtered by type and ownership label.
 *
 * @param labelSelector - optional label selector
 *
 * @param type - optional image type (e.g. `system`, `snapshot`)
 *
 * @returns matching images
 *
 * @example
 * ```ts
 * const systemImages = await listImages({ type: 'system' });
 * ```
 */
export async function listImages(
  {
    labelSelector,
    type,
  }: {
    readonly labelSelector?: string;
    readonly type?: string;
  } = {},
): Promise<readonly HetznerImage[]> {
  /**
   * Query parameters assembled from the optional filters.
   */
  const params = new URLSearchParams();
  if (type !== undefined) {
    params.set(
      'type',
      type,
    );
  }
  if (labelSelector !== undefined) {
    params.set(
      'label_selector',
      labelSelector,
    );
  }
  /**
   * Query string with a leading `?` only when filters are present.
   */
  const query = (params.toString() === '') ? '' : `?${params.toString()}`;
  return fetchAllPages<HetznerImage>({
    key: 'images',
    path: `/images${query}`,
  },);
}

/**
 * Snapshots a server into an independent image.
 *
 * @param description - human-readable snapshot description
 *
 * @param labels - labels to attach (must include the mvm ownership label)
 *
 * @param serverId - source server id
 *
 * @returns the snapshot action to poll and the created image
 *
 * @example
 * ```ts
 * const { action, image } = await createImage({ serverId: 1, description: 'clone of dev-01', labels: { mvm: 'true' } });
 * ```
 */
export async function createImage(
  {
    description,
    labels,
    serverId,
  }: {
    readonly description: string;
    readonly labels: Readonly<Record<string, string>>;
    readonly serverId: number;
  },
): Promise<{ readonly action: HetznerAction; readonly image: HetznerImage; }> {
  return hcloud<{ readonly action: HetznerAction; readonly image: HetznerImage; }>({
    method: 'POST',
    path: `/servers/${String(serverId,)}/actions/create_image`,
    body: {
      description,
      labels,
      type: 'snapshot',
    },
  },);
}

/**
 * Deletes an image (snapshot) by id.
 *
 * @param id - numeric image id
 *
 * @example
 * ```ts
 * await deleteImage({ id: 12345 });
 * ```
 */
export async function deleteImage({ id, }: { readonly id: number; },): Promise<void> {
  await hcloud<unknown>({
    method: 'DELETE',
    path: `/images/${String(id,)}`,
  },);
}

//endregion Images
