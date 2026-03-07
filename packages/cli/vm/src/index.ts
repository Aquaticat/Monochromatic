import { parseArgs } from 'node:util';

import { clone } from './clone.ts';
import { create } from './create.ts';
import { destroy } from './destroy.ts';
import { list } from './list.ts';
import { shell } from './shell.ts';

export {};

/** Usage help text displayed when no command is provided or command is unknown. */
const USAGE = `mvm - ephemeral Ubuntu VM manager

Usage: mvm <command> [args]

Commands:
  create <name>              Create and start a new Ubuntu VM
  shell <name>               SSH into a running VM
  list                       List all managed VMs
  destroy <name>             Destroy a VM and all its storage
  clone <source> <dest>      Clone an existing VM to a new name

Prerequisites:
  - KVM support (/dev/kvm)
  - libvirt with default network active
  - qemu-img
  - SSH public key in ~/.ssh/

The user must be in the 'libvirt' group for passwordless access.`;

const { positionals } = parseArgs({
  allowPositionals: true,
  args: Bun.argv.slice(2),
  options: {
    help: { type: 'boolean', short: 'h', },
  },
  strict: false,
});

const command = positionals[0];

if (command === undefined || command === 'help' || command === '--help') {
  console.error(USAGE);
} else if (command === 'create') {
  const name = positionals[1];
  if (name === undefined) {
    throw new Error('usage: mvm create <name>');
  }
  await create({ name, });
} else if (command === 'shell') {
  const name = positionals[1];
  if (name === undefined) {
    throw new Error('usage: mvm shell <name>');
  }
  await shell({ name, });
} else if (command === 'list' || command === 'ls') {
  await list();
} else if (command === 'destroy' || command === 'rm') {
  const name = positionals[1];
  if (name === undefined) {
    throw new Error('usage: mvm destroy <name>');
  }
  await destroy({ name, });
} else if (command === 'clone') {
  const source = positionals[1];
  const destination = positionals[2];
  if (source === undefined || destination === undefined) {
    throw new Error('usage: mvm clone <source> <dest>');
  }
  await clone({ destination, source, });
} else {
  throw new Error(`unknown command: ${command}\n\n${USAGE}`);
}
