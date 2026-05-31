/**
 * Distro-to-package-manager mapping and prerequisite installation commands.
 *
 * Maps container image names to their package manager and provides
 * the commands needed to prepare a container for test execution:
 * prerequisite packages, user creation, and sudo setup.
 */

import type {
  PackageManager,
  UserContext,
} from './types.ts';

//region Distro-to-package-manager mapping

/**
 * Known distro prefixes and their package managers.
 * Matches the beginning of the image name (before `:` tag or end of string).
 *
 * Order matters: more specific entries should come first
 * if there were overlapping prefixes (there are not currently).
 */
const DISTRO_MANAGER_MAP: Record<string, PackageManager> = {
  ubuntu: 'apt',
  debian: 'apt',
  fedora: 'dnf',
  centos: 'dnf',
  rhel: 'dnf',
  rocky: 'dnf',
  alma: 'dnf',
  alpine: 'apk',
  arch: 'pacman',
};

/**
 * Resolves a distro name to its package manager.
 *
 * @param distro - Distro name from the OS specification (e.g. `'ubuntu'`, `'fedora:39'`)
 *
 * @returns package manager for the distro
 *
 * @throws Error when the distro is not recognized
 *
 * @example
 * ```ts
 * detectPackageManager('ubuntu'); // 'apt'
 * detectPackageManager('fedora:39'); // 'dnf'
 * ```
 */
export function detectPackageManager(distro: string,): PackageManager {
  /**
   * Strip tag suffix (e.g. `fedora:39` becomes `fedora`) for lookup.
   */
  const baseName = distro.includes(':',)
    ? distro.slice(
      0,
      distro.indexOf(':',),
    )
    : distro;

  for (const [prefix, manager,] of Object.entries(DISTRO_MANAGER_MAP,)) {
    if (baseName === prefix)
      return manager;
  }

  throw new Error(
    `Unknown distro "${distro}" -- cannot determine package manager. `
      + `Known distros: ${Object.keys(DISTRO_MANAGER_MAP,)
        .join(', ',)}`,
  );
}

//endregion Distro-to-package-manager mapping

//region Prerequisite installation

/**
 * Package install commands for prerequisites, keyed by package manager.
 * Installs: curl (for runtime installers), unzip (for bun), sudo (for non-root users).
 */
const PREREQUISITE_COMMANDS: Record<PackageManager, {
  readonly base: string;
  readonly withSudo: string;
}> = {
  apt: {
    base: 'apt-get update && apt-get install -y curl unzip',
    withSudo: 'apt-get update && apt-get install -y curl unzip sudo',
  },
  dnf: {
    base: 'dnf install -y curl unzip',
    withSudo: 'dnf install -y curl unzip sudo',
  },
  apk: {
    base: 'apk add --no-cache curl unzip bash',
    withSudo: 'apk add --no-cache curl unzip bash sudo',
  },
  pacman: {
    base: 'pacman -Sy --noconfirm curl unzip',
    withSudo: 'pacman -Sy --noconfirm curl unzip sudo',
  },
};

/**
 * Returns the shell command to install prerequisites inside a container.
 *
 * @param manager - Package manager for the distro
 *
 * @param user - User context (non-root requires sudo)
 *
 * @returns shell command string
 *
 * @example
 * ```ts
 * prerequisiteCommand({
 *   manager: 'apt',
 *   user: 'root',
 * });
 * // 'apt-get update && apt-get install -y curl unzip'
 * ```
 */
export function prerequisiteCommand({
  manager,
  user,
}: {
  readonly manager: PackageManager;
  readonly user: UserContext;
},): string {
  /**
   * Captured to keep the ternary readable and avoid two lookups.
   */
  const commands = PREREQUISITE_COMMANDS[manager];
  return user === 'root' ? commands.base : commands.withSudo;
}

//endregion Prerequisite installation

//region User creation

/**
 * User creation command for non-root context.
 * Creates a user named `testuser` (uid 1000) with a home directory
 * and passwordless sudo access.
 *
 * Uses `adduser` on Alpine (BusyBox), `useradd` everywhere else.
 *
 * @param manager - Package manager, used to determine the adduser variant
 *
 * @returns shell command string that creates the user, or empty string for root
 *
 * @example
 * ```ts
 * userCreationCommand({ manager: 'apt', user: 'user' });
 * // 'useradd -m testuser && echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers'
 * ```
 */
export function userCreationCommand({
  manager,
  user,
}: {
  readonly manager: PackageManager;
  readonly user: UserContext;
},): string {
  if (user === 'root')
    return '';

  /**
   * Alpine uses BusyBox `adduser` which requires `-D` for non-interactive mode.
   * All other distros use `useradd -m` from shadow-utils.
   */
  const createUser = manager === 'apk'
    ? 'adduser -D testuser'
    : 'useradd -m testuser';

  return `${createUser} && echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers`;
}

//endregion User creation
