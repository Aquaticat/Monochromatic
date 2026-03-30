/**
 * CLI argument parser definitions for the mvm command.
 * Defines the result type and combines subcommand parsers
 * into a single top-level parser.
 */

import { or, } from '@optique/core/constructs';

import {
  createCmd,
  destroyCmd,
  execCmd,
  listCmd,
  lsCmd,
  pullCmd,
  pushCmd,
  rmCmd,
  runCmd,
  shellCmd,
  updateCmd,
} from './index-parsers-cmds.ts';

//region Result types -- discriminated union for subcommand dispatch

/** Discriminated union of all subcommand parse results */
export type MvmArgs =
  | {
    cmd: 'create';
    image: string | undefined;
    name: string;
    from: string | undefined;
  }
  | {
    cmd: 'shell';
    name: string;
  }
  | { cmd: 'list'; }
  | { cmd: 'update'; }
  | {
    cmd: 'destroy';
    name: string | undefined;
    all: boolean;
  }
  | {
    cmd: 'exec';
    name: string;
    command: string;
  }
  | {
    cmd: 'run';
    command: string;
    from: string | undefined;
  }
  | {
    cmd: 'push';
    name: string;
    hostPath: string;
    guestPath: string;
  }
  | {
    cmd: 'pull';
    name: string;
    guestPath: string;
    hostPath: string;
  };

//endregion Result types

/** Combined top-level parser across all subcommands */
export const parser = or(
  createCmd,
  shellCmd,
  listCmd,
  lsCmd,
  updateCmd,
  destroyCmd,
  rmCmd,
  execCmd,
  runCmd,
  pushCmd,
  pullCmd,
);
