/**
 Tests for the environment every test's child process gets: no variable whose
 name ends in `_API_KEY`, none whose name starts with `TRANSLATION_REPAIR_`,
 and the case's own variables.

 THE PROOF IS A REAL CHILD. Each case sets fake variables in this process
 (`TRANSLATION_REPAIR_NEVER_REAL_API_KEY` and its kin, never a real key),
 starts a node child that prints the names it sees, and compares them; the
 child never calls a provider. The suite runs one case at a time, since the
 fake variables are process-wide writes.

 @module
 */

import { realpath, } from 'node:fs/promises';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  environmentWithoutKeys,
  runKeyless,
  spawnKeyless,
  variablesSet,
} from './child-environment.test-fixture.ts';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';

/**
 Fake variables this process holds while a case runs, none a real credential:
 two keys (one carrying the package's prefix and one not), one setting of
 the package's, and one plain variable the rule leaves alone.
 */
const FAKE_VARIABLES: Readonly<Record<string, string>> = {
  TRANSLATION_REPAIR_NEVER_REAL_API_KEY: 'a cat naps',
  NEVER_REAL_ELSEWHERE_API_KEY: 'a kitten naps',
  TRANSLATION_REPAIR_NEVER_REAL_SETTING: 'a tabby naps',
  NEVER_REAL_PLAIN: 'a calico naps',
};

/**
 Program a child runs to say what it sees of its own environment: the names
 ending in the key suffix, the names starting with the package's prefix, the
 two variables the case set by hand, whether the inherited search path is
 there, and the directory it runs in.
 */
const REPORT_PROGRAM = [
  'const names = Object.keys(process.env).toSorted();',
  'process.stdout.write(JSON.stringify({',
  '  keys: names.filter((name) => name.endsWith(\'_API_KEY\')),',
  '  settings: names.filter((name) => name.startsWith(\'TRANSLATION_REPAIR_\')),',
  '  plain: process.env.NEVER_REAL_PLAIN ?? null,',
  '  extra: process.env.NEVER_REAL_EXTRA ?? null,',
  '  hasPath: names.includes(\'PATH\'),',
  '  cwd: process.cwd(),',
  '}));',
].join('\n',);

/**
 What the report program printed, read back.

 @param text - the child's whole stdout

 @returns The report as plain data

 @example
 ```ts
 const report = reportOf({ text: stdout, },);
 ```
 */
function reportOf({ text, }: { readonly text: string; },): unknown {
  return JSON.parse(text,);
}

await describe({
  name: 'child environment',
  concurrency: 1,
  children: [
    it({
      name: 'STATES every key and every package setting of this process as absent, keeps the plain variable '
        + 'and sets the extra',
      fn: async () => {
        using fakes = variablesSet({ values: FAKE_VARIABLES, },);
        void fakes;
        const env = environmentWithoutKeys({ extra: { NEVER_REAL_EXTRA: 'a kitten plays', }, },);
        /**
         Names of the variables this case set or the fixture states, in code unit order.
         */
        const names = Object
          .keys(env,)
          .filter((name,) => name.startsWith('NEVER_REAL_',) || name.startsWith('TRANSLATION_REPAIR_NEVER_REAL_',))
          .toSorted();
        expect(names.map((name,) => [name, env[name],],),).toEqual([
          ['NEVER_REAL_ELSEWHERE_API_KEY', undefined,],
          ['NEVER_REAL_EXTRA', 'a kitten plays',],
          ['NEVER_REAL_PLAIN', 'a calico naps',],
          ['TRANSLATION_REPAIR_NEVER_REAL_API_KEY', undefined,],
          ['TRANSLATION_REPAIR_NEVER_REAL_SETTING', undefined,],
        ],);
      },
    },),
    it({
      name: 'LEAVES A CHILD OF SPAWNKEYLESS no variable ending in _API_KEY or starting with TRANSLATION_REPAIR_, '
        + 'the plain variable, the search path and the extra in place, and the directory it was given',
      fn: async () => {
        using fakes = variablesSet({ values: FAKE_VARIABLES, },);
        void fakes;
        await using scratch = await scratchDir({ prefix: 'child-environment-', },);
        const { stdout, } = await spawnKeyless({
          file: process.execPath,
          args: ['--input-type=module', '--eval', REPORT_PROGRAM,],
          cwd: scratch.path,
          extra: { NEVER_REAL_EXTRA: 'a kitten plays', },
        },);
        expect(reportOf({ text: stdout, },),).toEqual({
          keys: [],
          settings: [],
          plain: 'a calico naps',
          extra: 'a kitten plays',
          hasPath: true,
          cwd: await realpath(scratch.path,),
        },);
      },
    },),
    it({
      name: 'LEAVES A CHILD OF RUNKEYLESS no variable ending in _API_KEY or starting with TRANSLATION_REPAIR_, '
        + 'the plain variable, the search path and the extra in place, and the directory it was given',
      fn: async () => {
        using fakes = variablesSet({ values: FAKE_VARIABLES, },);
        void fakes;
        await using scratch = await scratchDir({ prefix: 'child-environment-', },);
        const done = await runKeyless({
          file: process.execPath,
          args: ['--input-type=module', '--eval', REPORT_PROGRAM,],
          cwd: scratch.path,
          extra: { NEVER_REAL_EXTRA: 'a kitten plays', },
        },);
        expect(done.code,).toBe(0,);
        expect(done.stderr,).toBe('',);
        expect(reportOf({ text: done.stdout, },),).toEqual({
          keys: [],
          settings: [],
          plain: 'a calico naps',
          extra: 'a kitten plays',
          hasPath: true,
          cwd: await realpath(scratch.path,),
        },);
      },
    },),
    it({
      name: 'HANDS A CHILD the variables a case names even where they end in _API_KEY or start with '
        + 'TRANSLATION_REPAIR_, the control that the report sees a key',
      fn: async () => {
        using fakes = variablesSet({ values: FAKE_VARIABLES, },);
        void fakes;
        const { stdout, } = await spawnKeyless({
          file: process.execPath,
          args: ['--input-type=module', '--eval', REPORT_PROGRAM,],
          extra: {
            NEVER_REAL_CASE_API_KEY: 'a cat plays',
            TRANSLATION_REPAIR_RUNS_DIR: 'a basket',
          },
        },);
        expect(reportOf({ text: stdout, },),).toEqual({
          keys: ['NEVER_REAL_CASE_API_KEY',],
          settings: ['TRANSLATION_REPAIR_RUNS_DIR',],
          plain: 'a calico naps',
          extra: null,
          hasPath: true,
          cwd: await realpath(process.cwd(),),
        },);
      },
    },),
  ],
},);
