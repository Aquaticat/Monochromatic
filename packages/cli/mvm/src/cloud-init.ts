import { join } from 'node:path';

import { createIso } from './iso9660.ts';
import { l, tagged } from './log.ts';

/**
 * Generates a cloud-init NoCloud seed ISO with user-data and meta-data.
 * Uses the built-in ISO9660 generator instead of external tools like genisoimage.
 *
 * Configures auto-login on the serial console (ttyS0) so `virsh console`
 * drops directly into a shell without SSH or passwords.
 *
 * @param options - VM directory for writing the ISO and VM name for hostname configuration
 * @returns Absolute path to the generated seed ISO
 *
 * @example
 * ```ts
 * const seedPath = await createSeedIso({ name: 'my-vm', vmDir: '/path/to/vm' });
 * ```
 */
export async function createSeedIso({ name, vmDir }: { name: string; vmDir: string }): Promise<string> {
  const rl = tagged({ tag: createSeedIso.name, l, });

  const encoder = new TextEncoder();
  const userData = encoder.encode(
    `#cloud-config
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
packages:
  - qemu-guest-agent
runcmd:
  - systemctl daemon-reload
  - systemctl restart serial-getty@ttyS0.service
  - systemctl enable --now qemu-guest-agent
`,
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
