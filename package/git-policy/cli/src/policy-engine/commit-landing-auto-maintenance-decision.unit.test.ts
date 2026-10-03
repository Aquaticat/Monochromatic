/**
 Automatic maintenance decisions mirroring Git's `prepare_auto_maintenance`,
 config record parsing,
 and the invocation sequence against recording stand-in Git executables.

 @module
 */
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import { writeNodeProgram, } from './commit-landing-fixture.unit.test.ts';

const {
  AUTO_MAINTENANCE_DISABLED,
  autoMaintenanceArgs,
  parseConfigRecords,
  runAutoMaintenance,
} = internalTestExports;

/**
 Arguments native `git commit` passes when maintenance detaches.
 */
const DETACHED = ['maintenance', 'run', '--auto', '--quiet', '--detach',];

/**
 Arguments native `git commit` passes when maintenance stays in the foreground.
 */
const FOREGROUND = ['maintenance', 'run', '--auto', '--quiet', '--no-detach',];

/**
 Stand-in Git executable that records every invocation.
 */
type RecordingGit = Readonly<{
  /**
   Executable path.
   */
  path: string;
  /**
   Reads the recorded argument lists in invocation order.
   */
  calls: () => Promise<readonly (readonly string[])[]>;
  /**
   Removes the scratch directory.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 Writes a stand-in Git executable that appends its arguments as one JSON line per run.

 @param configExitCode - exit status for `config`

 @param rejectDetach - whether `--detach` fails as Git before 2.47 fails it

 @returns recording executable

 @example
 ```ts
 await using fake = await recordingGit({ configExitCode: 1, rejectDetach: true });
 ```
 */
async function recordingGit({
  configExitCode,
  rejectDetach,
}: Readonly<{
  configExitCode: number;
  rejectDetach: boolean;
}>,): Promise<RecordingGit> {
  /**
   Scratch directory.
   */
  const directory = await mkdtemp(join(
    tmpdir(),
    'cli-git-maintenance-',
  ),);
  /**
   Invocation log.
   */
  const log = join(
    directory,
    'calls.jsonl',
  );
  /**
   Executable path.
   */
  const path = join(
    directory,
    'git',
  );
  await writeNodeProgram({
    path,
    source: `
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(log,)}, JSON.stringify(args) + '\\n');
if (args.includes('config')) process.exit(${String(configExitCode,)});
if (${String(rejectDetach,)} && args.includes('--detach')) { process.stderr.write("error: unknown option 'detach'\\n"); process.exit(129); }
`,
  },);
  return {
    path,
    calls: async function calls(): Promise<readonly (readonly string[])[]> {
      return (await readFile(
        log,
        'utf8',
      ))
        .split('\n',)
        .filter(function nonEmpty(line,): boolean {
          return line.length > 0;
        },)
        .map(function parsed(line,): readonly string[] {
          return JSON.parse(line,) as readonly string[];
        },);
    },
    [Symbol.asyncDispose]: async function remove(): Promise<void> {
      await rm(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: 'automatic maintenance decision',
  children: [
    it({
      name: 'no configuration runs detached maintenance',
      fn: async function testDefault(): Promise<void> {
        expect(autoMaintenanceArgs({},),).toEqual(DETACHED,);
      },
    },),
    it({
      name: 'maintenance.auto=false disables maintenance',
      fn: async function testMaintenanceAutoFalse(): Promise<void> {
        expect(autoMaintenanceArgs({ 'maintenance.auto': 'false', },),).toBe(AUTO_MAINTENANCE_DISABLED,);
      },
    },),
    it({
      name: 'maintenance.auto as integer zero disables maintenance',
      fn: async function testMaintenanceAutoZero(): Promise<void> {
        expect(autoMaintenanceArgs({ 'maintenance.auto': '0', },),).toBe(AUTO_MAINTENANCE_DISABLED,);
      },
    },),
    it({
      name: 'maintenance.auto=true overrides gc.auto=0',
      fn: async function testMaintenanceAutoWins(): Promise<void> {
        expect(autoMaintenanceArgs({ 'maintenance.auto': 'true', 'gc.auto': '0', },),).toEqual(DETACHED,);
      },
    },),
    it({
      name: 'gc.auto=0 without maintenance.auto disables maintenance',
      fn: async function testGcAutoZero(): Promise<void> {
        expect(autoMaintenanceArgs({ 'gc.auto': '0', },),).toBe(AUTO_MAINTENANCE_DISABLED,);
      },
    },),
    it({
      name: 'a negative gc.auto disables maintenance',
      fn: async function testGcAutoNegative(): Promise<void> {
        expect(autoMaintenanceArgs({ 'gc.auto': '-1', },),).toBe(AUTO_MAINTENANCE_DISABLED,);
      },
    },),
    it({
      name: 'a positive gc.auto keeps maintenance enabled',
      fn: async function testGcAutoPositive(): Promise<void> {
        expect(autoMaintenanceArgs({ 'gc.auto': '6700', },),).toEqual(DETACHED,);
      },
    },),
    it({
      name: 'maintenance.autoDetach=false keeps maintenance in the foreground',
      fn: async function testMaintenanceDetachFalse(): Promise<void> {
        expect(autoMaintenanceArgs({ 'maintenance.autodetach': 'false', },),).toEqual(FOREGROUND,);
      },
    },),
    it({
      name: 'maintenance.autoDetach overrides gc.autoDetach',
      fn: async function testMaintenanceDetachWins(): Promise<void> {
        expect(autoMaintenanceArgs({ 'maintenance.autodetach': 'true', 'gc.autodetach': 'false', },),).toEqual(DETACHED,);
      },
    },),
    it({
      name: 'gc.autoDetach=false applies when maintenance.autoDetach is unset',
      fn: async function testGcDetachFallback(): Promise<void> {
        expect(autoMaintenanceArgs({ 'gc.autodetach': 'false', },),).toEqual(FOREGROUND,);
      },
    },),
    it({
      name: 'config records keep the last value of each key and read a value-less key as true',
      fn: async function testParseRecords(): Promise<void> {
        expect(parseConfigRecords('gc.auto\n1024\0maintenance.autodetach\ntrue\0maintenance.autodetach\nfalse\0gc.autodetach\0',),).toEqual({
          'gc.auto': '1024',
          'maintenance.autodetach': 'false',
          'gc.autodetach': 'true',
        },);
      },
    },),
    it({
      name: 'empty config output parses to no keys',
      fn: async function testParseEmpty(): Promise<void> {
        expect(parseConfigRecords('',),).toEqual({},);
      },
    },),
    it({
      name: 'unset configuration runs detached maintenance with the caller global options',
      fn: async function testRunsDetached(): Promise<void> {
        await using fake = await recordingGit({ configExitCode: 1, rejectDetach: false, },);
        expect(await runAutoMaintenance({ gitPath: fake.path, cwd: tmpdir(), globalArgs: ['-c', 'x.y=z',], },),).toBe(0,);
        expect((await fake.calls()).map(function withoutConfigPattern(args,): readonly string[] {
          return args.slice(
            0,
            -1,
          );
        },),).toEqual([
          ['-c', 'x.y=z', 'config', '--type=bool-or-int', '--null', '--get-regexp',],
          ['-c', 'x.y=z', ...DETACHED.slice(
            0,
            -1,
          ),],
        ],);
      },
    },),
    it({
      name: 'Git before 2.47 rejecting --detach gets the pre-2.47 native form',
      fn: async function testFallback(): Promise<void> {
        await using fake = await recordingGit({ configExitCode: 1, rejectDetach: true, },);
        expect(await runAutoMaintenance({ gitPath: fake.path, cwd: tmpdir(), globalArgs: [], },),).toBe(0,);
        expect((await fake.calls()).slice(1,),).toEqual([
          DETACHED,
          DETACHED.slice(
            0,
            -1,
          ),
        ],);
      },
    },),
    it({
      name: 'a failing config read skips maintenance and reports the config exit status',
      fn: async function testConfigFailure(): Promise<void> {
        await using fake = await recordingGit({ configExitCode: 128, rejectDetach: false, },);
        expect(await runAutoMaintenance({ gitPath: fake.path, cwd: tmpdir(), globalArgs: [], },),).toBe(128,);
        expect((await fake.calls()).length,).toBe(1,);
      },
    },),
  ],
},);
