/**
 Synchronous selected-file observations retain descriptor ownership through cleanup.
 @module
 */
import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync
} from 'node:fs';
import {
  isAbsolute,
  join
} from 'node:path';
import {
  ObservationLifecycleError,
  ObservedFileMissingError,
  ObservedFileModeError,
  ObservedFileOversizeError,
  ObservedFileScopeError,
  ObservedFileStaleError,
  ObservedFileTypeError,
  ObservedFileUnstableReadError,
} from './errors.ts';
import type {
  FileObservation,
  FileObservationInput,
  FileReadInput
} from './file-observation-types.ts';

//region Descriptor-bound selected fixture observations.
/** Permission comparison excludes non-permission inode flags. */
const permissionMask=0o777n;
/** Original default bound used by policy and declared-dependency consumers. */
const defaultMaxBytes=65_536;
/** Native bigint values retain filesystem precision without read-induced atime changes. */
function stability(stat:Readonly<BigIntStats>):readonly (bigint|boolean)[] {
  return [
    stat.dev,
    stat.ino,
    stat.isFile(),
    stat.mode & permissionMask,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs
  ];
}
/** Compare the declared fields without floating-point timestamp conversion. */
function sameStability({
  left,
  right
}:{readonly left:Readonly<BigIntStats>;readonly right:Readonly<BigIntStats>}):boolean {
  const leftValues = stability(left);
  const rightValues = stability(right);
  return leftValues.every(function matchesObservedFileIdentity(
    value,
    index
  ) { return ( value === rightValues[index]); });
}
/** Only initial ENOENT becomes a missing-path finding; other native I/O failures propagate. */
function initialStat(path:string):BigIntStats {
  // oxlint-disable-next-line no-restricted-syntax/no-sync -- Original freshness callers consume this result without yielding; see native/file-observation.md.
  try { return lstatSync(
    path,
    { bigint: true }
  ); }
  catch (error) {
    if (Error.isError(error)&&('code' in error)&&(error.code === 'ENOENT')) throw new ObservedFileMissingError(path);
    throw error;
  }
}
/** Scope begins at the independently owned fixture root, not every ancestor on the host. */
function scopedPath({
  root,
  relativePath
}:Pick<FileObservationInput,'root'|'relativePath'>):string {
  const parts = relativePath.split('/');
  if (isAbsolute(relativePath) || parts.some(function isForbiddenPathSegment(part) { return ( (part === '') || (part === '.')
    || (part === '..')); })) throw new ObservedFileScopeError(relativePath);
  const scope = { parent: root };
  for (const part of [
    '',
    ...parts.slice(
      0,
      -1
    )
  ]) {
    scope.parent = join(
      scope.parent,
      part
    );
    const stat = initialStat(scope.parent);
    if ((!stat.isDirectory()) || stat.isSymbolicLink()) throw new ObservedFileScopeError(relativePath);
  }
  return join(
    root,
    relativePath
  );
}
/** Native read remains the default; only owned bootstrap fixtures can supply a controlled wrapper. */
function nativeRead({
  fd,
  buffer,
  offset,
  length,
  position
}:FileReadInput):number {
  // oxlint-disable-next-line no-restricted-syntax/no-sync -- Bounded descriptor reads complete inside the original freshness boundary; see native/file-observation.md.
  return readSync(
    fd,
    buffer,
    offset,
    length,
    position
  );
}
/** Bound bytes, retain descriptor identity, and close even after an expected read failure. */
export function observeDeclaredFile({
  root,
  relativePath,
  requiredMode,
  maxBytes = defaultMaxBytes,
  read = nativeRead
}:FileObservationInput):FileObservation {
  const path = scopedPath({
    root,
    relativePath
  });
  const initial = initialStat(path);
  if ((!initial.isFile()) || initial.isSymbolicLink()) throw new ObservedFileTypeError(relativePath);
  if (Number(initial.mode & permissionMask) !== requiredMode) throw new ObservedFileModeError(relativePath);
  if (initial.size > BigInt(maxBytes)) throw new ObservedFileOversizeError(relativePath);
  /** Only completed resource acquisition and observation publish these fields. */
  const observation:{fd?:number;snapshot?:FileObservation;closureFailed:boolean}={closureFailed:false};
  /** Original caught values retain their occurrence order. */
  const failures:unknown[] = [];
  {
    using descriptorScope = {
      [Symbol.dispose]():void {
        if (observation.fd === undefined) return;
        // oxlint-disable-next-line no-restricted-syntax/no-sync -- Descriptor closure and its failures must settle before observation returns; see native/file-observation.md.
        try { closeSync(observation.fd); }
        catch (error) {
          observation.closureFailed = true;
          failures.push(error);
        }
      }
    };
  try {
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Open belongs to the uninterrupted original selection and freshness operation; see native/file-observation.md.
    observation.fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Check the opened descriptor before reading without inserting a yield; see native/file-observation.md.
    const before = fstatSync(
      observation.fd,
      { bigint: true }
    );
    if (!sameStability({
      left: initial,
      right: before
    })) throw new ObservedFileUnstableReadError(relativePath);
    const buffer = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = read({
        fd:observation.fd,
        buffer,
        offset: length,
        length: buffer.length - length,
        position: length
      });
      if ((!Number.isInteger(count)) || (count < 0)
        || (count > (buffer.length
          - length))) throw new ObservationLifecycleError([new Error('Controlled native read returned an invalid byte count')]);
      if (count === 0) break;
      length += count;
    }
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Check descriptor identity after the bounded read before publishing bytes; see native/file-observation.md.
    const after = fstatSync(
      observation.fd,
      { bigint: true }
    );
    let selected:BigIntStats;
    try {
      selected = initialStat(path);
      scopedPath({
        root,
        relativePath
      });
    } catch (error) {
      if ((error instanceof ObservedFileMissingError) || (error instanceof ObservedFileScopeError)) throw new ObservedFileUnstableReadError(relativePath);
      throw error;
    }
    if ((!sameStability({
      left: before,
      right: after
    })) || (!sameStability({
      left: after,
      right: selected
    }))
      || (BigInt(length) !== after.size)) throw new ObservedFileUnstableReadError(relativePath);
    observation.snapshot = Object.freeze({
      relativePath,
      dev: after.dev,
      ino: after.ino,
      mode: Number(after.mode & permissionMask),
      bytes: Buffer.from(buffer.subarray(
        0,
        length
      ))
    });
  } catch (error) {
    failures.push(error);
  }
  }
  if (observation.closureFailed) throw new ObservationLifecycleError(failures);
  if (failures.length > 0) throw failures[0];
  if (observation.snapshot === undefined) throw new ObservationLifecycleError([new Error('Native observation returned no owned snapshot')]);
  return observation.snapshot;
}
/** Only stable observations enter retained dependency comparison. */
export function assertRetainedFile({
  initial,
  current
}:{readonly initial:FileObservation;readonly current:FileObservation}):void {
  if ((initial.relativePath !== current.relativePath) || (initial.dev !== current.dev)
    || (initial.ino !== current.ino)
    || (initial.mode !== current.mode)
    || (!initial.bytes
      .equals(current.bytes))) throw new ObservedFileStaleError(initial.relativePath);
}
//endregion
