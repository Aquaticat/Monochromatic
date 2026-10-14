//region Named failures keep mechanical evidence separate from permission.
/** Bootstrap profile cannot override trusted scope or choose unbounded observations. */
export class DependencyConfigurationError extends Error {
  constructor() { super('Dependency bootstrap scope, readers, or byte profile is invalid');
  this.name = 'DependencyConfigurationError'; }
}
/** Issuing facade cannot retrieve a copied or foreign handle. */
export class DependencyHandleOwnershipError extends Error {
  constructor() { super('Prepared dependency handle is not owned by this facade');
  this.name = 'DependencyHandleOwnershipError'; }
}
/** Original preparation signal remains controlling on every reuse. */
export class DependencyCancellationError extends Error {
  constructor() { super('Original dependency assessment was cancelled');
  this.name = 'DependencyCancellationError'; }
}
/** Bootstrap deadline cannot be extended by preparation or cache release. */
export class DependencyDeadlineError extends Error {
  constructor() { super('Original dependency assessment deadline expired');
  this.name = 'DependencyDeadlineError'; }
}
/** Unknown observer or closure failures cannot count as declared stale evidence. */
export class ObservationLifecycleError extends Error {
  constructor(errors) { super(
    'Declared file observation or descriptor closure failed',
    { cause: new AggregateError(errors) }
  );
  this.name = 'ObservationLifecycleError'; }
}
/** Fixture scope excludes parent symlinks without claiming arbitrary filesystem confinement. */
export class ObservedFileScopeError extends Error {
  constructor(path) { super(`Declared observed file is outside its owned fixture scope: ${  path}`);
  this.name = 'ObservedFileScopeError'; }
}
/** Missing required path is not an empty observation. */
export class ObservedFileMissingError extends Error {
  constructor(path) { super(`Required observed file is missing: ${  path}`);
  this.name = 'ObservedFileMissingError'; }
}
/** Nonregular leaf is rejected before mode or byte inspection. */
export class ObservedFileTypeError extends Error {
  constructor(path) { super(`Required observed file is not a regular nonsymlink leaf: ${  path}`);
  this.name = 'ObservedFileTypeError'; }
}
/** Permission mode is selected fixture metadata rather than a universal production rule. */
export class ObservedFileModeError extends Error {
  constructor(path) { super(`Required observed file permission mode differs: ${  path}`);
  this.name = 'ObservedFileModeError'; }
}
/** Bounds reject rather than truncate required evidence. */
export class ObservedFileOversizeError extends Error {
  constructor(path) { super(`Required observed file exceeds the selected byte cap: ${  path}`);
  this.name = 'ObservedFileOversizeError'; }
}
/** Path/descriptor instability cannot be treated as a completed stable observation. */
export class ObservedFileUnstableReadError extends Error {
  constructor(path) { super(`Declared observed file changed or was incompletely read during observation: ${  path}`);
  this.name = 'ObservedFileUnstableReadError'; }
}
/** Stable recapture differs from the originally retained file dependency. */
export class ObservedFileStaleError extends Error {
  constructor(path) { super(`Originally observed file identity, mode, or bytes changed: ${  path}`);
  this.name = 'ObservedFileStaleError'; }
}
//endregion
