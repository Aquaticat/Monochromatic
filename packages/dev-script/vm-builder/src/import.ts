#!/usr/bin/env bun
/**
 * Imports an already-built qcow2 disk image into libvirt as a VM.
 * Skips the container build and bootc-image-builder conversion steps.
 * Use this after `mise run ...:run` has built the qcow2 at least once.
 *
 * Run: mise run //packages/dev-script/vm-builder:import
 */
import { exec, } from '@monochromatic-dev/dev-script-file-enforcer/ts';
import { findUp, } from 'find-up';
import { spawn as nodeSpawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

import { generateDomainXml, } from './domain-xml.ts';

/** Libvirt domain name. */
const VM_NAME = 'monochromatic-dev';

/** VM memory in MiB (16 GiB). */
const VM_MEMORY_MIB = '16384';

/** Virtual CPU count. */
const VM_VCPUS = '8';

/**
 * Absolute path to this package's root directory.
 * Found by walking up from the script's directory to find the nearest `package.json`.
 */
const packageJson = await findUp('package.json',);
if (packageJson === undefined)
  throw new Error('could not find package.json for vm-builder',);

/** Resolved absolute path to the vm-builder package directory. */
const PACKAGE_DIR = resolve(dirname(packageJson,),);

/** Directory where bootc-image-builder wrote its output. */
const OUTPUT_DIR = join(
  PACKAGE_DIR,
  'output',
);

/** Path to the qcow2 disk image built by bootc-image-builder. */
const BUILD_QCOW2_PATH = join(
  OUTPUT_DIR,
  'qcow2',
  'disk.qcow2',
);

/**
 * Path where the qcow2 is copied for libvirt access.
 * `/var/lib/libvirt/images/` has SELinux context `virt_image_t`,
 * which allows QEMU (running in `svirt_t`) to read and write the image.
 * Files in the user's home directory have `user_home_t` which QEMU cannot access.
 */
const LIBVIRT_IMAGES_DIR = '/var/lib/libvirt/images';

/** Final qcow2 path under the libvirt images directory for QEMU access. */
const QCOW2_PATH = join(
  LIBVIRT_IMAGES_DIR,
  'monochromatic-dev.qcow2',
);

/** libvirt session URI -- no sudo needed. */
const LIBVIRT_URI = 'qemu:///session';

/**
 * Spawns a command with inherited stdio for progress feedback.
 *
 * @param cmd - Executable name
 *
 * @param args - Arguments passed to the command
 *
 * @throws When the command exits with a non-zero code
 */
async function run(
  {
    cmd,
    args,
  }: {
    cmd: string;
    args: readonly string[];
  },
): Promise<void> {
  const child = nodeSpawn(
    cmd,
    [...args,],
    { stdio: 'inherit', },
  );
  // oxlint-disable-next-line typescript-eslint(no-unsafe-assignment) -- node:events once() returns Promise<any[]>; close event always passes [code: number | null, signal: string | null]
  const [code,] = await once(
    child,
    'close',
  );
  if (code !== 0)
    throw new Error(`${cmd} exited with code ${String(code,)}`,);
}

/**
 * Destroys and undefines an existing libvirt domain if it exists.
 * No-op when the domain is not defined.
 *
 * @param name - Libvirt domain name to remove
 */
async function undefineVmIfExists(name: string,): Promise<void> {
  try {
    await exec(
      'virsh',
      [
        '--connect',
        LIBVIRT_URI,
        'dominfo',
        name,
      ],
    );
  }
  catch {
    return;
  }
  console.log(`[vm-builder] removing existing VM '${name}'...`,);
  const state = (await exec(
    'virsh',
    [
      '--connect',
      LIBVIRT_URI,
      'domstate',
      name,
    ],
  ))
    .trim();
  if (state === 'running') {
    await exec(
      'virsh',
      [
        '--connect',
        LIBVIRT_URI,
        'destroy',
        name,
      ],
    );
  }
  await exec(
    'virsh',
    [
      '--connect',
      LIBVIRT_URI,
      'undefine',
      name,
      '--nvram',
    ],
  );
}

/**
 * Imports the qcow2 disk image into libvirt.
 *
 * @param name - Libvirt domain name to create
 */
async function importVm(name: string,): Promise<void> {
  console.log(`[vm-builder] importing '${name}' into libvirt...`,);
  const xml = generateDomainXml({
    name,
    memoryMib: VM_MEMORY_MIB,
    vcpus: VM_VCPUS,
    qcow2Path: QCOW2_PATH,
  },);
  const xmlPath = join(
    OUTPUT_DIR,
    'domain.xml',
  );
  await writeFile(
    xmlPath,
    xml,
  );
  await exec(
    'virsh',
    [
      '--connect',
      LIBVIRT_URI,
      'define',
      xmlPath,
    ],
  );
}

/**
 * Grants the virt-manager Flatpak read-write access to {@link OUTPUT_DIR}.
 * No-op if virt-manager is not installed as a Flatpak.
 */
async function grantFlatpakAccess(): Promise<void> {
  try {
    await exec(
      'flatpak',
      [
        'info',
        'org.virt_manager.virt-manager',
      ],
    );
  }
  catch {
    return;
  }
  console.log(
    '[vm-builder] granting virt-manager Flatpak access to output directory...',
  );
  await exec(
    'flatpak',
    [
      'override',
      '--user',
      `--filesystem=${OUTPUT_DIR}`,
      'org.virt_manager.virt-manager',
    ],
  );
}

/**
 * Copies the built qcow2 to `/var/lib/libvirt/images/` where SELinux
 * labels it `virt_image_t`, allowing QEMU to access it.
 * Uses `sudo cp` because `/var/lib/libvirt/images/` is root-owned,
 * then restores ownership to the current user.
 */
async function copyToLibvirtImages(): Promise<void> {
  console.log(`[vm-builder] copying qcow2 to ${LIBVIRT_IMAGES_DIR}...`,);
  await run({
    cmd: 'sudo',
    args: [
      'cp',
      BUILD_QCOW2_PATH,
      QCOW2_PATH,
    ],
  },);
  const currentUser = process.env['USER'] ?? 'user';
  await run({
    cmd: 'sudo',
    args: [
      'chown',
      `${currentUser}:${currentUser}`,
      QCOW2_PATH,
    ],
  },);
}

await undefineVmIfExists(VM_NAME,);
await copyToLibvirtImages();
await importVm(VM_NAME,);
await grantFlatpakAccess();

console.log(
  `[vm-builder] done. Start the VM with: virsh --connect ${LIBVIRT_URI} start ${VM_NAME}\n  or open virt-manager and double-click ${VM_NAME}`,
);
