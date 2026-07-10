/**
 * Cross-platform stable and degraded filesystem identity resolution.
 *
 * @module
 */

export {
  FsIdResolutionError,
  UnsupportedFsIdPlatformError,
} from './errors.ts';
export {
  assertFsId,
  createFsId,
  isFsId,
  normalizeIdentityPayload,
  parseDiskutilVolumeUuid,
  parseFindmntUuid,
  parseVolumeSerial,
} from './parsers.ts';
export {
  resolveDarwinFsId,
  resolveLinuxFsId,
  resolveWindowsFsId,
  windowsDriveRoot,
} from './platform-resolvers.ts';
export {
  createFsIdResolver,
  resolveFsId,
} from './resolve-fs-id.ts';
export type {
  FsId,
  FsIdCommand,
  FsIdResolution,
  FsIdResolver,
  FsIdResolverAdapters,
  FsIdSource,
  SupportedFsIdPlatform,
} from './types.ts';
