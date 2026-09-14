import { resolve, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseGlobalOptions, } from './parse-global-options.ts';

await describe({
  name: parseGlobalOptions.name,
  children: [
    it({
      name: 'returns current cwd and args length when no subcommand exists',
      fn: async function testNoSubcommand(): Promise<void> {
        /** Parsed layout for an empty git argv. */
        const layout = parseGlobalOptions([],);

        expect(layout,).toEqual({
          effectiveCwd: process.cwd(),
          subcommandIndex: 0,
          willShortCircuit: false,
        },);
      },
    },),
    it({
      name: 'locates subcommand after value-taking global options',
      fn: async function testValueTakingGlobalOptions(): Promise<void> {
        /** Parsed layout after `-C` and `-c` global options. */
        const layout = parseGlobalOptions([
          '-C',
          '/tmp',
          '-c',
          'core.quotePath=false',
          'status',
        ],);

        expect(layout,).toEqual({
          effectiveCwd: '/tmp',
          subcommandIndex: 4,
          willShortCircuit: false,
        },);
      },
    },),
    it({
      name: 'chains relative -C paths against previous effective cwd',
      fn: async function testChainedChdir(): Promise<void> {
        /** Parsed layout after absolute and relative `-C` options. */
        const layout = parseGlobalOptions([
          '-C',
          '/tmp',
          '-C',
          'repo',
          'status',
        ],);

        expect(layout,).toEqual({
          effectiveCwd: resolve(
            '/tmp',
            'repo',
          ),
          subcommandIndex: 4,
          willShortCircuit: false,
        },);
      },
    },),
    it({
      name: 'does not treat post-subcommand -C as global chdir',
      fn: async function testPostSubcommandChdir(): Promise<void> {
        /** Parsed layout for commit option named `-C`. */
        const layout = parseGlobalOptions([
          'commit',
          '-C',
          'HEAD~1',
        ],);

        expect(layout,).toEqual({
          effectiveCwd: process.cwd(),
          subcommandIndex: 0,
          willShortCircuit: false,
        },);
      },
    },),
    it({
      name: 'distinguishes short-circuit option tokens from option values',
      fn: async function testShortCircuitOptionRole(): Promise<void> {
        /** Layout with flag-shaped `-C` value only. */
        const valueLayout = parseGlobalOptions([
          '-C',
          '--version',
          'cli-git',
        ],);
        /** Layout with real short-circuit token after `-C` value. */
        const optionLayout = parseGlobalOptions([
          '-C',
          '--version',
          '--version',
          'cli-git',
        ],);

        expect(valueLayout.willShortCircuit,).toBe(false,);
        expect(optionLayout.willShortCircuit,).toBe(true,);
      },
    },),
    it({
      name: 'skips glued global options without consuming following subcommand',
      fn: async function testGluedGlobalOption(): Promise<void> {
        /** Parsed layout for glued `--git-dir=<path>` global option. */
        const layout = parseGlobalOptions([
          '--git-dir=/tmp/repo/.git',
          'status',
        ],);

        expect(layout,).toEqual({
          effectiveCwd: process.cwd(),
          subcommandIndex: 1,
          willShortCircuit: false,
        },);
      },
    },),
  ],
},);
