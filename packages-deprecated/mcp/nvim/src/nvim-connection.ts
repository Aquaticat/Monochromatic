/**
 * Neovim RPC connection management.
 *
 * Discovers running Neovim instances via socket paths,
 * connects to them, and caches client references.
 *
 * @module
 */

import {
  attach,
  type NeovimClient,
} from 'neovim';
import { readdirSync, } from 'node:fs';
import { connect, } from 'node:net';

//region Connection management: discover and cache connections to all Neovim instances

/**
 * Cached clients keyed by socket path.
 */
const clients = new Map<string, NeovimClient>();

/**
 * Discovers all Neovim RPC socket paths on this system.
 * Includes `$NVIM` (if set) plus all `nvim.*` entries under `/run/user/<uid>/`.
 * Deduplicates in case `$NVIM` points to a socket that also appears in the scan directory.
 *
 * @returns Array of unique socket paths. May be empty if no Neovim instances are running.
 *
 * @example
 * ```ts
 * const paths = findAllSocketPaths();
 * // => ["/run/user/1000/nvim.12345.0", "/run/user/1000/nvim.67890.0"]
 * ```
 */
export function findAllSocketPaths(): string[] {
  /**
   * Set accumulates discovered paths so the `$NVIM` entry can coexist with scan-directory entries without duplication.
   */
  const found = new Set<string>();

  if ((process.env
    .NVIM
    !== undefined) && (process.env
      .NVIM
      !== ''))
    found.add(process.env
      .NVIM,);

  /**
   * Current process UID; `undefined` on platforms where `getuid` isn't available (e.g. Windows).
   */
  const uid = process.getuid?.();
  if (uid !== undefined) {
    /**
     * Per-user runtime directory where Neovim stores its RPC sockets on systemd Linux.
     */
    const dir = `/run/user/${uid}`;
    try {
      /**
       * Filenames matching the `nvim.*` convention; non-nvim entries in the directory are ignored.
       */
      const entries = readdirSync(dir,)
        .filter(function isNvimSocket(entry,) {
        return entry.startsWith('nvim.',);
      },);
      for (const name of entries)
        found.add(`${dir}/${name}`,);
    }
    catch {
      // Directory may not exist or be unreadable; not an error
    }
  }

  return [...found,];
}

/**
 * Connects to a single Neovim instance by socket path.
 * Returns a cached client if already connected.
 *
 * @param socketPath - Absolute path to the Neovim RPC socket.
 *
 * @returns Connected Neovim client.
 *
 * @example
 * ```ts
 * const client = connectToSocket("/run/user/1000/nvim.12345.0");
 * ```
 */
function connectToSocket(socketPath: string,): NeovimClient {
  /**
   * Previously-created client for this socket; reused so each socket has at most one open RPC connection.
   */
  const cached = clients.get(socketPath,);
  if (cached !== undefined)
    return cached;

  /**
   * Bidirectional Unix socket used as both reader and writer for the Neovim RPC client.
   */
  const socket = connect(socketPath,);
  /**
   * Newly-attached Neovim RPC client; cached below so subsequent calls reuse it.
   */
  const nvim = attach({
    reader: socket,
    writer: socket,
  },);
  clients.set(
    socketPath,
    nvim,
  );
  return nvim;
}

/**
 * Connects to all discoverable Neovim instances.
 *
 * @returns Array of connected clients. May be empty.
 *
 * @throws When no Neovim sockets are found at all.
 *
 * @example
 * ```ts
 * const clients = getAllClients();
 * ```
 */
export function getAllClients(): NeovimClient[] {
  /**
   * Every reachable Neovim RPC socket; empty means no Neovim is running, which is treated as a hard error below.
   */
  const paths = findAllSocketPaths();
  if (paths.length
    === 0) {
    throw new Error(
      "No Neovim sockets found. Set $NVIM or run from Neovim's :terminal.",
    );
  }

  return paths.map(function connectSocket(socketPath,) {
    return connectToSocket(socketPath,);
  },);
}

//endregion Connection management
