/**
 * Package-level path constants shared across subsystems.
 *
 * Both the linter artifact system and other subsystems need the package root directory.
 * Centralizing the resolution avoids duplicating `new URL('..', import.meta.url)`.
 */

/**
 * Absolute path to this package's root directory
 */
export const PACKAGE_DIR: string = new URL(
  '..',
  import.meta.url,
)
  .pathname;
