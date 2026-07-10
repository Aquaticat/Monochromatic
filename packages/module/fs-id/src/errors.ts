/**
 * Filesystem identity resolution errors.
 *
 * @module
 */

/**
 * Error raised when supported-platform identity mechanisms all fail.
 *
 * @example
 * ```ts
 * throw new FsIdResolutionError('unable to resolve identity');
 * ```
 */
export class FsIdResolutionError extends Error {
  /**
   * Creates a filesystem identity resolution error.
   *
   * @param message - Why no usable identity could be produced
   *
   * @param options - Optional underlying failure
   *
   * @example
   * ```ts
   * new FsIdResolutionError('failed', { cause: new Error('command'), });
   * ```
   */
  public constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options,);
    this.name = FsIdResolutionError.name;
  }
}

/**
 * Error raised when host platform has no filesystem identity strategy.
 *
 * @example
 * ```ts
 * throw new UnsupportedFsIdPlatformError('freebsd');
 * ```
 */
export class UnsupportedFsIdPlatformError extends Error {
  /**
   * Creates an unsupported-platform error.
   *
   * @param platform - Unsupported Node platform identifier
   *
   * @example
   * ```ts
   * new UnsupportedFsIdPlatformError('aix');
   * ```
   */
  public constructor(platform: string,) {
    super(`unsupported platform for filesystem ID resolution: ${platform}`,);
    this.name = UnsupportedFsIdPlatformError.name;
  }
}
