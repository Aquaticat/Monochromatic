import { join } from 'node:path';

import { createIso } from './iso9660.ts';
import { l, tagged } from './log.ts';
import type { GuestConfig, InitSystem } from './registry.ts';

//region Systemd user-data helpers

/**
 * Generates runcmd entries for enabling qemu-guest-agent on systemd distros.
 *
 * @returns Cloud-init runcmd block for systemd
 *
 * @example
 * ```ts
 * templateRuncmdSystemd(); // => 'runcmd:\n  - systemctl enable --now qemu-guest-agent\n'
 * ```
 */
function templateRuncmdSystemd(): string {
  return `runcmd:
  - systemctl enable --now qemu-guest-agent
`;
}

/**
 * Generates write_files and runcmd for serial autologin on systemd distros.
 * Overrides the serial-getty service for ttyS0 with autologin for the given user.
 *
 * @param user - Login username for autologin
 * @returns Cloud-init write_files and runcmd blocks
 *
 * @example
 * ```ts
 * vmAutologinSystemd('ubuntu');
 * ```
 */
function vmAutologinSystemd(user: string): string {
  return `write_files:
  - path: /etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf
    content: |
      [Service]
      ExecStart=
      ExecStart=-/sbin/agetty --autologin ${user} --noclear %I $TERM
      Restart=no
  - path: /home/${user}/.bash_logout
    owner: ${user}:${user}
    content: |
      echo ""
      echo "Session ended. Press Ctrl+] to disconnect."
runcmd:
  - systemctl daemon-reload
  - systemctl restart serial-getty@ttyS0.service
`;
}

//endregion Systemd user-data helpers

//region OpenRC user-data helpers

/**
 * Generates runcmd entries for enabling qemu-guest-agent on OpenRC distros (Alpine).
 *
 * @returns Cloud-init runcmd block for OpenRC
 *
 * @example
 * ```ts
 * templateRuncmdOpenrc(); // => 'runcmd:\n  - rc-update add qemu-guest-agent\n  ...'
 * ```
 */
function templateRuncmdOpenrc(): string {
  return `runcmd:
  - rc-update add qemu-guest-agent
  - service qemu-guest-agent start
`;
}

/**
 * Generates write_files and runcmd for serial autologin on OpenRC distros (Alpine).
 * Appends an agetty entry to `/etc/inittab` and sends SIGHUP to init.
 *
 * @param user - Login username for autologin
 * @returns Cloud-init write_files and runcmd blocks
 *
 * @example
 * ```ts
 * vmAutologinOpenrc('alpine');
 * ```
 */
function vmAutologinOpenrc(user: string): string {
  return `write_files:
  - path: /etc/inittab
    append: true
    content: |
      ttyS0::respawn:/sbin/agetty --autologin ${user} 115200 ttyS0 vt100
  - path: /home/${user}/.ash_logout
    owner: ${user}:${user}
    content: |
      echo ""
      echo "Session ended. Press Ctrl+] to disconnect."
runcmd:
  - kill -HUP 1
`;
}

//endregion OpenRC user-data helpers

//region Init system dispatch

/**
 * Dispatches to the correct template runcmd generator for the given init system.
 *
 * @param initSystem - Target init system
 * @returns Cloud-init runcmd block
 *
 * @example
 * ```ts
 * templateRuncmd('systemd');
 * ```
 */
function templateRuncmd(initSystem: InitSystem): string {
  if (initSystem === 'openrc') {
    return templateRuncmdOpenrc();
  }
  return templateRuncmdSystemd();
}

/**
 * Dispatches to the correct autologin generator for the given init system.
 *
 * @param initSystem - Target init system
 * @param user - Login username
 * @returns Cloud-init write_files and runcmd blocks
 *
 * @example
 * ```ts
 * vmAutologin('systemd', 'ubuntu');
 * ```
 */
function vmAutologin(initSystem: InitSystem, user: string): string {
  if (initSystem === 'openrc') {
    return vmAutologinOpenrc(user);
  }
  return vmAutologinSystemd(user);
}

//endregion Init system dispatch

//region User-data generators

/**
 * Generates cloud-init user-data for VM instances.
 * Sets up the default user with passwordless sudo and serial console autologin.
 *
 * @param options - VM hostname and image spec for distro-specific configuration
 * @returns Cloud-init user-data string
 *
 * @example
 * ```ts
 * vmUserData({ name: 'my-vm', guest: IMAGES['ubuntu'] });
 * ```
 */
function vmUserData({ guest, name }: { guest: GuestConfig; name: string }): string {
  return `#cloud-config
hostname: ${name}
users:
  - name: ${guest.defaultUser}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: ${guest.shell}
${vmAutologin(guest.initSystem, guest.defaultUser)}`;
}

/**
 * Generates cloud-init user-data for template creation.
 * Installs qemu-guest-agent so the template image has it pre-baked,
 * avoiding package downloads on every VM boot.
 *
 * @param options - Template VM hostname and image spec for distro-specific configuration
 * @returns Cloud-init user-data string with qemu-guest-agent installation
 *
 * @example
 * ```ts
 * templateUserData({ name: 'template-setup', guest: IMAGES['ubuntu'] });
 * ```
 */
function templateUserData({ guest, name }: { guest: GuestConfig; name: string }): string {
  return `#cloud-config
hostname: ${name}
users:
  - name: ${guest.defaultUser}
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: ${guest.shell}
packages:
  - qemu-guest-agent
${templateRuncmd(guest.initSystem)}`;
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
 * @param options - VM directory for writing the ISO, VM name for hostname configuration,
 *   image spec for distro-specific cloud-init, and whether this is for template creation
 * @returns Absolute path to the generated seed ISO
 *
 * @example
 * ```ts
 * const seedPath = await createSeedIso({ name: 'my-vm', guest: IMAGES['ubuntu'], vmDir: '/path/to/vm' });
 * ```
 */
export async function createSeedIso({ guest, name, template = false, vmDir }: {
  guest: GuestConfig;
  name: string;
  template?: boolean;
  vmDir: string;
}): Promise<string> {
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
  await Bun.write(seedPath, iso);
  rl.info(`created seed ISO at ${seedPath}`);
  return seedPath;
}

//endregion Seed ISO generation
