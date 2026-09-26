/**
 Argument rewriting for native preparation: global option splitting and all-flag removal.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  splitCommitInvocation,
  withoutAllFlag,
} = internalTestExports;

await describe({
  name: 'native preparation arguments',
  children: [
    it({
      name: `${splitCommitInvocation.name} drops redirecting globals with separated and attached values and keeps every other global`,
      fn: async function testSplit(): Promise<void> {
        /** Arguments mixing kept and redirecting globals. */
        const args = [
          '-C',
          'repo',
          '-c',
          'a.b=1',
          '--git-dir=/elsewhere',
          '--work-tree',
          '/tree',
          '--bare',
          '--no-pager',
          '--namespace',
          'ns',
          'commit',
          '-m',
          'x',
          '--',
          'a.txt',
        ];
        expect(splitCommitInvocation({ args, subcommandIndex: args.indexOf('commit',), },),).toEqual({
          globalArgs: ['-c', 'a.b=1', '--no-pager', '--namespace', 'ns',],
          commitArgs: ['-m', 'x', '--', 'a.txt',],
        },);
      },
    },),
    it({
      name: `${splitCommitInvocation.name} keeps a value that looks like a redirecting option`,
      fn: async function testValueLookalike(): Promise<void> {
        /** A `-c` value spelled like `-C`. */
        const args = ['-c', '-C', 'commit', '--amend',];
        expect(splitCommitInvocation({ args, subcommandIndex: 2, },),).toEqual({
          globalArgs: ['-c', '-C',],
          commitArgs: ['--amend',],
        },);
      },
    },),
    ...([
      [['-a', '-m', 'x',], ['-m', 'x',],],
      [['--all', '-m', 'x',], ['-m', 'x',],],
      [['-am', 'x',], ['-m', 'x',],],
      [['-qam', 'x',], ['-q', '-m', 'x',],],
      [['-m', '-a',], ['-m', '-a',],],
      [['-aSkey', '-m', 'x',], ['-Skey', '-m', 'x',],],
      [['-Sa', '-m', 'x',], ['-Sa', '-m', 'x',],],
      [['-uall', '-am', 'x',], ['-uall', '-m', 'x',],],
      [['-m', 'x', '--', '-a',], ['-m', 'x', '--', '-a',],],
      [['--author', '--all', '-a',], ['--author', '--all',],],
    ] as const).map(function allFlagCase([input, expected,],) {
      return it({
        name: `${withoutAllFlag.name}(${JSON.stringify(input,)}) is ${JSON.stringify(expected,)}`,
        fn: async function testAllFlag(): Promise<void> {
          expect(withoutAllFlag(input,),).toEqual(expected,);
        },
      },);
    },),
  ],
},);
