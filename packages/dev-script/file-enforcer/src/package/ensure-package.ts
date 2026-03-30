import {
  l,
  tagged,
} from '../log.ts';
import {
  binaryExists,
  canProvide,
  detectManager,
  installPackage,
} from './manager.ts';
import type {
  PackageEntry,
  PackageManager,
} from './types.ts';

//region Package index

/**
 * Lookup index from binary name to {@link PackageEntry}.
 * Built lazily on first {@link ensurePackage} call via {@link buildIndex}.
 */
let index: ReadonlyMap<string, PackageEntry> | undefined = undefined;

/**
 * Registered package entries awaiting indexing.
 * Populated by consumers who import a data file and pass its entries
 * to {@link registerPackages} before calling {@link ensurePackage}.
 */
const registered: PackageEntry[] = [];

/**
 * Registers package entries for lookup by {@link ensurePackage}.
 * Call this once with the array exported from a data file.
 * Clears any previously built index so the next lookup rebuilds it.
 *
 * @param entries - Package entries produced by {@link p}
 *
 * @example
 * ```ts
 * import { packages } from './data/packages.ts';
 * registerPackages(packages);
 * ```
 */
export function registerPackages(entries: readonly PackageEntry[],): void {
  registered.length = 0;
  registered.push(...entries,);
  index = undefined;
}

/**
 * Builds the binary-name lookup index from registered entries.
 * Called lazily on first {@link ensurePackage} invocation.
 *
 * @returns Map from binary name to package entry
 */
function buildIndex(): ReadonlyMap<string, PackageEntry> {
  const map = new Map<string, PackageEntry>();
  for (const entry of registered) {
    map.set(
      entry.bin,
      entry,
    );
  }
  return map;
}

//endregion Package index

//region Resolve package name

/**
 * Resolves the package name for a given entry and manager.
 * Returns `undefined` when Repology data confirms the package is unavailable
 * (manager not in `available` set), avoiding the expensive live `canProvide` check.
 * Uses the per-manager override if present, otherwise falls back to effname.
 *
 * @param entry - Package entry to resolve
 *
 * @param manager - Detected package manager
 *
 * @returns Package name to pass to the install command, or `undefined` when unavailable
 */
function resolvePackageName(
  entry: PackageEntry,
  manager: PackageManager,
): string | undefined {
  if (entry.available !== null && !entry.available.has(manager,))
    return undefined;
  return entry.overrides[manager] ?? entry.effname;
}

//endregion Resolve package name

//region ensurePackage

/**
 * Ensures a binary is available on the system.
 * Checks PATH first; if absent, installs the corresponding package
 * via the detected OS package manager.
 *
 * **For mise-installable tools** (node, python, jq, etc.), prefer
 * `exec('mise', ['use', '-g', '<tool>'])` instead -- it avoids root,
 * manages versions, and works on immutable distros. Use this function
 * for system-level packages that mise does not cover.
 *
 * Lookup order:
 * 1. Check if the binary exists on PATH -- return immediately if so
 * 2. Look up the binary in the registered package index
 * 3. Detect the system's package manager
 * 4. Resolve the per-manager package name
 * 5. Install the package
 * 6. Verify the binary now exists on PATH
 *
 * @param binary - Name of the binary to ensure (e.g. `'rg'`, `'curl'`)
 *
 * @throws When no package manager is detected
 *
 * @throws When the binary is not in the index and cannot be inferred
 *
 * @throws When the install command fails
 *
 * @throws When the binary is still not on PATH after installation
 *
 * @example
 * ```ts
 * await ensurePackage('curl');
 * await ensurePackage('rg');
 * ```
 */
export async function ensurePackage(binary: string,): Promise<void> {
  index ??= buildIndex();

  const entry = index.get(binary,);
  const effectiveEntry: PackageEntry = entry ?? {
    available: null,
    bin: binary,
    check: '--version',
    effname: binary,
    overrides: Object.freeze({},),
  };

  const alreadyInstalled = await binaryExists(
    binary,
    effectiveEntry.check,
  );
  if (alreadyInstalled)
    return;

  const manager = await detectManager();
  if (!manager)
    throw new NoManagerError(binary,);

  const packageName = resolvePackageName(
    effectiveEntry,
    manager,
  );

  if (packageName === undefined) {
    throw new PackageNotFoundError(
      binary,
      manager,
      effectiveEntry.effname,
    );
  }

  const available = await canProvide(
    manager,
    packageName,
  );
  if (!available) {
    throw new PackageNotFoundError(
      binary,
      manager,
      packageName,
    );
  }

  const rl = tagged({
    tag: ensurePackage.name,
    l,
  },);
  rl.info(`installing ${packageName} via ${manager} (binary: ${binary})`,);
  await installPackage(
    manager,
    packageName,
  );

  const verified = await binaryExists(
    binary,
    effectiveEntry.check,
  );
  if (!verified) {
    throw new VerificationError(
      binary,
      manager,
      packageName,
    );
  }
}

//endregion ensurePackage

//region Errors

/**
 * Thrown when the detected package manager cannot provide the requested package.
 */
class PackageNotFoundError extends Error {
  /**
   * @param binary - Binary that triggered the install attempt
   *
   * @param manager - Detected package manager
   *
   * @param packageName - Package name that was searched for
   */
  constructor(
    binary: string,
    manager: PackageManager,
    packageName: string,
  ) {
    super(
      `Package "${packageName}" not found in ${manager} repository (binary: "${binary}")`,
    );
    this.name = 'PackageNotFoundError';
  }
}

/**
 * Thrown when no package manager is detected on the system.
 */
class NoManagerError extends Error {
  /**
   * @param binary - Binary that triggered the install attempt
   */
  constructor(binary: string,) {
    super(
      `Cannot install "${binary}": no supported package manager detected`,
    );
    this.name = 'NoManagerError';
  }
}

/**
 * Thrown when a package was installed but the binary still cannot be found on PATH.
 */
class VerificationError extends Error {
  /**
   * @param binary - Binary that was expected on PATH
   *
   * @param manager - Package manager used for installation
   *
   * @param packageName - Package name that was installed
   */
  constructor(
    binary: string,
    manager: PackageManager,
    packageName: string,
  ) {
    super(
      `Installed "${packageName}" via ${manager} but "${binary}" is still not on PATH`,
    );
    this.name = 'VerificationError';
  }
}

//endregion Errors
