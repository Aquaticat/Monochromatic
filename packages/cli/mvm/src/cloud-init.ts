import { join } from 'node:path';

import { createIso } from './iso9660.ts';
import { l, tagged } from './log.ts';

/**
 * Shared cloud-init user-data content for VM configuration.
 * Sets up the ubuntu user with passwordless sudo and serial console autologin.
 * Does NOT install qemu-guest-agent -- that is pre-baked into the template image.
 *
 * @param name - VM hostname
 * @returns Cloud-init user-data string
 *
 * @example
 * ```ts
 * const userData = vmUserData('my-vm');
 * ```
 */
function vmUserData(name: string): string {
  return `#cloud-config
hostname: ${name}
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
write_files:
  - path: /etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf
    content: |
      [Service]
      ExecStart=
      ExecStart=-/sbin/agetty --autologin ubuntu --noclear %I $TERM
      Restart=no
  - path: /home/ubuntu/.bash_logout
    owner: ubuntu:ubuntu
    content: |
      echo ""
      echo "Session ended. Press Ctrl+] to disconnect."
runcmd:
  - systemctl daemon-reload
  - systemctl restart serial-getty@ttyS0.service
`;
}

/**
 * Cloud-init user-data for template creation.
 * Installs qemu-guest-agent so the template image has it pre-baked,
 * avoiding apt downloads on every VM boot.
 *
 * @param name - Template VM hostname
 * @returns Cloud-init user-data string with qemu-guest-agent installation
 *
 * @example
 * ```ts
 * const userData = templateUserData('template-setup');
 * ```
 */
function templateUserData(name: string): string {
  return `#cloud-config
hostname: ${name}
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
packages:
  - qemu-guest-agent
runcmd:
  - systemctl enable --now qemu-guest-agent
`;
}

/**
 * Generates a cloud-init NoCloud seed ISO with user-data and meta-data.
 * Uses the built-in ISO9660 generator instead of external tools like genisoimage.
 *
 * Configures auto-login on the serial console (ttyS0) so `virsh console`
 * drops directly into a shell without SSH or passwords.
 *
 * @param options - VM directory for writing the ISO, VM name for hostname configuration,
 *   and whether this is for template creation (installs qemu-guest-agent)
 * @returns Absolute path to the generated seed ISO
 *
 * @example
 * ```ts
 * const seedPath = await createSeedIso({ name: 'my-vm', vmDir: '/path/to/vm' });
 * const templateSeed = await createSeedIso({ name: 'tpl', vmDir: '/path/to/vm', template: true });
 * ```
 */
export async function createSeedIso({ name, template = false, vmDir }: {
  name: string;
  template?: boolean;
  vmDir: string;
}): Promise<string> {
  const rl = tagged({ tag: createSeedIso.name, l, });

  const encoder = new TextEncoder();
  const userData = encoder.encode(template ? templateUserData(name) : vmUserData(name));

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
