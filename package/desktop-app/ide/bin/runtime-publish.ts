// Publishing of the prepared language runtime into target/<profile>/runtime, safe for concurrent callers.
// What: an exclusive lock for the whole preparation, and file writes that stage under a name no other process uses,
// skip a file whose destination already holds the same bytes, and rename into place.
// Why: two tasks that depend on `runtime` (for example `build` and `test` started together) used to share the staging
// name `<grammar>.so.new`, so one caller renamed it away while the other renamed it too (ENOENT), and both wrote the
// same shared directories. The build script reads manifest.json and every file it lists, so a reader must see either
// the previous complete file or the new complete file, never a partial one, and the manifest comes last.
// The mise task `runtime` imports this file (node strips the types); the functions are tested in
// runtime-publish.test.ts.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/**
 * Names that {@link stagingPathFor} produces: `.<process id>.<8 hex digits>.new` after the final name.
 */
export const stagingSuffix = /\.\d+\.[0-9a-f]{8}\.new$/;

/**
 * Staging path beside `output`, unique to this call.
 *
 * The process id keeps two processes apart and the random part keeps two calls of one process apart; the file lives
 * in the same directory as `output`, so the final rename never crosses a file system.
 *
 * @param options - `output` is the final path.
 * @returns The path to write first.
 */
export const stagingPathFor = ({ output }: { output: string }): string =>
  `${output}.${process.pid}.${randomBytes(4).toString('hex')}.new`;

const isSameFile = ({ left, right }: { left: Buffer; right: string }): boolean => {
  if (!existsSync(right) || !lstatSync(right).isFile()) {
    return false;
  }
  return left.equals(readFileSync(right));
};

/**
 * Put `bytes` at `output` atomically; leave `output` untouched when it already holds exactly these bytes.
 *
 * A reader sees the previous file or the new file, never part of one. The staging file is removed when a step fails.
 * The skip keeps a current file's modification time, so a build that watches the runtime directory does not rebuild
 * for a rewrite that changed nothing.
 *
 * @param options - `output` is the final path; `bytes` the complete content; `mode` the permission bits for a new file.
 */
export const publishBytes = ({ output, bytes, mode = 0o644 }: { output: string; bytes: Buffer; mode?: number }): void => {
  if (isSameFile({ left: bytes, right: output })) {
    return;
  }
  const staging = stagingPathFor({ output });
  try {
    writeFileSync(staging, bytes, { mode });
    renameSync(staging, output);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }
};

/**
 * Copy `source` to `output` atomically with the permission bits of `source`; skip it when `output` is already equal.
 *
 * @param options - `source` is the file to read; `output` the final path.
 */
export const publishFile = ({ source, output }: { source: string; output: string }): void => {
  const bytes = readFileSync(source);
  if (isSameFile({ left: bytes, right: output })) {
    return;
  }
  const staging = stagingPathFor({ output });
  try {
    copyFileSync(source, staging);
    renameSync(staging, output);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }
};

/**
 * Copy a file or a directory tree into `destination`, file by file through {@link publishFile}.
 *
 * @param options - `source` is a regular file or a directory; `destination` the path it takes.
 * @throws {Error} When an entry of the tree is neither a regular file, a link, nor a directory.
 */
export const publishTree = ({ source, destination }: { source: string; destination: string }): void => {
  const kind = lstatSync(source);
  if (kind.isFile()) {
    publishFile({ source, output: destination });
    return;
  }
  if (kind.isSymbolicLink()) {
    // A link keeps being a link, as the plain recursive copy it replaces made it; creating one is a single step.
    rmSync(destination, { force: true });
    cpSync(source, destination);
    return;
  }
  if (!kind.isDirectory()) {
    throw new Error(`Cannot publish ${source}: it is neither a regular file, a link, nor a directory`);
  }
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) {
    publishTree({ source: join(source, name), destination: join(destination, name) });
  }
};

/**
 * Delete staging files that a killed earlier run left below `root`.
 *
 * Call it only while holding the lock, so no live publisher owns one of them. The build script embeds every file under
 * the query and notice directories, so a leftover would otherwise be carried into the binary.
 *
 * @param options - `root` is the directory to sweep.
 */
export const removeStaging = ({ root }: { root: string }): void => {
  if (!existsSync(root)) {
    return;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      removeStaging({ root: path });
    } else if (stagingSuffix.test(entry.name)) {
      rmSync(path, { force: true });
    }
  }
};

/**
 * Run `work` while this process holds an exclusive lock on `lockFile`; other callers wait until it ends.
 *
 * The kernel owns the lock: a helper process holds `flock` on the file until its standard input closes, and that
 * happens when this process ends in any way, so no stale lock can survive a kill. The directory of `lockFile` must
 * exist.
 *
 * @param options - `lockFile` is created when missing; `work` runs once the lock is held.
 * @returns What `work` returns.
 * @throws {Error} When `flock` cannot start or ends before it reports the lock; errors of `work` pass through.
 */
export const withExclusiveLock = async <Result>(
  { lockFile, work }: { lockFile: string; work: () => Result | Promise<Result> },
): Promise<Result> => {
  const holder = spawn(
    'flock',
    [
      '--exclusive',
      lockFile,
      process.execPath,
      '--eval',
      'console.log("held"); process.stdin.resume()',
    ],
    { stdio: ['pipe', 'pipe', 'inherit'] },
  );
  // Closing the pipe of a holder that already died reports EPIPE; the exit is handled through `ended` and `closed`.
  holder.stdin.on('error', () => {});
  const ended = new Promise<never>((_resolve, reject) => {
    holder.once('error', reject);
    holder.once('close', (code) => reject(new Error(`flock ended with status ${code} before it held ${lockFile}`)));
  });
  const held = new Promise<void>((resolve) => {
    let seen = '';
    holder.stdout.on('data', (chunk: Buffer) => {
      seen += chunk.toString();
      if (seen.includes('held')) {
        resolve();
      }
    });
  });
  const waiting = setTimeout(() => {
    console.error(`Waiting for another runtime preparation to release ${lockFile}`);
  }, 1000);
  try {
    await Promise.race([held, ended]);
  } finally {
    clearTimeout(waiting);
  }
  try {
    return await work();
  } finally {
    // The holder may already be gone (it was killed); waiting for a close that has happened would never end.
    const closed = new Promise<void>((resolve) => {
      if (holder.exitCode !== null || holder.signalCode !== null) {
        resolve();
      } else {
        holder.once('close', () => resolve());
      }
    });
    holder.stdin.end();
    await closed;
  }
};
