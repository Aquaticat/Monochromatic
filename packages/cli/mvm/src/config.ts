import { homedir } from 'node:os';
import { join } from 'node:path';

/** Prefix applied to all VM names in libvirt to avoid collisions. */
export const VM_PREFIX = 'mvm-';

/** Root data directory for VM images and disks. */
export const DATA_DIR = join(homedir(), '.local', 'share', 'mvm');

/** Directory for cached base cloud images. */
export const IMAGES_DIR = join(DATA_DIR, 'images');

/** Directory containing per-VM subdirectories with disks and metadata. */
export const VMS_DIR = join(DATA_DIR, 'vms');

/** Default VM memory allocation in MiB. Making it large for builds. */
export const DEFAULT_MEMORY_MIB = 8_192;

/** Default number of virtual CPUs. */
export const DEFAULT_VCPUS = 4;

/** Default root disk size for new Linux VMs. */
export const DEFAULT_DISK_SIZE = '20G';

/** Default root disk size for Windows VMs (Server 2025 requires 32 GB minimum). */
export const WINDOWS_DISK_SIZE = '40G';

/** libvirt connection URI targeting the user session QEMU/KVM daemon. */
export const LIBVIRT_URI = 'qemu:///session';

/**
 * Validates a VM name contains only safe characters.
 *
 * @param name - VM name to validate
 *
 * @throws Error when name contains invalid characters
 *
 * @example
 * ```ts
 * validateName('my-vm-01'); // OK
 * validateName('../evil');  // throws
 * ```
 */
export function validateName(name: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      `invalid VM name: ${name} (must start with alphanumeric, contain only alphanumerics, hyphens, underscores)`,
    );
  }
}
