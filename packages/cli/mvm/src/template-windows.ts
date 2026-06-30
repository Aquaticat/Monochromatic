/**
 * Windows template baking pipeline.
 * Creates a template by booting from an evaluation ISO with an
 * Autounattend.xml answer file and virtio-win drivers for fully
 * unattended Windows Server installation.
 */

import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { BYTES_PER_KIB, } from '@monochromatic-dev/module-const/ts';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';

import { createAutounattendIso, } from './autounattend.ts';
import {
  IMAGES_DIR,
  VM_PREFIX,
  VMS_DIR,
  WINDOWS_DISK_SIZE,
  WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS,
} from './config.ts';
import { domainXml, } from './domain-xml.ts';
import {
  ensureImage,
  ensureVirtioWin,
  ensureWinFsp,
} from './image.ts';
import type { WindowsImageSpec, } from './registry.ts';
import { spawn, } from './spawn.ts';
import {
  TEMPLATE_VM_NAME,
  templateVmGuard,
} from './template-shared.ts';
import { verifyVirtioBoot, } from './template-windows-virtio.ts';
import { waitForGuestAgent, } from './virsh-wait.ts';
import {
  defineVm,
  startVm,
  virsh,
} from './virsh.ts';

/**
 * Logger root for mvm after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'mvm', },);

/**
 * Creates a Windows template by booting from an evaluation ISO with an
 * Autounattend.xml answer file and virtio-win drivers. The unattended
 * install partitions the disk, installs Windows Server, loads VirtIO
 * drivers, installs the QEMU guest agent, and completes OOBE automatically.
 *
 * Template creation takes 15-30 minutes on first run due to the full
 * Windows installation process.
 *
 * @param spec - Windows image specification from the registry
 *
 * @returns Absolute path to the baked template qcow2
 *
 * @throws Error when template creation fails
 *
 * @example
 * ```ts
 * const path = await ensureWindowsTemplate(IMAGES['windows'] as WindowsImageSpec);
 * ```
 */
export async function ensureWindowsTemplate(spec: WindowsImageSpec,): Promise<string> {
  /**
   * Logger scoped to this template-bake call so log lines carry the function name.
   */
  const rl = tagged({
    tag: ensureWindowsTemplate.name,
    l,
  },);
  /**
   * Final on-disk path for the baked template qcow2; written after disk conversion.
   */
  const templatePath = join(
    IMAGES_DIR,
    spec.templateFileName,
  );

  rl.info(`creating Windows template ${spec.templateFileName} from evaluation ISO...`,);
  rl.info('this will take 15-30 minutes for unattended Windows installation',);

  /**
   * Concurrent downloads of the three prerequisites; resolved together to overlap network IO.
   */
  const [windowsIsoPath, virtioWinPath, winfspMsiPath,] = await Promise.all([
    ensureImage(spec,),
    ensureVirtioWin(),
    ensureWinFsp(),
  ],);

  /**
   * Per-VM scratch directory; holds the install disk and autounattend ISO during the bake.
   */
  const vmDir = join(
    VMS_DIR,
    TEMPLATE_VM_NAME,
  );
  await mkdir(
    vmDir,
    { recursive: true, },
  );

  /**
   * Path of the empty qcow2 created below; Windows installs onto it then it is converted to the final template.
   */
  const diskPath = join(
    vmDir,
    'disk.qcow2',
  );

  /**
   * Disposable guard that tears down the template VM on scope exit, even on early throws.
   */
  await using _cleanup = templateVmGuard(rl,);

  rl.info('creating empty disk for Windows installation...',);
  await spawn({
    command: 'qemu-img',
    args: [
      'create',
      '-f',
      'qcow2',
      diskPath,
      WINDOWS_DISK_SIZE,
    ],
  },);

  /**
   * ISO 9660 image carrying Autounattend.xml; consumed by Windows Setup at first boot.
   */
  const autounattendIso = createAutounattendIso({
    hostname: TEMPLATE_VM_NAME,
    imageIndex: spec.imageIndex,
  },);
  /**
   * On-disk location of the autounattend ISO; attached as a CDROM to the install VM.
   */
  const autounattendIsoPath = join(
    vmDir,
    'autounattend.iso',
  );
  await writeFile(
    autounattendIsoPath,
    autounattendIso,
  );

  /**
   * Libvirt domain XML for the install VM; boots from CDROM with SATA disk during Windows install.
   */
  const xml = domainXml({
    bootDev: 'cdrom',
    cdroms: [
      { path: windowsIsoPath, },
      { path: autounattendIsoPath, },
      { path: virtioWinPath, },
    ],
    diskBus: 'sata',
    diskPath,
    name: TEMPLATE_VM_NAME,
    osFamily: 'windows',
  },);

  await defineVm({
    vmDir,
    xml,
  },);
  await startVm({ name: TEMPLATE_VM_NAME, },);

  rl.info('Windows installation in progress (waiting for guest agent)...',);
  await waitForGuestAgent({
    name: TEMPLATE_VM_NAME,
    timeoutMs: WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS,
  },);

  // Install VirtioFsSvc dependencies via guest agent.
  // Cannot be done in autounattend FirstLogonCommands because the guest agent
  // starts at Order 2 and the template code shuts down the VM before later Orders complete.
  await installVirtioFs({
    rl,
    winfspMsiPath,
  },);

  // Phase 1 complete: Windows installed with SATA disk, VirtIO drivers installed.
  // Switch to VirtIO disk bus and verify Windows boots with VirtIO storage.
  await verifyVirtioBoot({
    vmDir,
    diskPath,
    rl,
  },);

  rl.info('converting disk to standalone template image...',);
  await spawn({
    command: 'qemu-img',
    args: [
      'convert',
      '-O',
      'qcow2',
      diskPath,
      templatePath,
    ],
  },);

  rl.info(`Windows template image saved to ${templatePath}`,);

  return templatePath;
}

//region VirtioFS installation helpers

/**
 * Milliseconds to wait between polling for guest-exec completion.
 */
const GUEST_EXEC_POLL_MS = 500;

/**
 * Runs a PowerShell command inside the template VM via guest agent and waits for completion.
 * Uses virsh directly because {@link exec} reads VM metadata which doesn't
 * exist yet during template creation.
 *
 * @param command - PowerShell command string
 *
 * @returns Exit code from the guest process
 *
 * @example
 * ```ts
 * await guestExecWait({ command: 'Get-Service QEMU-GA' });
 * ```
 */
async function guestExecWait({
  command,
}: {
  readonly command: string;
},): Promise<number> {
  /**
   * Full VM name with prefix.
   */
  const fullName = `${VM_PREFIX}${TEMPLATE_VM_NAME}`;

  /**
   * Raw JSON returned by `guest-exec`; contains the pid used to poll for completion.
   */
  const startResult = await virsh({
    args: [
      'qemu-agent-command',
      fullName,
      JSON.stringify({
        execute: 'guest-exec',
        arguments: {
          path: 'powershell.exe',
          arg: [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            command,
          ],
          'capture-output': true,
        },
      },),
    ],
  },);
  /**
   * Guest process id assigned by the QEMU guest agent; used to poll exec status.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
  const { pid, } = (JSON.parse(startResult,) as { return: { pid: number; }; }).return;

  while (true) {
    /**
     * Raw `guest-exec-status` response polled each iteration until the process exits.
     */
    // oxlint-disable-next-line no-await-in-loop -- deliberate serial polling loop
    const statusResult = await virsh({
      args: [
        'qemu-agent-command',
        fullName,
        JSON.stringify({
          execute: 'guest-exec-status',
          arguments: { pid, },
        },),
      ],
    },);
    /**
     * Parsed status payload exposing the `exited` flag and optional `exitcode`.
     */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
    const status = (JSON
      .parse(statusResult,) as { return: {
        exited: boolean;
        exitcode?: number;
      }; })
      .return;
    if (status.exited)
      return status.exitcode
        ?? 0;
    // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- deliberate serial polling with setTimeout
    await new Promise(function pollDelay(resolve,) {
      setTimeout(
        resolve,
        GUEST_EXEC_POLL_MS,
      );
    },);
  }
}

/**
 * Pushes a host file into the template VM via the guest agent file-write protocol.
 * Transfers the file in 1 MB base64-encoded chunks.
 *
 * @param guestPath - Destination path inside the guest
 *
 * @param hostPath - Source file path on the host
 *
 * @example
 * ```ts
 * await guestFilePush({ hostPath: '/tmp/winfsp.msi', guestPath: 'C:\\winfsp.msi' });
 * ```
 */
async function guestFilePush({
  guestPath,
  hostPath,
}: {
  readonly guestPath: string;
  readonly hostPath: string;
},): Promise<void> {
  /**
   * Prefixed libvirt domain name; matches what {@link defineVm} registered.
   */
  const fullName = `${VM_PREFIX}${TEMPLATE_VM_NAME}`;
  /**
   * Full host-file payload buffered in memory, then streamed to the guest in chunks.
   */
  const data = await readFile(hostPath,);

  /**
   * Open file on guest for writing.
   */
  const openResult = await virsh({
    args: [
      'qemu-agent-command',
      fullName,
      JSON.stringify({
        execute: 'guest-file-open',
        arguments: {
          path: guestPath,
          mode: 'wb',
        },
      },),
    ],
  },);
  /**
   * Numeric file handle returned by the guest agent; reused for every write and the close.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- QEMU guest agent JSON protocol response
  const handle = (JSON.parse(openResult,) as { return: number; }).return;

  /**
   * 48 KiB in bytes.
   */
  const RAW_CHUNK_KIB = 48;
  /**
   * Write in 48 KiB raw chunks (~65 KB base64, fits within virsh CLI arg limits).
   */
  const RAW_CHUNK: number = RAW_CHUNK_KIB * BYTES_PER_KIB;
  for (let offset = 0; offset < data
    .length; offset += RAW_CHUNK) {
    /**
     * Raw byte slice of the current chunk; zero-copy view into `data`.
     */
    const chunk = data.subarray(
      offset,
      offset + RAW_CHUNK,
    );
    /**
     * Base64-encoded chunk; the QMP protocol only carries text, so binary must be encoded.
     */
    const b64 = Buffer.from(chunk,)
      .toString('base64',);
    // oxlint-disable-next-line no-await-in-loop -- deliberate serial file transfer
    await virsh({
      args: [
        'qemu-agent-command',
        fullName,
        JSON.stringify({
          execute: 'guest-file-write',
          arguments: {
            handle,
            'buf-b64': b64,
          },
        },),
      ],
    },);
  }

  /**
   * Close the file handle.
   */
  await virsh({
    args: [
      'qemu-agent-command',
      fullName,
      JSON.stringify({
        execute: 'guest-file-close',
        arguments: { handle, },
      },),
    ],
  },);
}

/**
 * Installs VirtioFsSvc and its WinFsp dependency inside the template VM.
 * Pushes the WinFsp MSI via guest agent, installs it, then installs the
 * all-in-one VirtIO guest tools MSI from the attached virtio-win CDROM,
 * and configures VirtioFsSvc for automatic startup.
 *
 * @param rl - Tagged logger
 *
 * @param winfspMsiPath - Host path to the cached WinFsp MSI
 *
 * @example
 * ```ts
 * await installVirtioFs({ rl, winfspMsiPath: '/path/to/winfsp.msi' });
 * ```
 */
async function installVirtioFs({
  rl,
  winfspMsiPath,
}: {
  readonly rl: Logger;
  readonly winfspMsiPath: string;
},): Promise<void> {
  // Push WinFsp MSI to guest via file transfer (not on virtio-win ISO)
  rl.info('pushing WinFsp MSI to guest...',);
  await guestFilePush({
    guestPath: 'C:\\winfsp.msi',
    hostPath: winfspMsiPath,
  },);

  // Install WinFsp (required by VirtioFsSvc for drive letter mapping)
  rl.info('installing WinFsp...',);
  await guestExecWait({
    command:
      'Start-Process msiexec -ArgumentList /i,C:\\winfsp.msi,/qn,/norestart,INSTALLLEVEL=1000,/log,C:\\winfsp-install.log -Wait',
  },);

  // Install all-in-one guest tools MSI from virtio-win CDROM (provides VirtioFsSvc)
  rl.info('installing VirtIO guest tools MSI for VirtioFsSvc...',);
  await guestExecWait({
    command: [
      String
        .raw`$vd = Get-ChildItem -Path D:\,E:\,F:\,G:\ -Directory -Filter viostor -ErrorAction SilentlyContinue | Select-Object -First 1`,
      'if ($vd) { $gt = Join-Path $vd.Parent.FullName virtio-win-gt-x64.msi',
      String
        .raw`Start-Process msiexec -ArgumentList /i,$gt,/qn,/norestart,/log,C:\gt-install.log -Wait }`,
    ]
      .join('; ',),
  },);

  // Configure VirtioFsSvc for automatic startup
  rl.info('configuring VirtioFsSvc for automatic startup...',);
  await guestExecWait({
    command:
      'Set-Service -Name VirtioFsSvc -StartupType Automatic -ErrorAction SilentlyContinue',
  },);
}

//endregion VirtioFS installation helpers
