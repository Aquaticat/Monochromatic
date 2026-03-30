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
  template: readonly string[],
  packageName: string,
): readonly string[] {
  return template.map(function replacePlaceholder(segment,): string {
    return segment === PKG_PLACEHOLDER ? packageName : segment;
  },);
}

//endregion Template utilities

//region Manager detection

/**
 * Cached detection result. `undefined` means detection has not run yet.
 * `null` means detection ran but no manager was found.
 */
let cachedManager: PackageManager | null | undefined = undefined;

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
  if (cachedManager !== undefined)
    return cachedManager;
  const entries = [...MANAGERS.entries(),];
  const results = await Promise.all(
    entries.map(
      async function checkManager([name, def,],): Promise<PackageManager | null> {
        const available = await evaluatePredicate(def.check,);
        return available ? name : null;
      },
    ),
  );
  const detected = results.find(function isPresent(name,): name is PackageManager {
    return name !== null;
  },);
  cachedManager = detected ?? null;
  return cachedManager;
}

/**
 * Resets the cached manager detection.
 * Primarily useful for testing.
 */
export function resetManagerCache(): void {
  cachedManager = undefined;
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
 * await binaryExists('rg')                 // uses --version
 * await binaryExists('openssl', 'version') // openssl uses bare subcommand
 * await binaryExists('convert', '-version') // imagemagick uses single dash
 * ```
 */
export async function binaryExists(
  binary: string,
  checkFlag: string = '--version',
): Promise<boolean> {
  return await evaluatePredicate([
    binary,
    checkFlag,
  ],);
}

//endregion Binary existence check

//region Privilege detection

/**
 * Cached root detection result. `undefined` means detection has not run yet.
 */
let cachedIsRoot: boolean | undefined = undefined;

/**
 * Detects whether the current process is running as root (UID 0).
 * Returns `false` on platforms where `process.getuid` is unavailable (Windows).
 * Result is cached for the lifetime of the process.
 *
 * @returns `true` if running as root
 */
export function isRoot(): boolean {
  if (cachedIsRoot !== undefined)
    return cachedIsRoot;
  cachedIsRoot = process.getuid?.() === 0;
  return cachedIsRoot;
}

/**
 * Resets the cached root detection.
 * Primarily useful for testing.
 */
export function resetRootCache(): void {
  cachedIsRoot = undefined;
}

//endregion Privilege detection

//region Package availability check

/**
 * Checks whether a package exists in the detected manager's repository.
 * Does not require root -- search commands run unprivileged.
 *
 * @param manager - Package manager to query
 *
 * @param packageName - Package name to look up
 *
 * @returns `true` if the package is available for installation
 *
 * @example
 * ```ts
 * await canProvide('apt', 'ripgrep') // true on Ubuntu
 * await canProvide('apt', 'nonexistent-pkg') // false
 * ```
 */
export async function canProvide(
  manager: PackageManager,
  packageName: string,
): Promise<boolean> {
  const def = MANAGERS.get(manager,);
  if (!def)
    return false;
  const cmd = fillTemplate(
    def.search,
    packageName,
  );
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
 * await installPackage('apt', 'ripgrep')
 * // Runs: sudo apt-get install --yes ripgrep
 * ```
 */
export async function installPackage(
  manager: PackageManager,
  packageName: string,
): Promise<string> {
  const def = MANAGERS.get(manager,);
  if (!def)
    throw new Error(`Unknown package manager: ${manager}`,);
  const cmd = fillTemplate(
    def.install,
    packageName,
  );
  const needsSudo = def.needsRoot && !isRoot();
  const fullCmd = needsSudo
    ? [
      'sudo',
      ...cmd,
    ]
    : cmd;
  const [executable = '', ...args] = fullCmd;
  return await exec(
    executable,
    args,
  );
}

//endregion Install command
