/**
 External dependency failures retain original observations without supplying policy permission.

 @module
 */

//region Dependency lifetime and observation failures remain separately identifiable
/**
 Bootstrap profile cannot override trusted scope or choose unbounded observations.
 */
export class DependencyConfigurationError extends Error {
  /**
   Original bootstrap contract failure category.
   */
  override readonly name = 'DependencyConfigurationError';

  /**
   Preserve the diagnostic for missing or unsupported fixed observation configuration.
   */
  constructor() {
    super('Dependency bootstrap scope, readers, or byte profile is invalid');
  }
}
/**
 Issuing facade cannot retrieve a copied or foreign handle.
 */
export class DependencyHandleOwnershipError extends Error {
  /**
   Foreign handles retain their original dependency ownership category.
   */
  override readonly name = 'DependencyHandleOwnershipError';

  /**
   Name the original facade boundary that rejected handle membership.
   */
  constructor() {
    super('Prepared dependency handle is not owned by this facade');
  }
}
/**
 Original preparation signal remains controlling on every reuse.
 */
export class DependencyCancellationError extends Error {
  /**
   Cancellation remains separate from stale observations and expiry.
   */
  override readonly name = 'DependencyCancellationError';

  /**
   Preserve the original assessment cancellation diagnostic.
   */
  constructor() {
    super('Original dependency assessment was cancelled');
  }
}
/**
 Bootstrap deadline cannot be extended by preparation or cache release.
 */
export class DependencyClockError extends Error {
  /**
   Expiry cannot be mistaken for a renewable observation failure.
   */
  override readonly name = 'DependencyClockError';

  /**
   Preserve the original assessment deadline diagnostic.
   */
  constructor() {
    super('Original dependency assessment deadline expired');
  }
}
/**
 Unknown observer or closure failures cannot count as declared stale evidence.
 */
export class ObservationLifecycleError extends Error {
  /**
   Observation and closure failures remain independently inspectable through the cause.
   */
  override readonly name = 'ObservationLifecycleError';

  /**
   Retain all original observation and closure failures in their occurrence order.

   @param errors - original caught values, copied by the native aggregate constructor
   */
  constructor(errors: readonly unknown[]) {
    super(
      'Declared file observation or descriptor closure failed',
      { cause: new AggregateError(
        errors,
        'Original file observation and closure failures'
      ) }
    );
  }
}
/**
 Fixture scope excludes parent symlinks without claiming arbitrary filesystem confinement.
 */
export class ObservedFileScopeError extends Error {
  /**
   Scope failures retain the original observed-file category.
   */
  override readonly name = 'ObservedFileScopeError';

  /**
   Name the original file whose path is outside the declared observation scope.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Declared observed file is outside its owned fixture scope: ${path}`);
  }
}
/**
 Missing required path is not an empty observation.
 */
export class ObservedFileMissingError extends Error {
  /**
   Missing required files remain distinct from empty observations.
   */
  override readonly name = 'ObservedFileMissingError';

  /**
   Name the original required file that could not be observed.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Required observed file is missing: ${path}`);
  }
}
/**
 Nonregular leaf is rejected before mode or byte inspection.
 */
export class ObservedFileTypeError extends Error {
  /**
   Unsupported leaf types retain the original observation category.
   */
  override readonly name = 'ObservedFileTypeError';

  /**
   Name the original file whose leaf type does not match the observation profile.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Required observed file is not a regular nonsymlink leaf: ${path}`);
  }
}
/**
 Permission mode is selected fixture metadata rather than a universal production rule.
 */
export class ObservedFileModeError extends Error {
  /**
   Mode mismatches retain their original metadata category.
   */
  override readonly name = 'ObservedFileModeError';

  /**
   Name the original file whose mode differs from its declared observation profile.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Required observed file permission mode differs: ${path}`);
  }
}
/**
 Bounds reject rather than truncate required evidence.
 */
export class ObservedFileOversizeError extends Error {
  /**
   Oversized observations remain failures rather than truncated evidence.
   */
  override readonly name = 'ObservedFileOversizeError';

  /**
   Name the original file that exceeds the existing observation byte cap.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Required observed file exceeds the selected byte cap: ${path}`);
  }
}
/**
 Path/descriptor instability cannot be treated as a completed stable observation.
 */
export class ObservedFileUnstableReadError extends Error {
  /**
   Unstable reads retain their original incomplete-observation category.
   */
  override readonly name = 'ObservedFileUnstableReadError';

  /**
   Name the original file whose descriptor observation did not remain stable.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Declared observed file changed or was incompletely read during observation: ${path}`);
  }
}
/**
 Stable recapture differs from the originally retained file dependency.
 */
export class ObservedFileStaleError extends Error {
  /**
   Changed observations retain their original freshness category.
   */
  override readonly name = 'ObservedFileStaleError';

  /**
   Name the original file that no longer matches its captured dependency.

   @param path - original affected file path
   */
  constructor(path: string) {
    super(`Originally observed file identity, mode, or bytes changed: ${path}`);
  }
}
//endregion Dependency lifetime and observation failures remain separately identifiable
