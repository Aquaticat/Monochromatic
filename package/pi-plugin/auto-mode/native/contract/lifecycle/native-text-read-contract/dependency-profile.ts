/**
 Original declared dependency profiles preserve validation order and selected reader identity. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { DependencyConfigurationError } from '../external-dependency-controls/errors.ts';
import type { FileObservationInput } from '../external-dependency-controls/file-observation-types.ts';
import type { DependencyFileProfile } from './dependency-types.ts';

/**
 File profile diagnostics omit original paths and observer values.
 */
const l = tagged({ tag: 'auto-mode-dependency-profile' });
/**
 Original observer allocation and byte validation share this upper bound.
 */
const maximumBytes = 65_536;
/**
 Only ordinary permission bits belong to the original declared mode.
 */
const maximumMode = 0o777;

//region Original declaration validation precedes every dependency observation.
/**
 Retain declared paths, bounds, and optional native reader without observing any file.

 @param files - original declared files after collection validation

 @returns frozen original profile preserving declaration order

 @throws DependencyConfigurationError when any declared file has an invalid bound or reader

 @example createDependencyProfile(files);
 */
export function createDependencyProfile(files: readonly Omit<FileObservationInput, 'root'>[]): readonly DependencyFileProfile[] {
  /**
   Profile logging precedes validation without reading original declaration fields.
   */
  const rl = tagged({
    tag: createDependencyProfile.name,
    l
  });
  rl.debug('validating original dependency file profile');
  return Object.freeze(files.map(function validateDeclaredFileInput(file) {
    /**
     Original omitted byte bound uses the same value as the native observer.
     */
    const maxBytes = file.maxBytes ?? maximumBytes;
    if (((typeof file.relativePath) !== 'string') || (!Number.isInteger(file.requiredMode))
      || (file.requiredMode < 0)
      || (file.requiredMode > maximumMode)
      || (!Number.isInteger(maxBytes))
      || (maxBytes < 1)
      || (maxBytes > maximumBytes)
      || ((file.read !== undefined) && ((typeof file.read) !== 'function'))) throw new DependencyConfigurationError();
    return Object.freeze({
      relativePath: file.relativePath,
      requiredMode: file.requiredMode,
      maxBytes,
      read: file.read
    });
  }));
}
//endregion
