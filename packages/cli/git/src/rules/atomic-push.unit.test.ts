import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { atomicPush, } from './atomic-push.ts';

await describe({
  name: atomicPush.name,
  children: [
    it({
      name: 'passes non-push commands through unchanged',
      fn: async function testNonPushCommand(): Promise<void> {
        /** Non-push argv that should not be transformed. */
        const args = [
          'status',
          '--short',
        ] as const;

        expect(atomicPush(args,),).toBe(args,);
      },
    },),
    it({
      name: 'injects --atomic immediately after push',
      fn: async function testInjectsAtomic(): Promise<void> {
        expect(atomicPush([
          'push',
          'origin',
          'main',
        ],),)
          .toEqual([
            'push',
            '--atomic',
            'origin',
            'main',
          ],);
      },
    },),
    it({
      name: 'preserves global options before push',
      fn: async function testGlobalOptions(): Promise<void> {
        expect(atomicPush([
          '-C',
          '/tmp/repo',
          'push',
          'origin',
          'main',
        ],),)
          .toEqual([
            '-C',
            '/tmp/repo',
            'push',
            '--atomic',
            'origin',
            'main',
          ],);
      },
    },),
    it({
      name: 'skips injection when --atomic is already present',
      fn: async function testExistingAtomic(): Promise<void> {
        /** Push argv with user-supplied atomic flag. */
        const args = [
          'push',
          '--atomic',
          'origin',
          'main',
        ] as const;

        expect(atomicPush(args,),).toBe(args,);
      },
    },),
    it({
      name: 'skips injection when --no-atomic is already present',
      fn: async function testExistingNoAtomic(): Promise<void> {
        /** Push argv with user-supplied no-atomic flag. */
        const args = [
          'push',
          '--no-atomic',
          'origin',
          'main',
        ] as const;

        expect(atomicPush(args,),).toBe(args,);
      },
    },),
  ],
},);
