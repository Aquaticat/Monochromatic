/**
 * Invocation provenance log for the inference canary.
 *
 * Imported as the first module in `index.ts` so it runs before any other
 * side-effecting code. Records process tree, executable path, working directory,
 * command-line arguments, and a hash of environment variables (with secret-named
 * values redacted) at startup.
 *
 * Output: `<package-root>/_invocation-log.jsonl`, one JSON record per invocation.
 *
 * This exists to answer "who triggered this canary run?" when an invocation is
 * unexpected. The April mystery, where a canary run had no identifiable trigger
 * across crontab, systemd, scheduled tasks, hooks, and session transcripts,
 * motivated this addition.
 *
 * Failure mode: every individual /proc read is wrapped in a helper that returns
 * `null` on error. A partial record (with `null` exe or empty parentChain) is
 * more useful than an exception that prevents canary startup. The outermost
 * write is also wrapped so a write error never breaks the run.
 *
 * @example Reading the log to attribute a recent invocation
 *
 * ```sh
 * tail -1 packages/dev-script/inference-canary/_invocation-log.jsonl | jq .
 * ```
 */
import { createHash, } from 'node:crypto';
import {
  appendFileSync,
  readFileSync,
  readlinkSync,
} from 'node:fs';
import { join, } from 'node:path';

import { PACKAGE_DIR, } from './paths.ts';

/**
 * A single frame in the parent-process chain walked from /proc.
 */
type ProcessFrame = {
  /**
   * Process ID at this level of the chain.
   */
  readonly pid: number;
  /**
   * Resolved /proc/PID/exe symlink (e.g. /usr/bin/bun); empty string if unreadable.
   */
  readonly exe: string;
  /**
   * Space-separated argv from /proc/PID/cmdline; empty when unreadable.
   */
  readonly cmdline: string;
  /**
   * Parent PID parsed from /proc/PID/status; 0 at root or when unreadable.
   */
  readonly ppid: number;
};

/**
 * Full invocation provenance record written as one JSONL line.
 */
type InvocationRecord = {
  /**
   * ISO 8601 UTC timestamp at startup.
   */
  readonly timestamp: string;
  /**
   * This process's PID.
   */
  readonly pid: number;
  /**
   * This process's parent PID.
   */
  readonly ppid: number;
  /**
   * Resolved /proc/self/exe symlink; empty string if unreadable.
   */
  readonly exe: string;
  /**
   * Working directory at startup.
   */
  readonly cwd: string;
  /**
   * Full argv as launched.
   */
  readonly argv: readonly string[];
  /**
   * sha256 of sorted env entries; secret-named keys hash length only.
   */
  readonly envHash: string;
  /**
   * Parent chain walked from `ppid` until pid 1, unreadable, or depth limit.
   */
  readonly parentChain: readonly ProcessFrame[];
};

/**
 * Upper-cased substrings whose presence in an env-var key marks the value as secret.
 */
const SECRET_KEY_MARKERS: readonly string[] = [
  'KEY',
  'TOKEN',
  'SECRET',
  'PASSWORD',
  'PASSWD',
  'CREDENTIAL',
];

/**
 * Returns true when `key` carries any of the {@link SECRET_KEY_MARKERS}
 * substrings (case-insensitively). Replaces the prior
 * `SECRET_KEY_PATTERN = /KEY|TOKEN|.../i` regex with an explicit
 * upper-cased `includes` check; the upper-case copy is computed once and
 * each marker test is O(n).
 *
 * @param key - env var name
 *
 * @returns whether the value should be hashed by length rather than verbatim
 */
function isSecretKey(key: string,): boolean {
  /**
   * Upper-cased key so the marker check matches the prior `/.../i` flag.
   */
  const upper = key.toUpperCase();
  return SECRET_KEY_MARKERS.some(function carriesMarker(marker,): boolean {
    return upper.includes(marker,);
  },);
}

/**
 * Maximum depth to walk the parent chain before giving up.
 */
const PARENT_CHAIN_MAX_DEPTH = 32;

/**
 * Read a /proc file as UTF-8. Returns null on any error so callers can fall
 * through to writing a partial record instead of throwing during startup.
 *
 * @param pid - Process ID whose /proc directory to read from
 *
 * @param name - File name within /proc/PID/ (e.g. `status`, `cmdline`)
 *
 * @returns File contents, or empty string when unreadable
 */
function readProcFile(
  {
    pid,
    name,
  }: {
    readonly pid: number;
    readonly name: string;
  },
): string {
  try {
    return readFileSync(
      `/proc/${String(pid,)}/${name}`,
      'utf8',
    );
  }
  catch {
    return '';
  }
}

/**
 * Resolve a /proc symlink. Returns null on any error so callers can fall
 * through to writing a partial record instead of throwing during startup.
 *
 * @param pid - Process ID whose /proc directory to read from
 *
 * @param name - Symlink name within /proc/PID/ (e.g. `exe`)
 *
 * @returns Symlink target, or empty string when unreadable
 */
function readProcLink(
  {
    pid,
    name,
  }: {
    readonly pid: number;
    readonly name: string;
  },
): string {
  try {
    return readlinkSync(`/proc/${String(pid,)}/${name}`,);
  }
  catch {
    return '';
  }
}

/**
 * Parse the PPid line from /proc/PID/status content.
 *
 * @param statusContent - Raw status file contents, empty when unreadable
 *
 * @returns Parsed parent PID, or 0 when not present or unparseable
 */
function parsePpid(statusContent: string,): number {
  if (statusContent === '')
    return 0;
  /**
   * First `PPid:` line from /proc/PID/status, if any; bare `find` returns undefined when missing.
   */
  const ppidLine = statusContent
    .split('\n',)
    .find(function isPpidLine(line,): boolean {
      return line.startsWith('PPid:',);
    },);
  if (ppidLine === undefined)
    return 0;
  /**
   * Parsed integer ppid; falls back to 0 below when /proc emits a non-numeric value.
   */
  const num = Number.parseInt(
    ppidLine.slice('PPid:'.length,)
      .trim(),
    10,
  );
  return Number.isNaN(num,) ? 0 : num;
}

/**
 * Read a single process frame from /proc.
 *
 * @param pid - Process ID to read
 *
 * @returns single-frame array, or empty array when the process is gone or unreadable
 */
function readProcessFrame(pid: number,): readonly ProcessFrame[] {
  /**
   * Raw /proc/PID/status text; empty short-circuits the rest of the frame when the process is gone.
   */
  const status = readProcFile({
    pid,
    name: 'status',
  },);
  if (status === '')
    return [];
  /**
   * Raw cmdline buffer with NUL separators; empty string when readable but blank (kernel threads) or unreadable.
   */
  const cmdlineRaw = readProcFile({
    pid,
    name: 'cmdline',
  },);
  /**
   * Human-readable cmdline with NULs replaced by spaces and trailing NUL removed.
   */
  const cmdline = cmdlineRaw
    .replaceAll(
      '\0',
      ' ',
    )
    .trimEnd();
  /**
   * Resolved /proc/PID/exe symlink target; empty string when not permitted or when exe was unlinked.
   */
  const exe = readProcLink({
    pid,
    name: 'exe',
  },);
  /**
   * Parent PID extracted from the status text; 0 means "no parent / unparseable".
   */
  const ppid = parsePpid(status,);
  return [{
    pid,
    exe,
    cmdline,
    ppid,
  },];
}

/**
 * Walk the parent process chain from a starting PID. Stops at pid 1, when a
 * frame is unreadable, when ppid==pid (cycle), or after `remaining` reaches 0.
 *
 * @param pid - Starting PID (typically `process.ppid`)
 *
 * @param remaining - Frames left to walk before stopping
 *
 * @returns Array of frames from `pid` toward init
 */
function walkParentChain(
  {
    pid,
    remaining,
  }: {
    readonly pid: number;
    readonly remaining: number;
  },
): ProcessFrame[] {
  if (remaining <= 0)
    return [];
  /**
   * Current frame of the parent chain; an empty array terminates the walk on read failure.
   */
  const [frame,] = readProcessFrame(pid,);
  if (frame === undefined)
    return [];
  if ((frame.ppid
    === 0) || (frame.ppid
      === pid))
    return [frame,];
  return [
    frame,
    ...walkParentChain({
      pid: frame.ppid,
      remaining: remaining - 1,
    },),
  ];
}

/**
 * Compute sha256 over sorted environment entries. Values for keys matching
 * `SECRET_KEY_PATTERN` are replaced with a length marker so the hash differs
 * when a secret value changes but the secret itself never enters the hash input.
 *
 * @param env - Environment to hash, typically `process.env`
 *
 * @returns `sha256:<hex>` digest string
 */
function hashEnvironment(env: NodeJS.ProcessEnv,): string {
  /**
   * Sorted `key=value\n` lines; sorting makes the hash stable across env-iteration order.
   */
  const lines = Object
    .keys(env,)
    .toSorted()
    .map(function envLine(key,): string {
      /**
       * Env value for `key`; defaults to '' so unset keys still hash deterministically.
       */
      const value = env[key]
        ?? '';
      return isSecretKey(key,)
        ? `${key}=<len:${String(value.length,)}>\n`
        : `${key}=${value}\n`;
    },);
  /**
   * Streaming sha256 instance; updated with concatenated lines and finalised below.
   */
  const hash = createHash('sha256',);
  hash.update(lines.join('',),);
  return `sha256:${hash.digest('hex',)}`;
}

/**
 * Build the full invocation provenance record.
 *
 * @returns Record assembled from process state and /proc reads
 */
function buildRecord(): InvocationRecord {
  return {
    timestamp: new Date().toISOString(),
    pid: process.pid,
    ppid: process.ppid,
    exe: readProcLink({
      pid: process.pid,
      name: 'exe',
    },),
    cwd: process.cwd(),
    argv: [...process.argv,],
    envHash: hashEnvironment(process.env,),
    parentChain: walkParentChain({
      pid: process.ppid,
      remaining: PARENT_CHAIN_MAX_DEPTH,
    },),
  };
}

/**
 * Path to the JSONL log file at the package root.
 */
const logPath = join(
  PACKAGE_DIR,
  '_invocation-log.jsonl',
);

try {
  /**
   * Provenance record for this invocation; appended as one JSONL line to {@link logPath}.
   */
  const record = buildRecord();
  appendFileSync(
    logPath,
    `${JSON.stringify(record,)}\n`,
  );
}
catch (error) {
  // Provenance logging is diagnostic-only; never break canary startup over it.
  // The tagged logger from log.ts is not yet initialized at this import point,
  // so console.error is the correct surface here.
  console.error(
    'canary invocation-log write failed:',
    error,
  );
}
