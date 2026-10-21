/**
 Tests for the rotation sweep's request and package choice (ledger B701), and for the task that runs it:
 the task must build every package the sweep loads, so a package added to the stage's dependents is built before it is swept.

 Fixtures are cat-themed invention; the package case reads this package's own `mise.toml` and the family's manifests.

 @module
 */

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { sweepRequestOf, } from './rotation-sweep.test-fixture.ts';
import { packagesReachingStage, } from './rotation-sweep-packages.test-fixture.ts';

/**
 Header of the task that runs the sweep.
 */
const SWEEP_TASK = '[tasks."test:rotation-sweep"]';

await describe({
  name: 'rotation sweep',
  concurrency: 1,
  children: [
    describe({
    name: sweepRequestOf.name,
    concurrency: 1,
    children: [
      it({
        name: 'runs every salt from 0 to 9 over every package when nothing is asked',
        fn: async () => {
          expect(sweepRequestOf({ args: [], },),).toStrictEqual({ packages: [], salts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9,], },);
        },
      },),
      it({
        name: 'reads repeated packages and salts, sorted and once each',
        fn: async () => {
          expect(sweepRequestOf({ args: ['--package', 'stage', '--salt', '6', '--package', 'probe', '--salt', '2', '--salt', '6',], },),)
            .toStrictEqual({ packages: ['stage', 'probe',], salts: [2, 6,], },);
        },
      },),
      it({
        name: 'refuses an unknown option, a salt past the largest bench and an option without a value',
        fn: async () => {
          for (const args of [['--nap', 'long',], ['--salt', '10',], ['--salt', 'x',], ['--package',],]) {
            expect(caught(function bad(): void {
              sweepRequestOf({ args, },);
            },),).toBeDefined();
          }
        },
      },),
    ],
    },),
    describe({
    name: packagesReachingStage.name,
    concurrency: 1,
    children: [
      it({
        name: 'holds the stage and its dependents, and leaves out the scans and the packages the stage leans on',
        fn: async () => {
          /**
           Directories chosen.
           */
          const chosen = await packagesReachingStage();
          expect(chosen,).toContain('stage',);
          expect(chosen,).toContain('probe',);
          expect(chosen,).not.toContain('source-scan',);
          expect(chosen,).not.toContain('typography',);
        },
      },),
      it({
        name: 'is built by the task that sweeps it: every chosen package is a dependency of test:rotation-sweep',
        fn: async () => {
          /**
           Text of this package's task file.
           */
          const tasks = await readFile(
            join(
              import.meta.dirname,
              '..',
              '..',
              'mise.toml',
            ),
            'utf8',
          );
          /**
           The sweep task's block, up to the next task.
           */
          const block = tasks.slice(tasks.indexOf(SWEEP_TASK,),).split('\n[tasks.',)[0] ?? '';
          /**
           Packages chosen whose build the task does not name.
           */
          const unbuilt = (await packagesReachingStage()).filter(function lacksBuild(name,): boolean {
            return !block.includes(`"//package/translation-repair/${name}:build:js:node"`,);
          },);
          expect(unbuilt,).toStrictEqual([],);
        },
      },),
    ],
    },),
  ],
},);
