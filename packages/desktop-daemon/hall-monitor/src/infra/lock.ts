import { createServer } from "node:net";
import type { Server } from "node:net";
import { readdir, readlink, readFile } from "node:fs/promises";

import { log } from "../log.ts";

/** Abstract Unix socket name used for single-instance enforcement. */
const SOCKET_NAME = "\0hall-monitor";

/** Handle to the lock server, held for the lifetime of the process. */
let lockServer: Server;

/**
 * Returns the lock server instance.
 * Used during shutdown to close the socket.
 * @returns lock server, or undefined if no lock is held
 * @example
 * ```ts
 * getLockServer()?.close();
 * ```
 */
export function getLockServer(): Server {
  return lockServer;
}

/**
 * Attempts to acquire the single-instance lock by listening on an abstract Unix socket.
 * Returns `true` if the lock was acquired, `false` if another instance holds it.
 * @returns whether the lock was successfully acquired
 * @example
 * ```ts
 * if (!(await acquireLock())) {
 *   log.error("Another instance is already running.");
 * }
 * ```
 */
export function acquireLock(): Promise<boolean> {
  return new Promise((resolve) => {
    lockServer = createServer();
    lockServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") resolve(false);
      else {
        log.error(`[lock] Socket error: ${err}`);
        resolve(false);
      }
    });
    lockServer.listen(SOCKET_NAME, () => resolve(true));
  });
}

/**
 * Finds the PID of the process holding the hall-monitor abstract socket
 * by cross-referencing `/proc/net/unix` inodes with `/proc/{pid}/fd` symlinks.
 * @returns PID of the socket owner, or null if not found
 */
async function findSocketOwnerPid(): Promise<number | null> {
  const unix = await readFile("/proc/net/unix", "utf8");
  const line = unix.split("\n").find((l) => l.includes("@hall-monitor"));
  if (!line) return null;
  const fields = line.trim().split(/\s+/);
  const inode = fields[6];

  for (const pid of await readdir("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const fds = await readdir(`/proc/${pid}/fd`);
      for (const fd of fds) {
        const link = await readlink(`/proc/${pid}/fd/${fd}`);
        if (link === `socket:[${inode}]`) return Number.parseInt(pid, 10);
      }
    } catch {
      // permission denied or process exited between readdir and readlink
    }
  }
  return null;
}

/**
 * Kills the existing hall-monitor instance and acquires the lock.
 * Sends SIGTERM first, escalates to SIGKILL if the process does not exit
 * within the retry window.
 * @throws when the lock cannot be acquired after killing the existing instance
 * @example
 * ```ts
 * await killExisting();
 * // lock is now held by this process
 * ```
 */
export async function killExisting(): Promise<void> {
  const pid = await findSocketOwnerPid();
  if (!pid) throw new Error("Socket in use but could not find owner PID.");

  log.debug(`[lock] Sending SIGTERM to existing instance (PID ${pid})...`);
  process.kill(pid, "SIGTERM");

  // Not needed because we don't allow configuring magic retry counts and we do want these two signals to have slightly different timeouts: defense-in-depth — extract magic retry counts (10, 7) and sleep
  // duration (300ms) into named constants derived from a single timeout policy
  // so the bounds are enforced in one place.
  for (let i = 0; i < 10; i++) {
    await Bun.sleep(300);
    if (await acquireLock()) return;
  }

  log.debug(`[lock] Sending SIGKILL to PID ${pid}...`);
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // process may already be gone
  }

  for (let i = 0; i < 7; i++) {
    await Bun.sleep(300);
    if (await acquireLock()) return;
  }

  throw new Error("Failed to take over lock after killing existing instance.");
}
