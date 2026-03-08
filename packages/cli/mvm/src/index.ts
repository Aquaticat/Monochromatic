#!/usr/bin/env bun
import { parseArgs } from 'node:util';

import { clone } from './clone.ts';
import { create } from './create.ts';
import { destroy, destroyAll } from './destroy.ts';
import { exec } from './exec.ts';
import { list } from './list.ts';
import { l, tagged } from './log.ts';
import { shell } from './shell.ts';

export {};

/** Usage help text displayed when no command is provided or command is unknown. */
const USAGE = `mvm - ephemeral Ubuntu VM manager

Usage: mvm <command> [args]

Commands:
  create <name>              Create and start a new Ubuntu VM
  shell <name>               Connect to a running VM (Ctrl+] to disconnect)
  list                       List all managed VMs
  destroy <name>             Destroy a VM and all its storage
  destroy --all              Destroy all managed VMs
  exec <name> <command...>    Execute a command in a VM and print output
  clone <source> <dest>      Clone an existing VM to a new name

Prerequisites:
  - KVM support (/dev/kvm)
  - libvirt
  - qemu-img

Console access uses virsh console with auto-login (no SSH needed).
Uses qemu:///session (user-mode) so no root or polkit prompts are needed.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  args: Bun.argv.slice(2),
  options: {
    all: { type: 'boolean', },
    help: { type: 'boolean', short: 'h', },
  },
  strict: false,
});

const command = positionals[0];

const rl = tagged({ tag: 'cli', l, });

if (command === undefined || command === 'help' || command === '--help') {
  rl.info(USAGE);
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
  if (values.all === true) {
    await destroyAll();
  } else {
    const name = positionals[1];
    if (name === undefined) {
      throw new Error('usage: mvm destroy <name> | --all');
    }
    await destroy({ name, });
  }
} else if (command === 'exec') {
  const name = positionals[1];
  if (name === undefined || positionals.length < 3) {
    throw new Error('usage: mvm exec <name> <command...>');
  }
  const cmd = positionals.slice(2).join(' ');
  await exec({ command: cmd, name, });
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
