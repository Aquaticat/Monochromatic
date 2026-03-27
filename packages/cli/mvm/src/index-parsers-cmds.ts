/**
 * Subcommand parser definitions for the mvm CLI.
 *
 * Defines individual subcommand parsers that are combined into
 * the top-level parser in `index-parsers.ts`.
 *
 * @module
 */

import {
  object,
  or,
} from '@optique/core/constructs';
import { message, } from '@optique/core/message';
import {
  map,
  multiple,
  optional,
} from '@optique/core/modifiers';
import {
  argument,
  command,
  flag,
  option,
} from '@optique/core/primitives';
import { string, } from '@optique/core/valueparser';

import type { MvmArgs, } from './index-parsers.ts';

//region Shared value parsers -- reusable metavar-labeled string parsers

/** Value parser for VM name arguments, displayed as NAME in help */
const name = string({ metavar: 'NAME', },);

/** Shared option parser for `--from SOURCE` cloning flag */
const fromOption = optional(
  option(
    '--from',
    string({ metavar: 'SOURCE', },),
    {
    description: message`Clone from an existing VM instead of creating fresh`,
  },
  ),
);

/** Option parser for `--image IMAGE` to select a distro */
const imageOption = optional(
  option(
    '--image',
    string({ metavar: 'IMAGE', },),
    {
    description:
      message`Image to use: ubuntu (default), fedora, alpine, windows, or a custom template name`,
  },
  ),
);

/** Value parser for individual command tokens after `--`, displayed as COMMAND in help */
const commandToken = string({ metavar: 'COMMAND', },);

//endregion Shared value parsers

//region Subcommand parsers

/** Parser for `create <name> [--from SOURCE] [--image IMAGE]` */
export const createCmd = command(
  'create',
  map(
  object({ name: argument(name,), from: fromOption, image: imageOption, },),
  function toCreateArgs(
    v: { name: string; from: string | undefined; image: string | undefined; },
  ): MvmArgs {
    return { cmd: 'create', from: v.from, image: v.image, name: v.name, };
  },
),
  { brief: message`Create and start a new VM`, },
);

/** Parser for `shell <name>` */
export const shellCmd = command(
  'shell',
  map(
  object({ name: argument(name,), },),
  function toShellArgs(v: { name: string; },): MvmArgs {
    return { cmd: 'shell', ...v, };
  },
),
  { brief: message`Open a serial console to a running VM`, },
);

/** Parser for `list` (alias `ls`) */
export const listCmd = command(
  'list',
  map(
  object({},),
  function toListArgs(): MvmArgs {
    return { cmd: 'list', };
  },
),
  { brief: message`Show all VMs and their state`, },
);

/** Parser for `ls` (hidden alias of `list`) */
export const lsCmd = command(
  'ls',
  map(
  object({},),
  function toLsArgs(): MvmArgs {
    return { cmd: 'list', };
  },
),
  { hidden: true, },
);

/** Parser for `destroy --all` -- destroys every managed VM */
const destroyAllParser = map(
  object({ all: flag(
    '--all',
    { description: message`Destroy every managed VM`, },
  ), },),
  function toDestroyAllArgs(): MvmArgs {
    return {
      cmd: 'destroy',
      name: undefined,
      all: true,
    };
  },
);

/** Parser for `destroy <name>` -- destroys a single VM by name */
const destroyNameParser = map(
  object({ name: argument(name,), },),
  function toDestroyNameArgs(v: { name: string; },): MvmArgs {
    return {
      cmd: 'destroy',
      name: v.name,
      all: false,
    };
  },
);

/** Parser for `destroy` */
export const destroyCmd = command(
  'destroy',
  or(
  destroyAllParser,
  destroyNameParser,
),
  { brief: message`Stop and delete a VM`, },
);

/** Parser for `rm` (hidden alias of `destroy`) */
export const rmCmd = command(
  'rm',
  or(
  destroyAllParser,
  destroyNameParser,
),
  { hidden: true, },
);

/** Parser for `exec <name> -- <command...>` -- run a command in an existing VM */
export const execCmd = command(
  'exec',
  map(
  object({ name: argument(name,), args: multiple(argument(commandToken,),), },),
  function toExecArgs(v: { name: string; args: readonly string[]; },): MvmArgs {
    return { cmd: 'exec', name: v.name, command: v.args.join(' ',), };
  },
),
  { brief: message`Run a command inside a named VM via guest agent`, },
);

/** Parser for `run [--from SOURCE] -- <command...>` -- ephemeral VM */
export const runCmd = command(
  'run',
  map(
  object({
    from: fromOption,
    args: multiple(argument(commandToken,),),
  },),
  function toRunArgs(
    v: { from: string | undefined; args: readonly string[]; },
  ): MvmArgs {
    return { cmd: 'run', command: v.args.join(' ',), from: v.from, };
  },
),
  { brief: message`Create an ephemeral VM, run a command, then destroy it`, },
);

/** Parser for `update` -- re-downloads and rebuilds all template images */
export const updateCmd = command(
  'update',
  map(
  object({},),
  function toUpdateArgs(): MvmArgs {
    return { cmd: 'update', };
  },
),
  { brief: message`Re-download and rebuild all template images`, },
);

/** Value parser for file path arguments, displayed as PATH in help. */
const path = string({ metavar: 'PATH', },);

/** Parser for `push <name> <hostPath> <guestPath>` -- copy file from host into VM. */
export const pushCmd = command(
  'push',
  map(
    object({
      name: argument(name,),
      hostPath: argument(path,),
      guestPath: argument(path,),
    },),
    function toPushArgs(
      v: { name: string; hostPath: string; guestPath: string; },
    ): MvmArgs {
      return {
        cmd: 'push',
        name: v.name,
        hostPath: v.hostPath,
        guestPath: v.guestPath,
      };
    },
  ),
  { brief: message`Copy a file from the host into a running VM`, },
);

/** Parser for `pull <name> <guestPath> <hostPath>` -- copy file from VM to host. */
export const pullCmd = command(
  'pull',
  map(
    object({
      name: argument(name,),
      guestPath: argument(path,),
      hostPath: argument(path,),
    },),
    function toPullArgs(
      v: { name: string; guestPath: string; hostPath: string; },
    ): MvmArgs {
      return {
        cmd: 'pull',
        name: v.name,
        guestPath: v.guestPath,
        hostPath: v.hostPath,
      };
    },
  ),
  { brief: message`Copy a file from a running VM to the host`, },
);

//endregion Subcommand parsers
