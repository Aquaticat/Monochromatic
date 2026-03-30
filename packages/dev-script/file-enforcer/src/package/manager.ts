import { evaluatePredicate, } from '../platform/evaluate-predicate.ts';
import { exec, } from '../pipeline/exec.ts';
import type { PackageManager, } from './types.ts';

//region Manager definitions

/**
 * Per-manager command templates.
 * `{pkg}` is replaced with the resolved package name at call time.
 *
 * - `check` -- predicate to detect whether this manager is available
 * - `search` -- command to verify a package exists in the repo (exit 0 = available)
 * - `install` -- command template for installing a package
 * - `needsRoot` -- whether install requires privilege escalation
 */
type ManagerDef = {
  readonly check: readonly string[];
  readonly search: readonly string[];
  readonly install: readonly string[];
  readonly needsRoot: boolean;
};

/**
 * Ordered manager definitions.
 * Detection runs top-to-bottom; first match wins.
 * More specific managers (distro-level) come before broader ones (brew).
 */
const MANAGERS: ReadonlyMap<PackageManager, ManagerDef> = new Map<PackageManager, ManagerDef>([
  ['apt', {
    check: ['apt-get', '--version',],
    search: ['apt-cache', 'show', '{pkg}',],
    install: ['apt-get', 'install', '--yes', '{pkg}',],
    needsRoot: true,
  },],
  ['dnf', {
    check: ['dnf', '--version',],
    search: ['dnf', 'info', '{pkg}',],
    install: ['dnf', 'install', '--assumeyes', '{pkg}',],
    needsRoot: true,
  },],
  ['pacman', {
    check: ['pacman', '--version',],
    search: ['pacman', '-Si', '{pkg}',],
    install: ['pacman', '-S', '--noconfirm', '{pkg}',],
    needsRoot: true,
  },],
  ['apk', {
    check: ['apk', '--version',],
    search: ['apk', 'info', '--description', '{pkg}',],
    install: ['apk', 'add', '{pkg}',],
    needsRoot: true,
  },],
  ['zypper', {
    check: ['zypper', '--version',],
    search: ['zypper', 'info', '{pkg}',],
    install: ['zypper', 'install', '--non-interactive', '{pkg}',],
    needsRoot: true,
  },],
  ['brew', {
    check: ['brew', '--version',],
    search: ['brew', 'info', '{pkg}',],
    install: ['brew', 'install', '{pkg}',],
    needsRoot: false,
  },],
  ['winget', {
    check: ['winget', '--version',],
    search: ['winget', 'show', '--id', '{pkg}', '--exact',],
    install: ['winget', 'install', '--id', '{pkg}', '--exact', '--accept-source-agreements',],
    needsRoot: false,
  },],
  ['scoop', {
    check: ['scoop', '--version',],
    search: ['scoop', 'info', '{pkg}',],
    install: ['scoop', 'install', '{pkg}',],
    needsRoot: false,
  },],
  ['choco', {
    check: ['choco', '--version',],
    search: ['choco', 'info', '{pkg}',],
    install: ['choco', 'install', '{pkg}', '--yes',],
    needsRoot: false,
  },],
],);

//endregion Manager definitions

//region Manager detection

/**
 * Cached detection result. `undefined` means detection has not run yet.
 * `null` means detection ran but no manager was found.
 */
let cachedManager: PackageManager | null | undefined;

/**
 * Detects the first available package manager on the current system.
 * Result is cached for the lifetime of the process.
 *
 * @returns Detected manager name, or `null` if none found
 *
 * @example
 * ```ts
 * const mgr = await detectManager();
 * // 'apt' on Debian/Ubuntu, 'dnf' on Fedora, 'brew' on macOS, etc.
 * ```
 */
export async function detectManager(): Promise<PackageManager | null> {
  if (cachedManager !== undefined) {
    return cachedManager;
  }
  for (const [name, def,] of MANAGERS) {
    const available = await evaluatePredicate(def.check,);
    if (available) {
      cachedManager = name;
      return name;
    }
  }
  cachedManager = null;
  return null;
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
  return evaluatePredicate([binary, checkFlag,],);
}

//endregion Binary existence check

//region Privilege detection

/**
 * Cached root detection result. `undefined` means detection has not run yet.
 */
let cachedIsRoot: boolean | undefined;

/**
 * Detects whether the current process is running as root (UID 0).
 * Returns `false` on platforms where `process.getuid` is unavailable (Windows).
 * Result is cached for the lifetime of the process.
 *
 * @returns `true` if running as root
 */
export function isRoot(): boolean {
  if (cachedIsRoot !== undefined) {
    return cachedIsRoot;
  }
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
  if (!def) {
    return false;
  }
  const cmd = def.search.map(function replacePlaceholder(segment,): string {
    return segment === '{pkg}' ? packageName : segment;
  },);
  return evaluatePredicate(cmd,);
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
  if (!def) {
    throw new Error(`Unknown package manager: ${manager}`,);
  }
  const cmdTemplate = def.install;
  const cmd = cmdTemplate.map(function replacePlaceholder(segment,): string {
    return segment === '{pkg}' ? packageName : segment;
  },);
  const needsSudo = def.needsRoot && !isRoot();
  const fullCmd = needsSudo ? ['sudo', ...cmd,] : cmd;
  const [executable = '', ...args] = fullCmd;
  return exec(executable, args,);
}

//endregion Install command
