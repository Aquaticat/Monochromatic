//region Package manager identifiers

/**
 * Supported OS-level package managers.
 * Each corresponds to a detection predicate, is-installed check, and install command.
 */
export type PackageManager =
  | 'apk'
  | 'apt'
  | 'brew'
  | 'choco'
  | 'dnf'
  | 'pacman'
  | 'scoop'
  | 'winget'
  | 'zypper';

//endregion Package manager identifiers

//region Package entry

/**
 * Per-manager package name overrides.
 * Only managers whose package name differs from the effname need an entry.
 */
export type PackageMapping = Partial<Record<PackageManager, string>>;

/**
 * Object form accepted by {@link p} when the binary name or effname
 * differs from the default, or when per-manager overrides are needed.
 *
 * - `bin` -- binary name to check on PATH (defaults to `effname`)
 * - `check` -- custom flag for existence check (defaults to `--version`);
 *   some binaries use `-V`, `-v`, `--help`, or `version` instead
 * - `effname` -- Repology canonical project name (used as fallback package name)
 * - Remaining keys are {@link PackageManager} overrides
 *
 * @example
 * ```ts
 * { bin: 'rg', effname: 'ripgrep' }
 * { effname: 'wget', winget: 'JernejSimoncic.Wget' }
 * { bin: 'magick', effname: 'imagemagick', dnf: 'ImageMagick' }
 * { bin: 'openssl', check: 'version', effname: 'openssl' }
 * ```
 */
export type PackageSpec = {
  readonly bin?: string;
  readonly check?: string;
  readonly effname: string;
} & PackageMapping;

/**
 * Normalized package entry produced by {@link p}.
 * Immutable value object -- safe to store in arrays and indexes.
 */
export type PackageEntry = {
  /** Binary name to check on PATH. */
  readonly bin: string;
  /** Flag passed to the binary for existence check (default: `--version`). */
  readonly check: string;
  /** Repology canonical project name; fallback package name when no override exists. */
  readonly effname: string;
  /** Per-manager package name overrides (only entries that differ from effname). */
  readonly overrides: Readonly<PackageMapping>;
};

//endregion Package entry
