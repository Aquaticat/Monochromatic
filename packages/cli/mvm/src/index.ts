#!/usr/bin/env bun
import { object, or, tuple } from '@optique/core/constructs';
import { map, optional } from '@optique/core/modifiers';
import { argument, command, passThrough } from '@optique/core/primitives';
import { string } from '@optique/core/valueparser';
import { runSync } from '@optique/run';

import { clone } from './clone.ts';
import { create } from './create.ts';
import { destroy, destroyAll } from './destroy.ts';
import { exec } from './exec.ts';
import { list } from './list.ts';
import { shell } from './shell.ts';

export {};

//region Result types -- discriminated union for subcommand dispatch

/** Discriminated union of all subcommand parse results */
type MvmArgs =
  | { cmd: 'create'; name: string }
  | { cmd: 'shell'; name: string }
  | { cmd: 'list' }
  | { cmd: 'destroy'; name: string | undefined; all: boolean }
  | { cmd: 'exec'; name: string; command: string }
  | { cmd: 'clone'; source: string; destination: string };

//endregion Result types

//region Parser definition -- subcommand parsers combined via or()

/** Parser for `create <name>` */
const createCmd = command('create', map(
  object({ name: argument(string()) }),
  (v): MvmArgs => ({ cmd: 'create', ...v }),
));

/** Parser for `shell <name>` */
const shellCmd = command('shell', map(
  object({ name: argument(string()) }),
  (v): MvmArgs => ({ cmd: 'shell', ...v }),
));

/** Parser for `list` (alias `ls`) */
const listCmd = command('list', map(
  object({}),
  (): MvmArgs => ({ cmd: 'list' }),
));

/** Parser for `ls` alias */
const lsCmd = command('ls', map(
  object({}),
  (): MvmArgs => ({ cmd: 'list' }),
));

/** Parser for `destroy [--all | <name>]` (alias `rm`) */
const destroyParser = map(
  object({ all: optional(argument(string())) }),
  (v): MvmArgs => ({
    cmd: 'destroy',
    name: v.all === '--all' ? undefined : v.all,
    all: v.all === '--all',
  }),
);

/** Parser for `destroy` */
const destroyCmd = command('destroy', destroyParser);

/** Parser for `rm` alias */
const rmCmd = command('rm', destroyParser);

/** Parser for `exec <name> <command...>` */
const execCmd = command('exec', map(
  tuple([argument(string()), passThrough({ format: 'greedy' })]),
  ([name, rest]): MvmArgs => ({ cmd: 'exec', name, command: rest.join(' ') }),
));

/** Parser for `clone <source> <dest>` */
const cloneCmd = command('clone', map(
  object({ source: argument(string()), destination: argument(string()) }),
  (v): MvmArgs => ({ cmd: 'clone', ...v }),
));

/** Combined top-level parser across all subcommands */
const parser = or(
  createCmd,
  shellCmd,
  listCmd,
  lsCmd,
  destroyCmd,
  rmCmd,
  execCmd,
  cloneCmd,
);

//endregion Parser definition

//region Dispatch -- parse argv and route to the appropriate handler

/** Parsed CLI result from process.argv */
const args = runSync(parser, {
  programName: 'mvm',
  help: 'option',
  brief: ['mvm - ephemeral Ubuntu VM manager'],
}) as MvmArgs;

if (args.cmd === 'create') {
  await create({ name: args.name });
} else if (args.cmd === 'shell') {
  await shell({ name: args.name });
} else if (args.cmd === 'list') {
  await list();
} else if (args.cmd === 'destroy') {
  if (args.all) {
    await destroyAll();
  } else if (args.name !== undefined) {
    await destroy({ name: args.name });
  } else {
    throw new Error('usage: mvm destroy <name> | --all');
  }
} else if (args.cmd === 'exec') {
  await exec({ command: args.command, name: args.name });
} else if (args.cmd === 'clone') {
  await clone({ destination: args.destination, source: args.source });
}

//endregion Dispatch
