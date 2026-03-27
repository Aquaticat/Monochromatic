/**
 * Subcommand parser definitions for the vmsync CLI.
 *
 * Defines individual subcommand parsers that are combined into
 * the top-level parser in `index-parsers.ts`.
 *
 * @module
 */

import { object, } from '@optique/core/constructs';
import { message, } from '@optique/core/message';
import {
  map,
  optional,
} from '@optique/core/modifiers';
import {
  argument,
  command,
  option,
} from '@optique/core/primitives';
import {
  integer,
  string,
} from '@optique/core/valueparser';

import type { VmsyncArgs, } from './index-parsers.ts';

//region Shared value parsers

/** Value parser for VM name arguments, displayed as NAME in help. */
const name = string({
  metavar: 'NAME',
},);

/** Value parser for file path arguments, displayed as PATH in help. */
const path = string({
  metavar: 'PATH',
},);

/** Value parser for memory strings, displayed as MEMORY in help. */
const memoryValue = string({
  metavar: 'MEMORY',
},);

/** Value parser for CPU count, displayed as CPUS in help. */
const cpusValue = integer({
  metavar: 'CPUS',
  min: 1,
},);

//endregion Shared value parsers

//region Subcommand parsers

/** Parser for `import <path> [--name NAME]`. */
export const importCmd = command(
  'import',
  map(
    object({
      imagePath: argument(path,),
      name: optional(
        option(
          '--name',
          name,
          {
            description: message`Override the derived VM name`,
          },
        ),
      ),
    },),
    function toImportArgs(
      v: {
        imagePath: string;
        name: string | undefined;
      },
    ): VmsyncArgs {
      return {
        cmd: 'import',
        imagePath: v.imagePath,
        name: v.name,
      };
    },
  ),
  {
    brief: message`Import a disk image and convert to qcow2 + vhdx`,
  },
);

/** Parser for `boot <name>`. */
export const bootCmd = command(
  'boot',
  map(
    object({
      name: argument(name,),
    },),
    function toBootArgs(v: { name: string; },): VmsyncArgs {
      return {
        cmd: 'boot',
        name: v.name,
      };
    },
  ),
  {
    brief: message`Boot a VM using the platform's native hypervisor`,
  },
);

/** Parser for `sync <name>`. */
export const syncCmd = command(
  'sync',
  map(
    object({
      name: argument(name,),
    },),
    function toSyncArgs(v: { name: string; },): VmsyncArgs {
      return {
        cmd: 'sync',
        name: v.name,
      };
    },
  ),
  {
    brief: message`Sync changed blocks to the other disk format`,
  },
);

/** Parser for `status <name>`. */
export const statusCmd = command(
  'status',
  map(
    object({
      name: argument(name,),
    },),
    function toStatusArgs(v: { name: string; },): VmsyncArgs {
      return {
        cmd: 'status',
        name: v.name,
      };
    },
  ),
  {
    brief: message`Show sync state and boot info for a VM`,
  },
);

/** Parser for `list`. */
export const listCmd = command(
  'list',
  map(
    object({},),
    function toListArgs(): VmsyncArgs {
      return {
        cmd: 'list',
      };
    },
  ),
  {
    brief: message`Show all managed VMs`,
  },
);

/** Parser for `config <name> [--memory MEMORY] [--cpus CPUS]`. */
export const configCmd = command(
  'config',
  map(
    object({
      name: argument(name,),
      memory: optional(
        option(
          '--memory',
          memoryValue,
          {
            description: message`Memory allocation (e.g. "8G", "4096M")`,
          },
        ),
      ),
      cpus: optional(
        option(
          '--cpus',
          cpusValue,
          {
            description: message`Number of virtual CPUs`,
          },
        ),
      ),
    },),
    function toConfigArgs(
      v: {
        name: string;
        memory: string | undefined;
        cpus: number | undefined;
      },
    ): VmsyncArgs {
      return {
        cmd: 'config',
        name: v.name,
        memory: v.memory,
        cpus: v.cpus,
      };
    },
  ),
  {
    brief: message`Update boot settings for a VM`,
  },
);

//endregion Subcommand parsers
