import { $ as h } from '@monochromatic-dev/module-es/h-xml';

import {
  DEFAULT_MEMORY_MIB,
  DEFAULT_VCPUS,
  VM_PREFIX,
} from './config.ts';
import type { OsFamily } from './registry.ts';

//region Hyper-V enlightenments

/**
 * Generates libvirt XML elements for Hyper-V enlightenments.
 * These are performance optimizations recognized by the Windows kernel
 * that reduce virtualization overhead for timer handling, interrupt
 * processing, and spinlock contention.
 *
 * @returns Array of XML element strings for the `<features>` block
 *
 * @example
 * ```ts
 * hypervFeatures(); // => [h({ tag: 'hyperv', children: [...] })]
 * ```
 */
function hypervFeatures(): string {
  return h({
    tag: 'hyperv',
    attrs: { mode: 'custom' },
    children: [
      h({ tag: 'relaxed', attrs: { state: 'on' } }),
      h({ tag: 'vapic', attrs: { state: 'on' } }),
      h({ tag: 'spinlocks', attrs: { state: 'on', retries: '8191' } }),
    ],
  });
}

//endregion Hyper-V enlightenments

//region Clock configuration

/**
 * Generates the clock XML element appropriate for the guest OS.
 * Linux uses UTC offset; Windows expects localtime with a Hyper-V
 * reference clock for accurate timekeeping.
 *
 * @param osFamily - Guest OS family
 * @returns XML string for the `<clock>` element
 *
 * @example
 * ```ts
 * clockElement('windows'); // => '<clock offset="localtime">...'
 * clockElement('linux');   // => '<clock offset="utc"/>'
 * ```
 */
function clockElement(osFamily: OsFamily): string {
  if (osFamily === 'windows') {
    return h({
      tag: 'clock',
      attrs: { offset: 'localtime' },
      children: [
        h({ tag: 'timer', attrs: { name: 'hypervclock', present: 'yes' } }),
        h({ tag: 'timer', attrs: { name: 'hpet', present: 'no' } }),
      ],
    });
  }
  return h({ tag: 'clock', attrs: { offset: 'utc' } });
}

//endregion Clock configuration

//region CDROM devices

/**
 * Path to a CDROM ISO to attach as an IDE device.
 *
 * @example
 * ```ts
 * const cdroms: ReadonlyArray<CdromSpec> = [
 *   { path: '/path/to/windows.iso' },
 *   { path: '/path/to/virtio-win.iso' },
 * ];
 * ```
 */
export type CdromSpec = {
  /** Absolute path to the ISO file. */
  path: string;
};

/**
 * Generates IDE CDROM device elements for the given ISO paths.
 * Assigns sequential IDE device names (hda, hdb, hdc, hdd).
 *
 * @param cdroms - Array of CDROM specs with ISO paths
 * @returns Array of XML strings for disk elements
 *
 * @example
 * ```ts
 * ideCdromDevices([{ path: '/tmp/win.iso' }]); // => ['<disk type="file" device="cdrom">...']
 * ```
 */
function ideCdromDevices(cdroms: ReadonlyArray<CdromSpec>): ReadonlyArray<string> {
  /** IDE device name sequence: hda through hdd. */
  const ideDevNames = ['hda', 'hdb', 'hdc', 'hdd'];
  return cdroms.map((cdrom, index) =>
    h({
      tag: 'disk',
      attrs: { type: 'file', device: 'cdrom' },
      children: [
        h({ tag: 'driver', attrs: { name: 'qemu', type: 'raw' } }),
        h({ tag: 'source', attrs: { file: cdrom.path } }),
        h({ tag: 'target', attrs: { dev: ideDevNames[index]!, bus: 'ide' } }),
        h({ tag: 'readonly' }),
      ],
    }),
  );
}

//endregion CDROM devices

//region Domain XML generator

/**
 * Generates a libvirt domain XML definition for a KVM virtual machine.
 * Supports both Linux and Windows guests with OS-specific optimizations.
 *
 * For Linux guests: configures virtio disk and NIC, serial console,
 * and an optional cloud-init seed CDROM.
 *
 * For Windows guests: adds Hyper-V enlightenments, localtime clock,
 * and optional IDE CDROMs for installation media (Windows ISO, autounattend,
 * virtio-win ISO).
 *
 * @param options - VM configuration including disk path, name, optional seed ISO,
 *   OS family, boot device, and additional CDROMs
 * @returns Complete libvirt domain XML string
 *
 * @example
 * ```ts
 * // Linux VM with cloud-init seed
 * domainXml({ name: 'dev', diskPath: '/path/disk.qcow2', seedIsoPath: '/path/seed.iso' });
 *
 * // Windows VM (normal boot)
 * domainXml({ name: 'win', diskPath: '/path/disk.qcow2', osFamily: 'windows' });
 *
 * // Windows template creation (boot from ISO)
 * domainXml({
 *   name: 'template',
 *   diskPath: '/path/disk.qcow2',
 *   osFamily: 'windows',
 *   bootDev: 'cdrom',
 *   cdroms: [{ path: '/path/win.iso' }, { path: '/path/autounattend.iso' }, { path: '/path/virtio.iso' }],
 * });
 * ```
 */
export function domainXml({ bootDev = 'hd', cdroms = [], diskPath, name, osFamily = 'linux', seedIsoPath }: {
  /** Boot device: `hd` for normal operation, `cdrom` for ISO-based installation. */
  bootDev?: 'cdrom' | 'hd';
  /** Additional IDE CDROMs (Windows ISO, autounattend, virtio-win). */
  cdroms?: ReadonlyArray<CdromSpec>;
  /** Absolute path to the VM disk image. */
  diskPath: string;
  /** VM name without the mvm- prefix. */
  name: string;
  /** Guest OS family for platform-specific optimizations. */
  osFamily?: OsFamily;
  /** Absolute path to the cloud-init seed ISO (Linux only, omitted for Windows). */
  seedIsoPath?: string | undefined;
}): string {
  const features = [h({ tag: 'acpi' })];
  if (osFamily === 'windows') {
    features.push(hypervFeatures());
  }

  const devices: string[] = [
    // Main disk: VirtIO for performance (Windows gets drivers from virtio-win)
    h({
      tag: 'disk',
      attrs: { type: 'file', device: 'disk' },
      children: [
        h({ tag: 'driver', attrs: { name: 'qemu', type: 'qcow2' } }),
        h({ tag: 'source', attrs: { file: diskPath } }),
        h({ tag: 'target', attrs: { dev: 'vda', bus: 'virtio' } }),
      ],
    }),
  ];

  // Cloud-init NoCloud seed ISO for Linux VMs
  if (seedIsoPath !== undefined) {
    devices.push(
      h({
        tag: 'disk',
        attrs: { type: 'file', device: 'cdrom' },
        children: [
          h({ tag: 'driver', attrs: { name: 'qemu', type: 'raw' } }),
          h({ tag: 'source', attrs: { file: seedIsoPath } }),
          h({ tag: 'target', attrs: { dev: 'sda', bus: 'sata' } }),
          h({ tag: 'readonly' }),
        ],
      }),
    );
  }

  // IDE CDROMs for Windows template creation (Windows ISO, autounattend, virtio-win)
  devices.push(...ideCdromDevices(cdroms));

  // SLIRP user-mode networking for outbound internet without bridge setup
  devices.push(
    h({
      tag: 'interface',
      attrs: { type: 'user' },
      children: [
        h({ tag: 'model', attrs: { type: 'virtio' } }),
      ],
    }),
  );

  // Guest agent channel for command execution via `virsh qemu-agent-command`
  devices.push(
    h({
      tag: 'channel',
      attrs: { type: 'unix' },
      children: [
        h({ tag: 'target', attrs: { type: 'virtio', name: 'org.qemu.guest_agent.0' } }),
      ],
    }),
  );

  // Serial console for interactive shell via `virsh console` (primarily for Linux)
  devices.push(
    h({
      tag: 'serial',
      attrs: { type: 'pty' },
      children: [
        h({ tag: 'target', attrs: { port: '0' } }),
      ],
    }),
    h({
      tag: 'console',
      attrs: { type: 'pty' },
      children: [
        h({ tag: 'target', attrs: { type: 'serial', port: '0' } }),
      ],
    }),
  );

  // Tablet input device to prevent mouse pointer offset in Windows
  if (osFamily === 'windows') {
    devices.push(
      h({
        tag: 'input',
        attrs: { type: 'tablet', bus: 'usb' },
      }),
    );
  }

  return h({
    tag: 'domain',
    attrs: { type: 'kvm' },
    children: [
      h({ tag: 'name', text: `${VM_PREFIX}${name}` }),
      h({ tag: 'memory', attrs: { unit: 'MiB' }, text: String(DEFAULT_MEMORY_MIB) }),
      h({ tag: 'vcpu', text: String(DEFAULT_VCPUS) }),
      h({
        tag: 'os',
        children: [
          h({ tag: 'type', attrs: { arch: 'x86_64' }, text: 'hvm' }),
          h({ tag: 'boot', attrs: { dev: bootDev } }),
        ],
      }),
      // Bun requires AVX
      h({ tag: 'cpu', attrs: { mode: 'host-passthrough' } }),
      // ACPI enables graceful shutdown during template baking (template.ts)
      h({
        tag: 'features',
        children: features,
      }),
      clockElement(osFamily),
      h({
        tag: 'devices',
        children: devices,
      }),
    ],
  });
}

//endregion Domain XML generator
