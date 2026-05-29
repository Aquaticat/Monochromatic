import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { shortCommand, } from './formatter-utils.ts';

await describe({
  name: 'formatter-utils',
  children: [
    describe({
      // shortCommand delegates to stripCommandNoise (stripFrom + findTokenEnd + skipWs)
      name: shortCommand.name,
      children: [
        it({
          name: 'leaves a plain command untouched',
          fn: async () => {
            expect(shortCommand('ls -la',),).toBe('ls -la',);
          },
        },),
        it({
          name: 'strips a single env-var assignment',
          fn: async () => {
            expect(shortCommand('NODE_ENV=prod ls',),).toBe('ls',);
          },
        },),
        it({
          name: 'strips an env assignment with an empty value',
          fn: async () => {
            expect(shortCommand('FOO= ls -la',),).toBe('ls -la',);
          },
        },),
        it({
          name: 'strips a wrapper command and its argument token',
          fn: async () => {
            expect(shortCommand('timeout 5 ls',),).toBe('ls',);
          },
        },),
        it({
          name: 'matches the legacy chained env+wrapper behaviour',
          fn: async () => {
            expect(shortCommand('NODE_ENV=prod env timeout 5 ls -la',),).toBe('5 ls -la',);
          },
        },),
        it({
          name: 'does not strip a leading dash token',
          fn: async () => {
            expect(shortCommand('-x=1 ls',),).toBe('-x=1 ls',);
          },
        },),
        it({
          name: 'returns the wrapper verbatim when it has no argument',
          fn: async () => {
            expect(shortCommand('timeout',),).toBe('timeout',);
          },
        },),
        it({
          name: 'returns the empty string unchanged',
          fn: async () => {
            expect(shortCommand('',),).toBe('',);
          },
        },),
        it({
          name: 'strips many chained env prefixes (linear scan)',
          fn: async () => {
            expect(shortCommand(`${'A=1 '.repeat(100_000,)}cmd`,),).toBe('cmd',);
          },
        },),
      ],
    },),
  ],
},);
