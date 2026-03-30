import type {
  PackageEntry,
  PackageManager,
  PackageSpec,
} from './types.ts';

/** Default flag used for binary existence checks when no custom check is specified. */
const DEFAULT_CHECK = '--version';

/**
 * Known {@link PackageManager} values used to separate overrides from
 * structural fields (`bin`, `check`, `effname`) when destructuring a {@link PackageSpec}.
 */
const MANAGER_KEYS: ReadonlySet<string> = new Set<PackageManager>([
  'apk',
  'apt',
  'brew',
  'choco',
  'dnf',
  'pacman',
  'scoop',
  'winget',
  'zypper',
],);

//region p() builder

/**
 * Builds a {@link PackageEntry} from a shorthand string.
 * Binary name, effname, and all per-manager package names are the same value.
 *
 * @param shorthand - Name used as `bin`, `effname`, and default package name
 *
 * @returns Immutable package entry
 *
 * @example
 * ```ts
 * p('curl')
 * // { bin: 'curl', effname: 'curl', overrides: {} }
 * ```
 */
export function p(shorthand: string): PackageEntry;

/**
 * Builds a {@link PackageEntry} from a detailed spec.
 * `bin` defaults to `effname` when omitted.
 * Any {@link PackageManager} keys present become per-manager overrides.
 *
 * @param spec - Object with `effname`, optional `bin`, and optional manager overrides
 *
 * @returns Immutable package entry
 *
 * @example
 * ```ts
 * p({ bin: 'rg', effname: 'ripgrep' })
 * p({ effname: 'wget', winget: 'JernejSimoncic.Wget' })
 * ```
 */
export function p(spec: PackageSpec): PackageEntry;

export function p(shorthandOrSpec: string | PackageSpec,): PackageEntry {
  if (typeof shorthandOrSpec === 'string') {
    return buildFromShorthand(shorthandOrSpec,);
  }
  return buildFromSpec(shorthandOrSpec,);
}

//endregion p() builder

//region Internal builders

/**
 * Creates a {@link PackageEntry} where all names are identical.
 *
 * @param name - Shared value for `bin`, `effname`, and all managers
 *
 * @returns Immutable package entry with empty overrides
 */
function buildFromShorthand(name: string,): PackageEntry {
  return {
    bin: name,
    check: DEFAULT_CHECK,
    effname: name,
    overrides: Object.freeze({},),
  };
}

/**
 * Creates a {@link PackageEntry} from a structured spec,
 * extracting manager overrides from the remaining keys.
 *
 * @param spec - Full package specification
 *
 * @returns Immutable package entry
 */
function buildFromSpec(spec: PackageSpec,): PackageEntry {
  const { bin, check, effname, ...rest } = spec;
  const overrides: Record<string, string> = {};
  for (const [key, value,] of Object.entries(rest,)) {
    if (MANAGER_KEYS.has(key,) && value !== undefined) {
      overrides[key] = value;
    }
  }
  return {
    bin: bin ?? effname,
    check: check ?? DEFAULT_CHECK,
    effname,
    overrides: Object.freeze(overrides,),
  };
}

//endregion Internal builders
