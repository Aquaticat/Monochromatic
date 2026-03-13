import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { l, tagged } from './log.ts';
import { CUSTOM_GUEST_DEFAULTS, DEFAULT_IMAGE, resolveImage, type GuestConfig, type OsFamily } from './registry.ts';

//region VM metadata type

/**
 * Persistent metadata stored alongside each VM in `meta.json`.
 * Captures guest OS properties needed by exec and clone without
 * re-resolving through the image registry.
 *
 * @example
 * ```ts
 * const meta: VmMeta = await readVmMeta('/home/user/.local/share/mvm/vms/dev-01');
 * meta.osFamily; // => 'linux'
 * ```
 */
export type VmMeta = {
  /** Registry image identifier (e.g. `ubuntu`, `windows`, or custom name). */
  image: string;
  /** OS family discriminant for exec shell and domain XML dispatch. */
  osFamily: OsFamily;
  /** Shell executable path or name for guest-exec commands. */
  shell: string;
  /** Default login user for this guest OS. */
  defaultUser: string;
  /** ISO 8601 timestamp of VM creation. */
  createdAt: string;
};

//endregion VM metadata type

//region Write

/**
 * Writes VM metadata to `meta.json` in the VM directory.
 * Also writes the legacy `image` text file for backwards compatibility.
 *
 * @param guest - Guest config for OS family, shell, and default user
 *
 * @param image - Registry image identifier
 *
 * @param vmDir - VM directory to write metadata into
 *
 * @returns Resolves when metadata is written
 *
 * @example
 * ```ts
 * await writeVmMeta({
 *
 *   vmDir: '/home/user/.local/share/mvm/vms/dev-01',
 *
 *   image: 'ubuntu',
 *
 *   guest: IMAGES['ubuntu'],
 * });
 * ```
 */
export async function writeVmMeta({ guest, image, vmDir }: {
  guest: GuestConfig;
  image: string;
  vmDir: string;
}): Promise<void> {
  const rl = tagged({ tag: writeVmMeta.name, l });
  const meta: VmMeta = {
    createdAt: new Date().toISOString(),
    defaultUser: guest.defaultUser,
    image,
    osFamily: guest.osFamily,
    shell: guest.shell,
  };

  const metaPath = join(vmDir, 'meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  rl.debug(`wrote VM metadata to ${metaPath}`);

  // Legacy compatibility: also write the image text file
  await writeFile(join(vmDir, 'image'), image);
}

//endregion Write

//region Read

/**
 * Reads VM metadata from `meta.json` in the VM directory.
 * Falls back to the legacy `image` text file and derives metadata
 * from the registry for VMs created before meta.json was introduced.
 *
 * @param vmDir - Absolute path to the VM directory
 *
 * @returns Resolved VM metadata
 *
 * @example
 * ```ts
 * const meta = await readVmMeta('/home/user/.local/share/mvm/vms/dev-01');
 * if (meta.osFamily === 'windows') {
 *
 *   // use PowerShell for exec
 * }
 * ```
 */
export async function readVmMeta(vmDir: string): Promise<VmMeta> {
  const rl = tagged({ tag: readVmMeta.name, l });

  // Try meta.json first
  try {
    const content = await readFile(join(vmDir, 'meta.json'), 'utf8');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted local meta.json written by writeVmMeta
    const meta = JSON.parse(content) as VmMeta;
    rl.debug(`read VM metadata from ${vmDir}/meta.json`);
    return meta;
  } catch {
    rl.debug('meta.json not found, falling back to legacy image file');
  }

  // Fall back to legacy image text file
  let image = DEFAULT_IMAGE;
  try {
    const content = await readFile(join(vmDir, 'image'), 'utf8');
    image = content.trim();
  } catch {
    rl.debug('legacy image file not found, assuming ubuntu');
  }

  const resolved = resolveImage(image);
  const guest = resolved.kind === 'registry'
    ? resolved.spec
    : CUSTOM_GUEST_DEFAULTS;

  return {
    createdAt: '',
    defaultUser: guest.defaultUser,
    image,
    osFamily: guest.osFamily,
    shell: guest.shell,
  };
}

//endregion Read
