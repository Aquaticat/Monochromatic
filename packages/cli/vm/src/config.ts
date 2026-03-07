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

/** Ubuntu 24.04 LTS (Noble Numbat) cloud image download URL. */
export const UBUNTU_IMAGE_URL = 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img';

/** Filename for the cached Ubuntu cloud image. */
export const UBUNTU_IMAGE_NAME = 'ubuntu-24.04-cloudimg-amd64.img';

/** Default VM memory allocation in MiB. */
export const DEFAULT_MEMORY_MIB = 2048;

/** Default number of virtual CPUs. */
export const DEFAULT_VCPUS = 2;

/** Default root disk size for new VMs. */
export const DEFAULT_DISK_SIZE = '20G';

/** libvirt connection URI targeting the system QEMU/KVM daemon. */
export const LIBVIRT_URI = 'qemu:///system';

/**
 * Validates a VM name contains only safe characters.
 *
 * @param name - VM name to validate
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
