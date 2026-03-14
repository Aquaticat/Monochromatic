import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { templateRuncmd, vmAutologin } from './cloud-init-init-systems.ts';
import { createIso } from './iso9660.ts';
import { l, tagged } from './log.ts';
import type { GuestConfig, LinuxGuestConfig } from './registry.ts';

/**
 * Narrows a {@link GuestConfig} to {@link LinuxGuestConfig} after the caller
 * has already ruled out Windows guests via an early return.
 *
 * @param guest - Guest config known to be Linux at this call site
 *
 * @returns The same config narrowed to LinuxGuestConfig
 *
 * @example
 * ```ts
 * if (guest.osFamily === 'windows') return;
 * const linux = asLinux(guest);
 * linux.initSystem; // safe
 * ```
 */
function asLinux(guest: GuestConfig): LinuxGuestConfig {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- caller has already ruled out Windows via early return
  return guest as LinuxGuestConfig;
}

//region User-data generators

/**
 * Generates cloud-init user-data for VM instances.
 * Sets up the default user with passwordless sudo and serial console autologin.
 *
 * @param guest - Guest config for distro-specific cloud-init settings
 *
 * @param name - VM hostname
 *
 * @returns Cloud-init user-data string
 *
 * @example
 * ```ts
 * vmUserData({ name: 'my-vm', guest: IMAGES['ubuntu'] });
 * ```
 */
function vmUserData({ guest, name }: { guest: GuestConfig; name: string }): string {
  const linux = asLinux(guest);
  return `#cloud-config
hostname: ${name}
users:
  - name: ${linux.defaultUser}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: ${linux.shell}
${vmAutologin(linux.initSystem, linux.defaultUser)}`;
}

/**
 * Generates cloud-init user-data for template creation.
 * Installs qemu-guest-agent so the template image has it pre-baked,
 * avoiding package downloads on every VM boot.
 *
 * @param guest - Guest config for distro-specific cloud-init settings
 *
 * @param name - Template VM hostname
 *
 * @returns Cloud-init user-data string with qemu-guest-agent installation
 *
 * @example
 * ```ts
 * templateUserData({ name: 'template-setup', guest: IMAGES['ubuntu'] });
 * ```
 */
function templateUserData({ guest, name }: { guest: GuestConfig; name: string }): string {
  const linux = asLinux(guest);
  return `#cloud-config
hostname: ${name}
users:
  - name: ${linux.defaultUser}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: ${linux.shell}
packages:
  - qemu-guest-agent
${templateRuncmd(linux.initSystem)}`;
}

//endregion User-data generators

//region Seed ISO generation

/**
 * Generates a cloud-init NoCloud seed ISO with user-data and meta-data.
 * Uses the built-in ISO9660 generator instead of external tools like genisoimage.
 *
 * Configures auto-login on the serial console (ttyS0) so `virsh console`
 * drops directly into a shell without SSH or passwords.
 *
 * Windows guests return `undefined` because they do not use cloud-init.
 * Hostname is set via the QEMU guest agent after boot instead.
 *
 *   guest config for distro-specific cloud-init, and whether this is for template creation
 *
 * @param guest - Guest config for distro-specific cloud-init settings
 *
 * @param name - VM name used as hostname
 *
 * @param template - Whether this is a template creation (installs qemu-guest-agent)
 *
 * @param vmDir - Directory to write the seed ISO into
 *
 * @returns Absolute path to the generated seed ISO, or `undefined` for Windows guests
 *
 * @example
 * ```ts
 * const seedPath = await createSeedIso({ name: 'my-vm', guest: IMAGES['ubuntu'], vmDir: '/path/to/vm' });
 * // seedPath => '/path/to/vm/seed.iso'
 *
 * const winSeed = await createSeedIso({ name: 'win-vm', guest: IMAGES['windows'], vmDir: '/path/to/vm' });
 * // winSeed => undefined
 * ```
 */
export async function createSeedIso({ guest, name, template = false, vmDir }: {
  guest: GuestConfig;
  name: string;
  template?: boolean;
  vmDir: string;
}): Promise<string | undefined> {
  if (guest.osFamily === 'windows') {
    const rl = tagged({ tag: createSeedIso.name, l });
    rl.info('skipping seed ISO for Windows guest (uses guest agent for provisioning)');
    return undefined;
  }

  const rl = tagged({ tag: createSeedIso.name, l, });

  const encoder = new TextEncoder();
  const userData = encoder.encode(
    template
      ? templateUserData({ guest, name })
      : vmUserData({ guest, name }),
  );

  const metaData = encoder.encode(
    `instance-id: ${name}
local-hostname: ${name}
`,
  );

  const iso = createIso({
    files: [
      { data: userData, name: 'user-data', },
      { data: metaData, name: 'meta-data', },
    ],
    volumeId: 'cidata',
  });

  const seedPath = join(vmDir, 'seed.iso');
  await writeFile(seedPath, iso);
  rl.info(`created seed ISO at ${seedPath}`);
  return seedPath;
}

//endregion Seed ISO generation
