import { exec, } from '../pipeline/exec.ts';
import { evaluatePredicate, } from '../platform/evaluate-predicate.ts';
import { MANAGERS, } from './manager-defs.ts';
import type { PackageManager, } from './types.ts';

//region Template utilities

/** Placeholder token in command templates, replaced with the resolved package name */
const PKG_PLACEHOLDER = '{pkg}';

/**
 * Substitutes the `{pkg}` placeholder in a command template with the actual package name.
 *
 * @param template - Command template array containing `{pkg}` tokens
 *
 * @param packageName - Resolved package name to substitute
 *
 * @returns Command array with placeholders replaced
 */
function fillTemplate(
  {
    template,
    packageName,
  }: {
    readonly template: readonly string[];
    readonly packageName: string;
  },
): readonly string[] {
  return template.map(function replacePlaceholder(segment,): string {
    return segment === PKG_PLACEHOLDER ? packageName : segment;
  },);
}

//endregion Template utilities

//region Manager detection

/**
 * Single-key holder for the lazily-detected package manager.
 * `null` value means detection ran but no manager was found; missing key means
 * detection has not run yet. Using a {@link Map} container side-steps a
 * module-root `let` binding while keeping the same lazy-cache semantics.
 */
const managerCache = new Map<'manager', PackageManager | null>();

/**
 * Detects the highest-priority available package manager on the current system.
 * All candidates are probed concurrently; the winner is the first by {@link MANAGERS} insertion order.
 * Result is cached for the lifetime of the process.
 *
 * @returns Detected manager name, or `null` if none found
 *
 * @example
 * ```ts
 * const mgr = await detectManager();
 * // 'brew' when installed, otherwise 'apt' on Debian/Ubuntu, 'dnf' on Fedora, etc.
 * ```
 */
export async function detectManager(): Promise<PackageManager | null> {
  if (managerCache.has('manager',))
    return managerCache.get('manager',)
      ?? null;
  /** Snapshot of registered manager entries; iteration order defines detection priority. */
  const entries = [...MANAGERS.entries(),];
  /** Per-manager probe results: the manager name when its check succeeds, otherwise `null`. */
  const results = await Promise.all(
    entries.map(
      async function checkManager([name, def,],): Promise<PackageManager | null> {
        /** Whether this manager's existence check exits successfully on the current system. */
        const available = await evaluatePredicate(def.check,);
        return available ? name : null;
      },
    ),
  );
  /** First non-null entry in priority order, or `undefined` when nothing matched. */
  const detected = results.find(function isPresent(name,): name is PackageManager {
    return name !== null;
  },);
  /** Resolved value stored in the cache and returned to the caller. */
  const resolved = detected ?? null;
  managerCache.set(
    'manager',
    resolved,
  );
  return resolved;
}

/**
 * Resets the cached manager detection.
 * Primarily useful for testing.
 *
 * @example
 * ```ts
 * resetManagerCache();
 * ```
 */
export function resetManagerCache(): void {
  managerCache.delete('manager',);
}

//endregion Manager detection

//region Binary existence check

/**
 * Checks whether a binary is available on PATH by running it with a check flag.
 * Most CLI tools exit 0 for `--version`; outliers may need `-V`, `--help`,
 * or a subcommand like `version`. If the binary does not exist,
 * the spawn fails with ENOENT.
 *
 * @param binary - Name of the binary to locate
 *
 * @param checkFlag - Flag to pass for existence check (default: `--version`)
 *
 * @returns `true` if the binary can be executed with the given flag
 *
 * @example
 * ```ts
 * await binaryExists({ binary: 'rg' });                            // uses --version
 * await binaryExists({ binary: 'openssl', checkFlag: 'version' }); // openssl uses bare subcommand
 * await binaryExists({ binary: 'convert', checkFlag: '-version' }); // imagemagick uses single dash
 * ```
 */
export async function binaryExists(
  {
    binary,
    checkFlag = '--version',
  }: {
    readonly binary: string;
    readonly checkFlag?: string;
  },
): Promise<boolean> {
  return await evaluatePredicate([
    binary,
    checkFlag,
  ],);
}

//endregion Binary existence check

//region Privilege detection

/**
 * Single-key holder for the lazily-detected root status.
 * Missing key means detection has not run yet.
 */
const rootCache = new Map<'isRoot', boolean>();

/**
 * Detects whether the current process is running as root (UID 0).
 * Returns `false` on platforms where `process.getuid` is unavailable (Windows).
 * Result is cached for the lifetime of the process.
 *
 * @returns `true` if running as root
 *
 * @example
 * ```ts
 * if (isRoot()) {
 *   // skip sudo prefix
 * }
 * ```
 */
export function isRoot(): boolean {
  /** Cached detection, or `undefined` when detection has not run yet. */
  const cached = rootCache.get('isRoot',);
  if (cached !== undefined)
    return cached;
  /** Fresh detection result; stored before return so subsequent calls short-circuit. */
  const detected = process.getuid?.()
    === 0;
  rootCache.set(
    'isRoot',
    detected,
  );
  return detected;
}

/**
 * Resets the cached root detection.
 * Primarily useful for testing.
 *
 * @example
 * ```ts
 * resetRootCache();
 * ```
 */
export function resetRootCache(): void {
  rootCache.delete('isRoot',);
}

//endregion Privilege detection

//region Package availability check

/**
 * Checks whether a package exists in the detected manager's repository.
 * Does not require root; search commands run unprivileged.
 *
 * @param manager - Package manager to query
 *
 * @param packageName - Package name to look up
 *
 * @returns `true` if the package is available for installation
 *
 * @example
 * ```ts
 * await canProvide({ manager: 'apt', packageName: 'ripgrep' }) // true on Ubuntu
 * await canProvide({ manager: 'apt', packageName: 'nonexistent-pkg' }) // false
 * ```
 */
export async function canProvide(
  {
    manager,
    packageName,
  }: {
    readonly manager: PackageManager;
    readonly packageName: string;
  },
): Promise<boolean> {
  /** Manager definition; absent entry means `manager` is unrecognised. */
  const def = MANAGERS.get(manager,);
  if (!def)
    return false;
  /** Search command with `{pkg}` substituted to the resolved package name. */
  const cmd = fillTemplate({
    template: def.search,
    packageName,
  },);
  return await evaluatePredicate(cmd,);
}

//endregion Package availability check

//region Install command

/**
 * Builds and executes the install command for a package on the detected manager.
 * Prepends `sudo` when the manager needs root and the process is not already root.
 *
 * @param manager - Package manager to use
 *
 * @param packageName - Resolved package name for this manager
 *
 * @returns Stdout from the install command
 *
 * @throws When the install command exits with non-zero
 *
 * @example
 * ```ts
 * await installPackage({ manager: 'apt', packageName: 'ripgrep' })
 * // Runs: sudo apt-get install --yes ripgrep
 * ```
 */
export async function installPackage(
  {
    manager,
    packageName,
  }: {
    readonly manager: PackageManager;
    readonly packageName: string;
  },
): Promise<string> {
  /** Manager definition; missing entry indicates a programmer bug, so we throw. */
  const def = MANAGERS.get(manager,);
  if (!def)
    throw new Error(`Unknown package manager: ${manager}`,);
  /** Install command with `{pkg}` substituted to the resolved package name. */
  const cmd = fillTemplate({
    template: def.install,
    packageName,
  },);
  /** True when the manager needs root and the process is not already running as root. */
  const needsSudo = def.needsRoot
    && (!isRoot());
  /**
   * Final argv with `sudo` prepended only when {@link needsSudo} flagged it.
   */
  const fullCmd = needsSudo
    ? [
      'sudo',
      ...cmd,
    ]
    : cmd;
  /** Head/tail split of `fullCmd` so `exec` receives executable and args separately. */
  const [executable = '', ...args] = fullCmd;
  return await exec({
    cmd: executable,
    args,
  },);
}

//endregion Install command
