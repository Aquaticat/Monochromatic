/**
 Original file projections retain prepared bytes without reading caller-supplied projections. @module
 */
import { join } from 'node:path';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { requireDependencyRecord } from './dependency-record.ts';
import type {
  DependencyFacade,
  DependencyFileProfile,
  DependencyRecord,
  DependencySources,
  DependencyVerification
} from './dependency-types.ts';

/**
 Inert file diagnostics omit selected paths and original bytes.
 */
const l = tagged({ tag: 'auto-mode-dependency-original-file' });

//region Original file reads require issuing ownership and live original cancellation and deadline.
/**
 Bind original file inspection to the original owner map and declared profile.

 @param handles - original dependency record owner

 @param checkpoint - original live cancellation and deadline check

 @param profile - validated original declarations in observation order

 @param rootDirectory - original selected filesystem root

 @returns original file reader without exporting mutable owner records

 @example createOriginalFileReader({ handles, checkpoint, profile, rootDirectory });
 */
export function createOriginalFileReader({
  handles,
  checkpoint,
  profile,
  rootDirectory
}: Readonly<{
  handles: Pick<WeakMap<object, Pick<DependencyRecord<DependencySources, object>, 'signal' | 'observed'>>, 'get'>;
  checkpoint: DependencyVerification;
  profile: readonly DependencyFileProfile[];
  rootDirectory: string;
}>): DependencyFacade['originalFile'] {
  /**
   Reader diagnostics do not inspect original handles or file declarations.
   */
  const rl = tagged({
    tag: createOriginalFileReader.name,
    l
  });
  rl.debug('binding original dependency file reader');
  return function originalFile({
    handle,
    absolutePath
  }) {
    /**
     Exact original handle ownership precedes clock and path observations.
     */
    const prepared = requireDependencyRecord({
      handles,
      handle
    });
    checkpoint(prepared.signal);
    /**
     Native path joining preserves the original declared selection comparison.
     */
    const index = profile.findIndex(function matchesDeclaredAbsolutePath(file) {
      return join(
        rootDirectory,
        file.relativePath
      ) === absolutePath;
    });
    if (index === (-1)) return Object.freeze({ kind: 'undeclared-file' });
    /**
     A matching declaration retains its original prepared observation ordinal.
     */
    const file = nonNullishOrThrow(profile[index]);
    /**
     Completed original observation supplies identity and owned bytes.
     */
    const observation = nonNullishOrThrow(prepared.observed[index]);
    if (file.read !== undefined) return Object.freeze({ kind: 'controlled-file-observer' });
    return Object.freeze({
      kind: 'original-file',
      absolutePath,
      relativePath: file.relativePath,
      dev: String(observation.dev),
      ino: String(observation.ino),
      mode: observation.mode,
      bytesBase64: observation.bytes
        .toString('base64'),
    });
  };
}
//endregion
