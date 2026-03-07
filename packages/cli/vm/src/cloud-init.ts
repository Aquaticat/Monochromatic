import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createIso } from './iso9660.ts';
import { l, tagged } from './log.ts';

/** SSH public key filenames to search for, in preference order. */
const SSH_KEY_CANDIDATES = ['id_ed25519.pub', 'id_rsa.pub', 'id_ecdsa.pub'] as const;

/**
 * Finds the first available SSH public key in `~/.ssh/`.
 *
 * @returns Contents of the SSH public key file, trimmed
 * @throws Error when no SSH public key is found
 */
async function findSshPublicKey(): Promise<string> {
  const sshDir = join(homedir(), '.ssh');

  for (const candidate of SSH_KEY_CANDIDATES) {
    const keyPath = join(sshDir, candidate);
    if (existsSync(keyPath)) {
      const key = await Bun.file(keyPath).text();
      return key.trim();
    }
  }

  throw new Error(
    `no SSH public key found in ~/.ssh/ (tried: ${SSH_KEY_CANDIDATES.join(', ')})`,
  );
}

/**
 * Generates a cloud-init NoCloud seed ISO with user-data and meta-data.
 * Uses the built-in ISO9660 generator instead of external tools like genisoimage.
 *
 * @param options - VM directory for writing the ISO and VM name for hostname configuration
 * @returns Absolute path to the generated seed ISO
 * @throws Error when no SSH public key is found
 *
 * @example
 * ```ts
 * const seedPath = await createSeedIso({ name: 'my-vm', vmDir: '/path/to/vm' });
 * ```
 */
export async function createSeedIso({ name, vmDir }: { name: string; vmDir: string }): Promise<string> {
  const rl = tagged({ tag: createSeedIso.name, l, });
  const sshKey = await findSshPublicKey();
  rl.debug(`using SSH key: ${sshKey.slice(0, 40)}...`);

  const encoder = new TextEncoder();
  const userData = encoder.encode(
    `#cloud-config
hostname: ${name}
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - ${sshKey}
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
