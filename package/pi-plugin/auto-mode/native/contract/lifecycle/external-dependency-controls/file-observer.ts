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
/**
 Permission comparison excludes non-permission inode flags.
 */
const permissionMask=0o777n;
/**
 Original default bound used by policy and declared-dependency consumers.
 */
const defaultMaxBytes=65_536;
/**
 Native bigint values retain filesystem precision without read-induced atime changes.
 
 @param stat - original descriptor or selected-path metadata
 
 @returns fields whose equality qualifies this declared observation
 */
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
/**
 Compare the declared fields without floating-point timestamp conversion.
 
 @param left - original metadata
 
 @param right - subsequent metadata for comparison
 
 @returns whether every declared identity field remains equal
 */
function sameStability({
  left,
  right
}:{
  readonly left:Readonly<BigIntStats>;
  readonly right:Readonly<BigIntStats>
}):boolean {
  /**
   Retained original identity fields.
   */
  const leftValues = stability(left);
  /**
   Subsequent identity fields in the same comparison order.
   */
  const rightValues = stability(right);
  return leftValues.every(function matchesObservedFileIdentity(
    value,
    index
  ) { return ( value === rightValues[index]); });
}
/**
 Only initial ENOENT becomes a missing-path finding; other native I/O failures propagate.
 
 @param path - original selected path
 
 @returns precise original metadata
 
 @throws ObservedFileMissingError when the selected path is absent
 */
function initialStat(path:string):BigIntStats {
  try {
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Original freshness callers consume this result without yielding; see native/file-observation.md.
    return lstatSync(
      path,
      { bigint: true }
    );
  }
  catch (error) {
    if (Error.isError(error)&&('code' in error)
      &&(error.code === 'ENOENT')) throw new ObservedFileMissingError(path);
    throw error;
  }
}
/**
 Scope begins at the independently owned fixture root, not every ancestor on the host.
 
 @param root - independently owned selection root
 
 @param relativePath - declared root-relative filename
 
 @returns selected path after validating its parent directories
 
 @throws ObservedFileScopeError when traversal or redirected parents leave the declared scope
 */
function scopedPath({
  root,
  relativePath
}:Pick<FileObservationInput,'root'|'relativePath'>):string {
  /**
   Parent traversal uses the same original slash-delimited path profile.
   */
  const parts = relativePath.split('/');
  if (isAbsolute(relativePath) || parts.some(function isForbiddenPathSegment(part) {
    return (part === '') || (part === '.')
      || (part === '..');
  })) throw new ObservedFileScopeError(relativePath);
  /**
   One linear walk retains the currently checked parent.
   */
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
    /**
     Inspect each selected parent without following its symbolic link.
     */
    const stat = initialStat(scope.parent);
    if ((!stat.isDirectory()) || stat.isSymbolicLink()) throw new ObservedFileScopeError(relativePath);
  }
  return join(
    root,
    relativePath
  );
}
/**
 Native read remains the default; only owned bootstrap fixtures can supply a controlled wrapper.
 
 @param fd - original open descriptor
 
 @param buffer - owner-allocated bounded destination
 
 @param offset - next destination position
 
 @param length - remaining destination capacity
 
 @param position - next original file position
 
 @returns bytes completed by the original synchronous read
 */
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
/**
 Recheck selected-path identity after the bounded descriptor read.
 
 @param path - original selected absolute path
 
 @param root - independently owned selection root
 
 @param relativePath - original relative filename
 
 @returns selected-path metadata after validating its parent directories again
 
 @throws ObservedFileUnstableReadError when the selected path disappears or changes scope
 */
function selectedAfterRead({
  path,
  root,
  relativePath
}:{
  readonly path:string;
  readonly root:string;
  readonly relativePath:string;
}):BigIntStats{
  try {
    /**
     Preserve the original order: selected path first, parent validation second.
     */
    const selected=initialStat(path);
    scopedPath({
      root,
      relativePath
    });
    return selected;
  }
  catch(error){
    if((error instanceof ObservedFileMissingError)||(error instanceof ObservedFileScopeError))throw new ObservedFileUnstableReadError(relativePath);
    throw error;
  }
}
/**
 Bound bytes, retain descriptor identity, and close even after an expected read failure.
 
 @param root - independently owned selection root
 
 @param relativePath - declared root-relative filename
 
 @param requiredMode - exact expected permission bits
 
 @param maxBytes - maximum admitted file size, or null for complete instruction capture
 
 @param read - original synchronous reader or fixture-owned interception
 
 @returns completed observation after descriptor closure
 
 @throws ObservationLifecycleError when a read count is invalid or descriptor closure fails
 
 @example
 ```ts
 const snapshot = observeDeclaredFile({ root, relativePath: 'policy', requiredMode: 0o600 });
 ```
 */
export function observeDeclaredFile({
  root,
  relativePath,
  requiredMode,
  maxBytes = defaultMaxBytes,
  read = nativeRead
}:FileObservationInput):FileObservation {
  /**
   Original path follows the declared scope checks.
   */
  const path = scopedPath({
    root,
    relativePath
  });
  /**
   Initial metadata bounds allocation and anchors descriptor comparison.
   */
  const initial = initialStat(path);
  if ((!initial.isFile()) || initial.isSymbolicLink()) throw new ObservedFileTypeError(relativePath);
  if (Number(initial.mode & permissionMask) !== requiredMode) throw new ObservedFileModeError(relativePath);
  if ((maxBytes !== null) && (initial.size > BigInt(maxBytes))) throw new ObservedFileOversizeError(relativePath);
  /**
   Only completed resource acquisition and observation publish these fields.
   */
  const observation:{
    fd?:number;
    snapshot?:FileObservation;
    closureFailed:boolean
  }={closureFailed:false};
  /**
   Original caught values retain their occurrence order.
   */
  const failures:unknown[] = [];
  {
    /**
     Closure must finish before the original ordered failure checks.
     */
    using descriptorScope = {
      [Symbol.dispose]():void {
        if (observation.fd === undefined) return;
        try {
          // oxlint-disable-next-line no-restricted-syntax/no-sync -- Descriptor closure and its failures must settle before observation returns; see native/file-observation.md.
          closeSync(observation.fd);
        }
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
    /* oxlint-disable no-restricted-syntax/no-sync -- Check the opened descriptor before reading without inserting a yield; see native/file-observation.md. */
    /**
     Original descriptor identity before reading bytes.
     */
    const before = fstatSync(
      observation.fd,
      { bigint: true }
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    if (!sameStability({
      left: initial,
      right: before
    })) throw new ObservedFileUnstableReadError(relativePath);
    /**
     One extra byte reveals growth beyond the original metadata size.
     */
    const buffer = Buffer.alloc(Number(before.size) + 1);
    /**
     Completed byte count advances without rebuilding the destination.
     */
    let length = 0;
    while (length < buffer.length) {
      /**
       Each native read may complete only part of the remaining capacity.
       */
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
    /* oxlint-disable no-restricted-syntax/no-sync -- Check descriptor identity after the bounded read before publishing bytes; see native/file-observation.md. */
    /**
     Original descriptor metadata after all completed reads.
     */
    const after = fstatSync(
      observation.fd,
      { bigint: true }
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    /**
     Rechecked selected path must still identify the original descriptor.
     */
    const selected=selectedAfterRead({
      path,
      root,
      relativePath
    });
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
/**
 Only stable observations enter retained dependency comparison.
 
 @param initial - original completed observation retained by its owner
 
 @param current - fresh completed observation of the same selected file
 
 @throws ObservedFileStaleError when selected identity or bytes differ
 
 @example
 ```ts
 assertRetainedFile({ initial, current: observeDeclaredFile(input) });
 ```
 */
export function assertRetainedFile({
  initial,
  current
}:{
  readonly initial:FileObservation;
  readonly current:FileObservation
}):void {
  if ((initial.relativePath !== current.relativePath) || (initial.dev !== current.dev)
    || (initial.ino !== current.ino)
    || (initial.mode !== current.mode)
    || (!initial.bytes
      .equals(current.bytes))) throw new ObservedFileStaleError(initial.relativePath);
}
//endregion
