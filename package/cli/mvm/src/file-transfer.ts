/**
 * File transfer between host and guest VM via virtiofs shared directory.
 *
 * Each VM has a `shared/` directory on the host exposed inside the guest
 * at `/mnt/shared` (Linux) or `Z:\` (Windows via WinFSP + virtiofs driver).
 * Push and pull simply copy files to/from this shared directory on the host;
 * the guest sees changes immediately through the virtiofs mount.
 *
 * @module
 */

import {
  copyFile,
  mkdir,
  readFile,
} from 'node:fs/promises';
import {
  basename,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  GUEST_MOUNT_POINT,
  SHARED_DIR_NAME,
  validateName,
  VMS_DIR,
  WINDOWS_GUEST_MOUNT_POINT,
} from './config.ts';
import { readVmMeta, } from './meta.ts';

/**
 * Logger root for mvm after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'mvm', },);

//region Push (host -> guest)

/**
 * Pushes a file from the host filesystem into a running VM via virtiofs.
 *
 * Copies the file into the VM's shared directory on the host.
 * The guest can access it at {@link GUEST_MOUNT_POINT}`/{filename}` (Linux)
 * or {@link WINDOWS_GUEST_MOUNT_POINT}`\{filename}` (Windows).
 *
 * When `guestPath` specifies a path under the guest mount point,
 * the file is placed at the matching relative path in the shared directory.
 * Otherwise the file is placed at `shared/{basename}` and the caller
 * should use the returned guest path to reference it.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @param hostPath - Absolute or relative path on the host to read from
 *
 * @param guestPath - Desired filename or path inside the guest.
 * If this is a bare filename, it is placed at the root of the shared mount.
 *
 * @returns Absolute path inside the guest where the file is accessible
 *
 * @throws Error when the VM directory does not exist
 *
 * @example
 * ```ts
 * const guestPath = await pushFile({
 *   name: 'dev-01',
 *   hostPath: '/tmp/setup.sh',
 *   guestPath: 'setup.sh',
 * });
 * // guestPath => '/mnt/shared/setup.sh'
 * ```
 */
export async function pushFile(
  {
    name,
    hostPath,
    guestPath,
  }: {
    readonly name: string;
    readonly hostPath: string;
    readonly guestPath: string;
  },
): Promise<string> {
  validateName(name,);
  /**
   * Tagged logger so push entries are scoped to {@link pushFile} in the output.
   */
  const rl = tagged({
    tag: pushFile.name,
    l,
  },);

  /**
   * Host-side shared directory for this VM.
   */
  const sharedDir = join(
    VMS_DIR,
    name,
    SHARED_DIR_NAME,
  );
  await mkdir(
    sharedDir,
    { recursive: true, },
  );

  /**
   * Filename to use inside the shared directory.
   */
  const filename = basename(guestPath,);

  /**
   * Full path on the host inside the shared directory.
   */
  const sharedHostPath = join(
    sharedDir,
    filename,
  );

  rl.info(`pushing ${hostPath} -> ${sharedHostPath}`,);
  await copyFile(
    hostPath,
    sharedHostPath,
  );

  /**
   * Determine the guest-side path based on OS family.
   */
  const vmDir = join(
    VMS_DIR,
    name,
  );
  /**
   * VM metadata used to pick the correct guest mount point for the OS family.
   */
  const meta = await readVmMeta(vmDir,);

  /**
   * Absolute path the guest will use to read the pushed file, branched on OS.
   */
  const guestFilePath = meta.osFamily
    === 'windows'
    ? `${WINDOWS_GUEST_MOUNT_POINT}${filename}`
    : `${GUEST_MOUNT_POINT}/${filename}`;

  rl.info(`pushed ${hostPath} -> ${guestFilePath} (via ${sharedHostPath})`,);
  return guestFilePath;
}

//endregion Push (host -> guest)

//region Pull (guest -> host)

/**
 * Pulls a file from a running VM to the host filesystem via virtiofs.
 *
 * The guest writes files to its shared mount, and this function reads
 * them from the corresponding host-side shared directory.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @param guestPath - Filename or path relative to the shared mount inside the guest
 *
 * @returns File content as a Buffer
 *
 * @throws Error when the file does not exist in the shared directory
 *
 * @example
 * ```ts
 * const content = await pullFile({
 *   name: 'dev-01',
 *   guestPath: 'output.txt',
 * });
 * console.log(content.toString('utf8'));
 * ```
 */
export async function pullFile(
  {
    name,
    guestPath,
  }: {
    readonly name: string;
    readonly guestPath: string;
  },
): Promise<Buffer> {
  validateName(name,);
  /**
   * Tagged logger so pull entries are scoped to {@link pullFile} in the output.
   */
  const rl = tagged({
    tag: pullFile.name,
    l,
  },);

  /**
   * Host-side shared directory for this VM.
   */
  const sharedDir = join(
    VMS_DIR,
    name,
    SHARED_DIR_NAME,
  );

  /**
   * Filename to read from the shared directory.
   */
  const filename = basename(guestPath,);

  /**
   * Full path on the host.
   */
  const sharedHostPath = join(
    sharedDir,
    filename,
  );

  rl.info(`pulling ${sharedHostPath} (guest: ${guestPath})`,);
  /**
   * File payload read from the shared mount; returned to the caller as a Buffer.
   */
  const content = await readFile(sharedHostPath,);
  rl.info(`pulled ${String(content.length,)} bytes from ${sharedHostPath}`,);

  return content;
}

//endregion Pull (guest -> host)
