/**
 * Session discovery shared types.
 *
 * @module
 */

import type { SESSION_NOT_FOUND, } from './sentinels.ts';

/**
 * Minimal stat shape needed for newest-candidate ordering.
 */
type SessionDiscoveryFileStat = {
  /**
   * File modification time in milliseconds.
   */
  readonly mtimeMs: number;
};

/**
 * Optional IO seam used by tests to avoid real procfs and coordination files.
 */
type SessionDiscoveryIo = {
  /**
   * Optional direct parent-PID reader, used instead of parsing procfs status.
   */
  readonly readParentPid?: (pid: number,) => Promise<number | typeof SESSION_NOT_FOUND>;
  /**
   * Optional directory reader.
   */
  readonly readDir?: (path: string,) => Promise<readonly string[]>;
  /**
   * Optional UTF-8 file reader.
   */
  readonly readFile?: (path: string,) => Promise<string>;
  /**
   * Optional file stat reader.
   */
  readonly statFile?: (path: string,) => Promise<SessionDiscoveryFileStat>;
};

/**
 * Host-owned parser for PID mapping file contents.
 */
type ParsePidMapping<TMapping> = (raw: string,) => TMapping;

/**
 * Options shared by session-discovery operations that read mapping files.
 */
type SessionDiscoveryMappingOptions<TMapping> = {
  /**
   * Directory containing PID mapping files.
   */
  readonly byPidDir: string;
  /**
   * Optional test IO seam.
   */
  readonly io?: SessionDiscoveryIo;
  /**
   * Host-owned parser for mapping JSON or another host-owned format.
   */
  readonly parseMapping: ParsePidMapping<TMapping>;
};

/**
 * Options for one direct PID mapping lookup.
 */
type ReadPidMappingOptions<TMapping> = SessionDiscoveryMappingOptions<TMapping> & {
  /**
   * Process identifier to map.
   */
  readonly pid: number;
};

/**
 * Options for process-tree ancestry walks.
 */
type WalkProcessTreeOptions<TMapping> = SessionDiscoveryMappingOptions<TMapping> & {
  /**
   * Process identifier where ancestry walk starts.
   */
  readonly pid: number;
};

/**
 * Options for newest mapping fallback scans.
 */
type FindByMostRecentOptions<TMapping> = SessionDiscoveryMappingOptions<TMapping>;

/**
 * Options for full calling-session discovery.
 */
type FindCallingSessionOptions<TMapping> = SessionDiscoveryMappingOptions<TMapping> & {
  /**
   * Process identifier where discovery starts, usually `process.ppid`.
   */
  readonly startPid: number;
};

/**
 * Parsed mapping paired with file modification time for recency ordering.
 */
type MappingCandidate<TMapping> = {
  /**
   * Parsed mapping from PID file contents.
   */
  readonly mapping: TMapping;
  /**
   * PID mapping file modification time in milliseconds.
   */
  readonly mtime: number;
};

export type {
  FindByMostRecentOptions,
  FindCallingSessionOptions,
  MappingCandidate,
  ParsePidMapping,
  ReadPidMappingOptions,
  SessionDiscoveryFileStat,
  SessionDiscoveryIo,
  SessionDiscoveryMappingOptions,
  WalkProcessTreeOptions,
};
