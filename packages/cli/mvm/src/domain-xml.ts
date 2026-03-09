import { $ as h } from '@monochromatic-dev/module-es/h-xml';

import {
  DEFAULT_MEMORY_MIB,
  DEFAULT_VCPUS,
  VM_PREFIX,
} from './config.ts';

/**
 * Generates a libvirt domain XML definition for a KVM virtual machine.
 * Configures virtio disk and NIC, serial console, and a cloud-init seed CDROM.
 *
 * @param options - VM name (without prefix), disk path, and seed ISO path
 * @returns Complete libvirt domain XML string
 *
 * @example
 * ```ts
 * const xml = domainXml({
 *   name: 'test',
 *   diskPath: '/path/to/disk.qcow2',
 *   seedIsoPath: '/path/to/seed.iso',
 * });
 * ```
 */
export function domainXml({ diskPath, name, seedIsoPath }: {
  diskPath: string;
  name: string;
  seedIsoPath: string;
}): string {
  return h({
    tag: 'domain',
    attrs: { type: 'kvm', },
    children: [
      h({ tag: 'name', text: `${VM_PREFIX}${name}`, }),
      h({ tag: 'memory', attrs: { unit: 'MiB', }, text: String(DEFAULT_MEMORY_MIB), }),
      h({ tag: 'vcpu', text: String(DEFAULT_VCPUS), }),
      h({
        tag: 'os',
        children: [
          h({ tag: 'type', attrs: { arch: 'x86_64', }, text: 'hvm', }),
          h({ tag: 'boot', attrs: { dev: 'hd', }, }),
        ],
      }),
      // Bun requires AVX
      h({ tag: 'cpu', attrs: { mode: 'host-passthrough', }, }),
      h({
        tag: 'features',
        children: [
          h({ tag: 'acpi', }),
        ],
      }),
      h({
        tag: 'devices',
        children: [
          h({
            tag: 'disk',
            attrs: { type: 'file', device: 'disk', },
            children: [
              h({ tag: 'driver', attrs: { name: 'qemu', type: 'qcow2', }, }),
              h({ tag: 'source', attrs: { file: diskPath, }, }),
              h({ tag: 'target', attrs: { dev: 'vda', bus: 'virtio', }, }),
            ],
          }),
          h({
            tag: 'disk',
            attrs: { type: 'file', device: 'cdrom', },
            children: [
              h({ tag: 'driver', attrs: { name: 'qemu', type: 'raw', }, }),
              h({ tag: 'source', attrs: { file: seedIsoPath, }, }),
              h({ tag: 'target', attrs: { dev: 'sda', bus: 'sata', }, }),
              h({ tag: 'readonly', }),
            ],
          }),
          h({
            tag: 'interface',
            attrs: { type: 'user', },
            children: [
              h({ tag: 'model', attrs: { type: 'virtio', }, }),
            ],
          }),
          h({
            tag: 'channel',
            attrs: { type: 'unix', },
            children: [
              h({ tag: 'target', attrs: { type: 'virtio', name: 'org.qemu.guest_agent.0', }, }),
            ],
          }),
          h({
            tag: 'serial',
            attrs: { type: 'pty', },
            children: [
              h({ tag: 'target', attrs: { port: '0', }, }),
            ],
          }),
          h({
            tag: 'console',
            attrs: { type: 'pty', },
            children: [
              h({ tag: 'target', attrs: { type: 'serial', port: '0', }, }),
            ],
          }),
        ],
      }),
    ],
  });
}
