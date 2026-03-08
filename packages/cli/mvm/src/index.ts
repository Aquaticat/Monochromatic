#!/usr/bin/env bun
import { object, or } from '@optique/core/constructs';
import { message } from '@optique/core/message';
import { map, multiple, optional } from '@optique/core/modifiers';
import { argument, command, flag, option } from '@optique/core/primitives';
import { string } from '@optique/core/valueparser';
import { runSync } from '@optique/run';

import { clone } from './clone.ts';
import { create } from './create.ts';
import { destroy, destroyAll } from './destroy.ts';
import { ephemeralExec } from './ephemeral-exec.ts';
import { exec } from './exec.ts';
import { list } from './list.ts';
import { shell } from './shell.ts';

export {};

//region Verbose flag -- stripped before parsing; logger detects it from raw process.argv at import time

/**
 * Flags consumed by infrastructure (logger) rather than the argument parser.
 * Only stripped from tokens before `--` so that VM commands like
 * `mvm exec myvm -- --verbose cmd` preserve `--verbose` for the guest.
 *
 * @example
 * ```ts
 * INFRA_FLAGS.has('--verbose'); // true
 * ```
 */
const INFRA_FLAGS: ReadonlySet<string> = new Set(['--verbose']);

/** Raw args after the script name. */
const rawArgs = process.argv.slice(2);

/**
 * Index of the `--` separator, or end-of-args when absent.
 * Infrastructure flags are only stripped before this boundary.
 */
const doubleDashIndex = rawArgs.indexOf('--');

/** Boundary past which tokens belong to the VM command and must not be touched. */
const boundary = doubleDashIndex === -1 ? rawArgs.length : doubleDashIndex;

/**
 * Process argv with infrastructure flags removed only from the mvm-owned prefix.
 * The logger caches its own `process.argv` check at module load time
 * (before this runs), so stripping here only affects the @optique parser.
 */
const filteredArgs = rawArgs.filter((arg, i) => i >= boundary || !INFRA_FLAGS.has(arg));

//endregion Verbose flag

//region Result types -- discriminated union for subcommand dispatch

/** Discriminated union of all subcommand parse results */
type MvmArgs =
  | { cmd: 'create'; name: string; from: string | undefined }
  | { cmd: 'shell'; name: string }
  | { cmd: 'list' }
  | { cmd: 'destroy'; name: string | undefined; all: boolean }
  | { cmd: 'exec'; name: string; command: string; destroy: false }
  | { cmd: 'exec'; command: string; destroy: true; from: string | undefined };

//endregion Result types

//region Shared value parsers -- reusable metavar-labeled string parsers

/** Value parser for VM name arguments, displayed as NAME in help */
const name = string({ metavar: 'NAME' });

/** Shared option parser for `--from SOURCE` cloning flag */
const fromOption = optional(option('--from', string({ metavar: 'SOURCE' }), { description: message`Clone from an existing VM instead of creating fresh` }));

//endregion Shared value parsers

//region Parser definition -- subcommand parsers combined via or()

/** Parser for `create <name> [--from SOURCE]` */
const createCmd = command('create', map(
  object({ name: argument(name), from: fromOption }),
  (v): MvmArgs => ({ cmd: 'create', ...v }),
), { brief: message`Create and start a new Ubuntu VM` });

/** Parser for `shell <name>` */
const shellCmd = command('shell', map(
  object({ name: argument(name) }),
  (v): MvmArgs => ({ cmd: 'shell', ...v }),
), { brief: message`Open a serial console to a running VM` });

/** Parser for `list` (alias `ls`) */
const listCmd = command('list', map(
  object({}),
  (): MvmArgs => ({ cmd: 'list' }),
), { brief: message`Show all VMs and their state` });

/** Parser for `ls` (hidden alias of `list`) */
const lsCmd = command('ls', map(
  object({}),
  (): MvmArgs => ({ cmd: 'list' }),
), { hidden: true });

/** Parser for `destroy --all` -- destroys every managed VM */
const destroyAllParser = map(
  object({ all: flag('--all', { description: message`Destroy every managed VM` }) }),
  (): MvmArgs => ({ cmd: 'destroy', name: undefined, all: true }),
);

/** Parser for `destroy <name>` -- destroys a single VM by name */
const destroyNameParser = map(
  object({ name: argument(name) }),
  (v): MvmArgs => ({ cmd: 'destroy', name: v.name, all: false }),
);

/** Parser for `destroy` */
const destroyCmd = command('destroy', or(
  destroyAllParser,
  destroyNameParser,
), { brief: message`Stop and delete a VM` });

/** Parser for `rm` (hidden alias of `destroy`) */
const rmCmd = command('rm', or(
  destroyAllParser,
  destroyNameParser,
), { hidden: true });

/** Value parser for individual command tokens after `--`, displayed as COMMAND in help */
const commandToken = string({ metavar: 'COMMAND' });

/** Parser for `exec --destroy [--from SOURCE] -- <command...>` -- ephemeral VM */
const execDestroyParser = map(
  object({
    _destroy: flag('--destroy', { description: message`Create an ephemeral VM, execute, then destroy it` }),
    from: fromOption,
    args: multiple(argument(commandToken)),
  }),
  (v): MvmArgs => ({ cmd: 'exec', command: v.args.join(' '), destroy: true, from: v.from }),
);

/** Parser for `exec <name> -- <command...>` -- existing VM */
const execDirectParser = map(
  object({ name: argument(name), args: multiple(argument(commandToken)) }),
  (v): MvmArgs => ({ cmd: 'exec', name: v.name, command: v.args.join(' '), destroy: false }),
);

/** Parser for `exec` subcommand (ephemeral or direct) */
const execCmd = command('exec', or(
  execDestroyParser,
  execDirectParser,
), { brief: message`Run a command inside a VM via guest agent` });

/** Combined top-level parser across all subcommands */
const parser = or(
  createCmd,
  shellCmd,
  listCmd,
  lsCmd,
  destroyCmd,
  rmCmd,
  execCmd,
);

//endregion Parser definition

//region Dispatch -- parse argv and route to the appropriate handler

/** Parsed CLI result from process.argv */
const args = runSync(parser, {
  programName: 'mvm',
  args: filteredArgs,
  help: 'option',
  aboveError: 'help',
  brief: message`mvm - ephemeral Ubuntu VM manager`,
  footer: message`Pass --verbose before the subcommand to enable debug logging.`,
}) as MvmArgs;

if (args.cmd === 'create') {
  if (args.from !== undefined) {
    await clone({ destination: args.name, source: args.from });
  } else {
    await create({ name: args.name });
  }
} else if (args.cmd === 'shell') {
  await shell({ name: args.name });
} else if (args.cmd === 'list') {
  const vms = await list();
  if (vms.length === 0) {
    console.error('no VMs found');
  } else {
    /** Column width for aligned output. */
    const NAME_COL_WIDTH = 24;
    for (const vm of vms) {
      console.log(`${vm.name.padEnd(NAME_COL_WIDTH)} ${vm.state}`);
    }
  }
} else if (args.cmd === 'destroy') {
  if (args.all) {
    await destroyAll();
  } else if (args.name !== undefined) {
    await destroy({ name: args.name });
  } else {
    throw new Error('usage: mvm destroy <name> | --all');
  }
} else if (args.cmd === 'exec') {
  const result = args.destroy
    ? await ephemeralExec({ command: args.command, from: args.from })
    : await exec({ command: args.command, name: args.name });
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

//endregion Dispatch
