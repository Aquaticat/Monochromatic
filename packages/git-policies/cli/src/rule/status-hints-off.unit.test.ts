import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  hasExplicitStatusHintsOverride,
  statusHintsOff,
} from './status-hints-off.ts';

await describe({
  name: '',
  children: [
    describe({
      name: hasExplicitStatusHintsOverride.name,
      children: [
        it({
          name: 'detects pre-subcommand advice.statusHints override',
          fn: async function testPreSubcommandOverride(): Promise<void> {
            expect(hasExplicitStatusHintsOverride([
              '-c',
              'advice.statusHints=true',
              'status',
            ],),)
              .toBe(true,);
          },
        },),
        it({
          name: 'detects bare boolean-true advice.statusHints override',
          fn: async function testBareBooleanOverride(): Promise<void> {
            expect(hasExplicitStatusHintsOverride([
              '-c',
              'advice.statusHints',
              'status',
            ],),)
              .toBe(true,);
          },
        },),
        it({
          name: 'detects advice.statusHints override regardless of key casing',
          fn: async function testCaseInsensitiveOverride(): Promise<void> {
            expect(hasExplicitStatusHintsOverride([
              '-c',
              'Advice.StatusHints=true',
              'status',
            ],),)
              .toBe(true,);
          },
        },),
        it({
          name: 'ignores post-subcommand advice.statusHints token',
          fn: async function testPostSubcommandOverrideIgnored(): Promise<void> {
            expect(hasExplicitStatusHintsOverride([
              'status',
              '-c',
              'advice.statusHints=true',
            ],),)
              .toBe(false,);
          },
        },),
        it({
          name: 'returns false when override is absent',
          fn: async function testOverrideAbsent(): Promise<void> {
            expect(hasExplicitStatusHintsOverride([
              'status',
            ],),)
              .toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: statusHintsOff.name,
      children: [
        it({
          name: 'passes non-status commands through unchanged',
          fn: async function testNonStatusCommand(): Promise<void> {
            /** Non-status argv that should not be transformed. */
            const args = [
              'commit',
              '-m',
              'message',
              'file.ts',
            ] as const;

            expect(statusHintsOff(args,),).toBe(args,);
          },
        },),
        it({
          name: 'injects advice override before status',
          fn: async function testInjectsAdviceOverride(): Promise<void> {
            expect(statusHintsOff([
              'status',
            ],),)
              .toEqual([
                '-c',
                'advice.statusHints=false',
                'status',
              ],);
          },
        },),
        it({
          name: 'preserves global options while injecting before status',
          fn: async function testGlobalOptions(): Promise<void> {
            expect(statusHintsOff([
              '-C',
              '/tmp/repo',
              'status',
              '--short',
            ],),)
              .toEqual([
                '-C',
                '/tmp/repo',
                '-c',
                'advice.statusHints=false',
                'status',
                '--short',
              ],);
          },
        },),
        it({
          name: 'skips injection when user set advice.statusHints',
          fn: async function testUserOverride(): Promise<void> {
            /** Status argv with user-supplied advice override. */
            const args = [
              '-c',
              'advice.statusHints=true',
              'status',
            ] as const;

            expect(statusHintsOff(args,),).toBe(args,);
          },
        },),
        it({
          name: 'skips injection when user set bare advice.statusHints',
          fn: async function testUserBareOverride(): Promise<void> {
            /** Status argv with git's boolean-true config spelling. */
            const args = [
              '-c',
              'advice.statusHints',
              'status',
            ] as const;

            expect(statusHintsOff(args,),).toBe(args,);
          },
        },),
      ],
    },),
  ],
},);
