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
  return `<domain type='kvm'>
  <name>${VM_PREFIX}${name}</name>
  <memory unit='MiB'>${DEFAULT_MEMORY_MIB}</memory>
  <vcpu>${DEFAULT_VCPUS}</vcpu>
  <os>
    <type arch='x86_64'>hvm</type>
    <boot dev='hd'/>
  </os>
  <features>
    <acpi/>
  </features>
  <devices>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='${diskPath}'/>
      <target dev='vda' bus='virtio'/>
    </disk>
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='${seedIsoPath}'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>
    <interface type='network'>
      <source network='default'/>
      <model type='virtio'/>
    </interface>
    <serial type='pty'>
      <target port='0'/>
    </serial>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
  </devices>
</domain>`;
}
