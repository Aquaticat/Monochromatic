/**
 * CLI argument parser definitions for the vmsync command.
 * Defines the result type and combines subcommand parsers
 * into a single top-level parser.
 *
 * @module
 */

import { or, } from '@optique/core/constructs';

import {
  bootCmd,
  configCmd,
  importCmd,
  listCmd,
  statusCmd,
  syncCmd,
} from './index-parsers-cmds.ts';

//region Result types -- discriminated union for subcommand dispatch

/** Discriminated union of all subcommand parse results. */
export type VmsyncArgs =
  | {
    cmd: 'import';
    imagePath: string;
    name: string | undefined;
  }
  | {
    cmd: 'boot';
    name: string;
  }
  | {
    cmd: 'sync';
    name: string;
  }
  | {
    cmd: 'status';
    name: string;
  }
  | { cmd: 'list'; }
  | {
    cmd: 'config';
    name: string;
    memory: string | undefined;
    cpus: number | undefined;
  };

//endregion Result types

/** Combined top-level parser across all subcommands. */
export const parser = or(
  importCmd,
  bootCmd,
  syncCmd,
  statusCmd,
  listCmd,
  configCmd,
);
