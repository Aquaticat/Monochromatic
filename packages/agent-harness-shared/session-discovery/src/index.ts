/**
 * Shared session discovery helpers for agent harness spawners.
 *
 * @module
 */

export {
  readByPidDir,
  readPidMapping,
} from './mapping.ts';
export {
  findByMostRecent,
  readMappingCandidate,
} from './newest.ts';
export { walkProcessTreeFrom, } from './process-tree.ts';
export { readParentPid, } from './procfs.ts';
export { SESSION_NOT_FOUND, } from './sentinels.ts';
export { findCallingSession, } from './session-discovery.ts';
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
} from './types.ts';
