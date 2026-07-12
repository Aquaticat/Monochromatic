/**
 * Neovim RPC bridge: locate the newest Neovim listen socket and send input to
 * it via msgpack-rpc `nvim_input`.
 *
 * Used by the double-shift handler (F20) and by the KWin Ctrl+F4 remap for
 * Neovide (F16). The newest socket is chosen because the user's active Neovim is
 * almost always the most recently started one.
 *
 * @module
 */

import { once } from 'node:events';
import { connect } from 'node:net';
import {
  readdirSync,
  statSync,
} from 'node:fs';

import { encode } from '@msgpack/msgpack';
import { wait } from '@monochromatic-dev/module-async-time';

/** msgpack-rpc message type for a request. */
const RPC_REQUEST = 0;

/** Milliseconds to wait for an RPC reply before giving up on the send. */
const RPC_TIMEOUT_MS = 500;

/** Prefix of Neovim listen-socket filenames under the runtime dir. */
const NVIM_SOCK_PREFIX = 'nvim.';

/** UID fallback when `process.getuid` is unavailable and `$UID` is unset. */
const DEFAULT_UID = 1000;

/** Current UID, used to locate the per-user runtime directory. */
const UID = process.getuid?.() ?? Number(process.env['UID'] ?? DEFAULT_UID);

/** Runtime directory Neovim writes its listen sockets into. */
const NVIM_SOCK_DIR = `/run/user/${UID}`;

/** Monotonically increasing msgpack-rpc message id. */
let rpcMsgId = 0;

/**
 * Find the most recently modified Neovim listen socket, or null when none.
 *
 * @returns Absolute socket path, or null when no Neovim socket is present
 * @example
 * ```ts
 * const sock = findNewestNvimSocket();
 * ```
 */
export function findNewestNvimSocket(): string | null {
  try {
    /** All entries in the per-user runtime directory. */
    const entries = readdirSync(NVIM_SOCK_DIR);
    /** Newest matching socket seen so far. */
    let newest: { path: string; mtime: number } | null = null;
    for (const entry of entries) {
      if (!entry.startsWith(NVIM_SOCK_PREFIX)) {
        continue;
      }
      /** Absolute path of this candidate socket. */
      const full = `${NVIM_SOCK_DIR}/${entry}`;
      try {
        /** Modification time used to pick the newest socket. */
        const mtime = statSync(full).mtimeMs;
        if (!newest || mtime > newest.mtime) {
          newest = { path: full, mtime };
        }
      } catch {
        // Socket removed between readdir and stat: skip it.
        continue;
      }
    }
    return newest?.path ?? null;
  } catch (error) {
    /** Message for a runtime-dir read failure. */
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[key-helper] nvim socket scan error: ${message}`);
    return null;
  }
}

/**
 * Send a key sequence to the newest Neovim over msgpack-rpc `nvim_input`.
 *
 * @param keys - Neovim key notation, e.g. `<F20>`, `<F16>`, `<Esc>`
 * @returns Whether the input was written to a socket
 * @example
 * ```ts
 * await sendNvimInput('<F20>');
 * ```
 */
export async function sendNvimInput(keys: string): Promise<boolean> {
  /** Newest Neovim socket, or null when Neovim is not running. */
  const sockPath = findNewestNvimSocket();
  if (!sockPath) {
    console.error('[key-helper] no nvim socket found');
    return false;
  }
  /** Connection to the Neovim RPC socket. */
  const sock = connect(sockPath);
  try {
    await once(sock, 'connect');
    rpcMsgId += 1;
    /** Encoded `nvim_input` request frame. */
    const message = encode([RPC_REQUEST, rpcMsgId, 'nvim_input', [keys]]);
    sock.write(Buffer.from(message));
    // Wait for a reply, but cap the wait so a silent Neovim cannot hang us.
    await Promise.race([once(sock, 'data'), wait(RPC_TIMEOUT_MS)]);
    return true;
  } catch (error) {
    /** Message for a connect or write failure. */
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[key-helper] nvim socket error: ${message}`);
    return false;
  } finally {
    sock.end();
  }
}
