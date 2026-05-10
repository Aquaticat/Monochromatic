#!/usr/bin/env bun
import { message, } from '@optique/core/message';
import { runSync, } from '@optique/run';

import { clone, } from './clone.ts';
import { create, } from './create.ts';
import {
  destroy,
  destroyAll,
} from './destroy.ts';
import { exec, } from './exec.ts';
import {
  pullFile,
  pushFile,
} from './file-transfer.ts';
import { parser, } from './index-parsers.ts';
import { list, } from './list.ts';
import { run, } from './run.ts';
import { shell, } from './shell.ts';
import { update, } from './update.ts';

export {};

//region Verbose flag: stripped before parsing; logger detects it from raw process.argv at import time

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
const INFRA_FLAGS: ReadonlySet<string> = new Set(['--verbose',],);

/** Raw args after the script name. */
const rawArgs = process.argv.slice(2,);

/**
 * Index of the `--` separator, or end-of-args when absent.
 * Infrastructure flags are only stripped before this boundary.
 */
const doubleDashIndex = rawArgs.indexOf('--',);

/** Boundary past which tokens belong to the VM command and must not be touched. */
const boundary = doubleDashIndex === -1 ? rawArgs.length : doubleDashIndex;

/**
 * Process argv with infrastructure flags removed only from the mvm-owned prefix.
 * The logger caches its own `process.argv` check at module load time
 * (before this runs), so stripping here only affects the \@optique parser.
 */
const filteredArgs = rawArgs.filter(function keepNonInfraArgs(
  arg,
  i,
) {
  return i >= boundary || !INFRA_FLAGS.has(arg,);
},);

//endregion Verbose flag

//region Dispatch: parse argv and route to the appropriate handler

/** Parsed CLI result from process.argv */
const args = runSync(
  parser,
  {
    programName: 'mvm',
    args: filteredArgs,
    help: 'option',
    aboveError: 'help',
    brief: message`mvm - ephemeral VM manager`,
    footer: message`Pass --verbose before the subcommand to enable debug logging.`,
  },
);

if (args.cmd === 'create') {
  await (args.from !== undefined
    ? clone({
      destination: args.name,
      source: args.from,
    },)
    : create({
      image: args.image,
      name: args.name,
    },));
}
else if (args.cmd === 'shell')
  await shell({ name: args.name, },);
else if (args.cmd === 'list') {
  /** All managed VMs queried from libvirt. */
  const vms = await list();
  if (vms.length === 0)
    console.error('no VMs found',);
  else {
    /** Column width for aligned output. */
    const NAME_COL_WIDTH = 24;
    vms.forEach(function printVm(vm,) {
      console.log(`${vm.name.padEnd(NAME_COL_WIDTH,)} ${vm.state}`,);
    },);
  }
}
else if (args.cmd === 'update')
  await update();
else if (args.cmd === 'destroy') {
  if (args.all)
    await destroyAll();
  else if (args.name !== undefined)
    await destroy({ name: args.name, },);
  else
    throw new Error('usage: mvm destroy <name> | --all',);
}
else if (args.cmd === 'exec') {
  /** Execution result with stdout, stderr, and exit code. */
  const result = await exec({
    command: args.command,
    name: args.name,
  },);
  if (result.stdout.length > 0)
    process.stdout.write(result.stdout,);
  if (result.stderr.length > 0)
    process.stderr.write(result.stderr,);
  if (result.exitCode !== 0)
    process.exitCode = result.exitCode;
}
else if (args.cmd === 'push') {
  /** Guest path where the file is accessible inside the VM. */
  const guestFilePath = await pushFile({
    name: args.name,
    hostPath: args.hostPath,
    guestPath: args.guestPath,
  },);
  console.log(`pushed ${args.hostPath} -> ${guestFilePath} in VM ${args.name}`,);
}
else if (args.cmd === 'pull') {
  /** File content retrieved from the guest. */
  const content = await pullFile({
    name: args.name,
    guestPath: args.guestPath,
  },);
  const { writeFile, } = await import('node:fs/promises');
  await writeFile(
    args.hostPath,
    content,
  );
  console.log(`pulled ${args.guestPath} -> ${args.hostPath} from VM ${args.name}`,);
}
else {
  /** Execution result from the ephemeral VM. */
  const result = await run({
    command: args.command,
    from: args.from,
  },);
  if (result.stdout.length > 0)
    process.stdout.write(result.stdout,);
  if (result.stderr.length > 0)
    process.stderr.write(result.stderr,);
  if (result.exitCode !== 0)
    process.exitCode = result.exitCode;
}

//endregion Dispatch
