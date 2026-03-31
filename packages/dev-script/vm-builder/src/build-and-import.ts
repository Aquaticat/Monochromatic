#!/usr/bin/env bun
/**
 * Orchestrates the full VM build pipeline:
 * 1. Build OCI container image from Containerfile (rootful podman, for bootc-image-builder compatibility)
 * 2. Convert to qcow2 via bootc-image-builder (rootful podman, privileged)
 * 3. Fix file ownership after the root-privileged steps
 * 4. Remove existing libvirt domain of the same name if present
 * 5. Import the qcow2 as a new libvirt domain accessible from virt-manager
 *
 * Cosign signing is a separate step (`mise run ...:sign`) because `cosign sign`
 * pushes signatures to a registry. For local-only builds there is no registry;
 * signing is only needed before `podman push` to GHCR.
 *
 * Prerequisites on the host:
 * - podman (rootful via sudo, for both image build and conversion)
 * - virsh (libvirt-client package)
 *
 * Run: mise run //packages/dev-script/vm-builder:run
 */
import { exec } from '@monochromatic-dev/dev-script-file-enforcer/ts';
import { $ as h } from '@monochromatic-dev/module-es/h-xml';
import { findUp } from 'find-up';
import { spawn as nodeSpawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** OCI image tag produced by the podman build step. */
const IMAGE_TAG = 'localhost/monochromatic-dev:latest';

/** Libvirt domain name used for virsh define. */
const VM_NAME = 'monochromatic-dev';

/** VM memory in MiB (16 GiB). */
const VM_MEMORY_MIB = '16384';

/** Virtual CPU count. */
const VM_VCPUS = '8';

/**
 * Absolute path to this package's root directory.
 * Found by walking up from the script's directory to find the nearest `package.json`.
 */
const packageJson = await findUp('package.json');
if (packageJson === undefined) {
  throw new Error('could not find package.json for vm-builder');
}
const PACKAGE_DIR = dirname(packageJson);

/**
 * Absolute path to the monorepo root.
 * Found by walking up to find a `mise.toml` containing a `[monorepo]` section.
 * Used as the podman build context so the Containerfile can COPY from
 * sibling packages (e.g. `packages/config/dotfiles/`).
 */
const monorepoMiseToml = await findUp(
  async function isMonorepoRoot(directory) {
    try {
      const content = await readFile(join(directory, 'mise.toml'), 'utf8');
      if (content.includes('[monorepo]\n')) {
        return join(directory, 'mise.toml');
      }
    } catch {
      // mise.toml not found in this directory, keep searching.
    }
    return undefined;
  },
);
if (monorepoMiseToml === undefined) {
  throw new Error('could not find monorepo root (no mise.toml with [monorepo] section)');
}
const MONOREPO_ROOT = dirname(monorepoMiseToml);

/**
 * Directory where bootc-image-builder writes its output.
 * Created automatically before the conversion step.
 * Gitignored -- not checked in.
 */
const OUTPUT_DIR = join(PACKAGE_DIR, 'output');

/** Path to the qcow2 disk image produced by bootc-image-builder. */
const QCOW2_PATH = join(OUTPUT_DIR, 'qcow2', 'disk.qcow2');

/** Current user login name; used to restore ownership after the privileged build step. */
const CURRENT_USER = process.env['USER'] ?? 'user';

/** libvirt session URI -- connects to the user's QEMU/KVM daemon (no sudo needed). */
const LIBVIRT_URI = 'qemu:///session';

//region Streaming process runner

/**
 * Spawns a command with inherited stdio so output streams to the terminal in real time.
 * Used for long-running commands (podman build, bootc-image-builder) where progress
 * feedback matters.
 *
 * @param cmd - Executable name
 *
 * @param args - Arguments passed to the command
 *
 * @throws When the command exits with a non-zero code
 *
 * @example
 * ```ts
 * await run({ cmd: 'podman', args: ['build', '--tag', 'myimage', '.'] });
 * ```
 */
async function run(
  { cmd, args }: { cmd: string; args: readonly string[] },
): Promise<void> {
  const child = nodeSpawn(cmd, [...args], { stdio: 'inherit' });
  const [code] = await once(child, 'close') as [number];
  if (code !== 0) {
    throw new Error(`${cmd} exited with code ${String(code)}`);
  }
}

//endregion Streaming process runner

/**
 * Builds the OCI container image from Containerfile using rootful podman.
 * Rootful is required because bootc-image-builder in the next step resolves images
 * from rootful storage (`/var/lib/containers/storage`), not user storage.
 *
 * Build context is the monorepo root so the Containerfile can COPY from
 * sibling packages (e.g. `packages/config/dotfiles/`).
 *
 * The resulting image is tagged as {@link IMAGE_TAG} in the rootful container store.
 */
async function buildImage(): Promise<void> {
  console.log('[vm-builder] building container image (rootful)...');
  await run({
    cmd: 'sudo',
    args: [
      'podman', 'build',
      '--tag', IMAGE_TAG,
      '--file', join(PACKAGE_DIR, 'Containerfile'),
      MONOREPO_ROOT,
    ],
  });
}

/**
 * Converts the container image to a qcow2 disk image using bootc-image-builder.
 *
 * Runs as root (sudo podman) because bootc-image-builder requires:
 * - `--privileged` for device access during disk partitioning
 * - Access to `/var/lib/containers/storage` (the rootful podman image store)
 *
 * Disk layout is controlled by `disk_config/disk.toml`.
 * Output is written to `{@link OUTPUT_DIR}/qcow2/disk.qcow2`.
 */
async function convertToQcow2(): Promise<void> {
  console.log('[vm-builder] converting to qcow2 with bootc-image-builder...');
  await mkdir(OUTPUT_DIR, { recursive: true });
  await run({
    cmd: 'sudo',
    args: [
      'podman', 'run',
      '--rm', '--privileged',
      '--security-opt', 'label=type:unconfined_t',
      '--volume', `${OUTPUT_DIR}:/output`,
      '--volume', '/var/lib/containers/storage:/var/lib/containers/storage',
      '--volume', `${join(PACKAGE_DIR, 'disk_config')}:/config:ro`,
      'quay.io/centos-bootc/bootc-image-builder:latest',
      '--type', 'qcow2',
      '--config', '/config/disk.toml',
      IMAGE_TAG,
    ],
  });
}

/**
 * Restores ownership of {@link OUTPUT_DIR} to the current user.
 * Both `podman build` and bootc-image-builder run as root,
 * leaving all output files owned by root:root.
 * Restoring ownership lets virt-install read the qcow2 as a normal user.
 */
async function fixOwnership(): Promise<void> {
  console.log('[vm-builder] restoring output ownership to current user...');
  await run({
    cmd: 'sudo',
    args: ['chown', '-R', `${CURRENT_USER}:${CURRENT_USER}`, OUTPUT_DIR],
  });
}

/**
 * Destroys and undefines an existing libvirt domain if it exists.
 * No-op when the domain is not defined.
 * Forcibly destroys a running domain before undefining to avoid an "active domain" error.
 *
 * @param name - Libvirt domain name to remove
 */
async function undefineVmIfExists(name: string): Promise<void> {
  try {
    await exec('virsh', ['--connect', LIBVIRT_URI, 'dominfo', name]);
  } catch {
    // Domain not defined -- nothing to remove.
    return;
  }
  console.log(`[vm-builder] removing existing VM '${name}'...`);
  const state = (await exec('virsh', ['--connect', LIBVIRT_URI, 'domstate', name])).trim();
  if (state === 'running') {
    await exec('virsh', ['--connect', LIBVIRT_URI, 'destroy', name]);
  }
  await exec('virsh', ['--connect', LIBVIRT_URI, 'undefine', name]);
}

/**
 * Generates libvirt domain XML for the dev VM.
 * Uses h-xml (same pattern as cli-mvm) with SPICE graphics + QXL video
 * for virt-manager desktop access, virtio disk and NIC, UEFI boot,
 * and host-passthrough CPU.
 *
 * @param name - Libvirt domain name
 *
 * @returns Complete libvirt domain XML string
 */
function generateDomainXml(name: string): string {
  return h({
    tag: 'domain',
    attrs: { type: 'kvm' },
    children: [
      h({ tag: 'name', text: name }),
      h({ tag: 'memory', attrs: { unit: 'MiB' }, text: VM_MEMORY_MIB }),
      h({ tag: 'vcpu', text: VM_VCPUS }),
      h({
        tag: 'os',
        children: [
          h({ tag: 'type', attrs: { arch: 'x86_64' }, text: 'hvm' }),
          h({ tag: 'boot', attrs: { dev: 'hd' } }),
        ],
      }),
      h({ tag: 'cpu', attrs: { mode: 'host-passthrough' } }),
      h({
        tag: 'features',
        children: [h({ tag: 'acpi' })],
      }),
      h({ tag: 'clock', attrs: { offset: 'utc' } }),
      h({
        tag: 'devices',
        children: [
          h({
            tag: 'disk',
            attrs: { type: 'file', device: 'disk' },
            children: [
              h({ tag: 'driver', attrs: { name: 'qemu', type: 'qcow2' } }),
              h({ tag: 'source', attrs: { file: QCOW2_PATH } }),
              h({ tag: 'target', attrs: { dev: 'vda', bus: 'virtio' } }),
            ],
          }),
          h({
            tag: 'interface',
            attrs: { type: 'user' },
            children: [
              h({ tag: 'model', attrs: { type: 'virtio' } }),
            ],
          }),
          h({
            tag: 'graphics',
            attrs: { type: 'spice', autoport: 'yes' },
            children: [
              h({ tag: 'gl', attrs: { enable: 'yes' } }),
            ],
          }),
          h({
            tag: 'video',
            children: [
              h({ tag: 'model', attrs: { type: 'virtio', heads: '1' } }),
              h({ tag: 'acceleration', attrs: { accel3d: 'yes' } }),
            ],
          }),
          h({
            tag: 'channel',
            attrs: { type: 'unix' },
            children: [
              h({ tag: 'target', attrs: { type: 'virtio', name: 'org.qemu.guest_agent.0' } }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Imports the qcow2 disk image into libvirt as a new domain.
 * Writes domain XML to a file and defines it via `virsh define`.
 * The VM is registered but not started; open virt-manager or run
 * `virsh --connect qemu:///session start <name>` to boot it.
 *
 * @param name - Libvirt domain name to create
 */
async function importVm(name: string): Promise<void> {
  console.log(`[vm-builder] importing '${name}' into libvirt...`);
  const xml = generateDomainXml(name);
  const xmlPath = join(OUTPUT_DIR, 'domain.xml');
  await writeFile(xmlPath, xml);
  await exec('virsh', ['--connect', LIBVIRT_URI, 'define', xmlPath]);
}

await buildImage();
await convertToQcow2();
await fixOwnership();
await undefineVmIfExists(VM_NAME);
await importVm(VM_NAME);

console.log(`[vm-builder] done. Start the VM with: virsh --connect ${LIBVIRT_URI} start ${VM_NAME}\n  or open virt-manager and double-click ${VM_NAME}`);
