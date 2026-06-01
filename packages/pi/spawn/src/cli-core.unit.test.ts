import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  extensionArguments,
  initialSpawnState,
  piCommandArguments,
  terminalInvocation,
} from './cli-core.ts';
import type { PidMapping, } from './paths.ts';

/**
 * Parent mapping fixture used by CLI core tests.
 */
const IDENTITY: PidMapping = {
  sessionId: 'parent-session',
  sessionFile: '/tmp/parent.jsonl',
  cwd: '/repo',
  extensionPath: '/repo/packages/pi/spawn/dist/final/node/index.mjs',
};

await describe({
  name: '',
  children: [
    describe({
      name: initialSpawnState.name,
      children: [
        it({
          name: 'creates unclaimed running state linked to parent session',
          fn: async function testInitialState() {
            expect(initialSpawnState({
              spawnId: 'spawn-1',
              identity: IDENTITY,
              cwd: '/repo',
            },),).toEqual({
              spawnId: 'spawn-1',
              sessionId: '',
              sessionFile: '',
              parentSessionId: 'parent-session',
              parentSessionFile: '/tmp/parent.jsonl',
              cwd: '/repo',
              status: 'running',
              lastMessage: '',
            },);
          },
        },),
      ],
    },),
    describe({
      name: extensionArguments.name,
      children: [
        it({
          name: 'passes parent extension path to child Pi',
          fn: async function testExtensionArgs() {
            expect(extensionArguments({ identity: IDENTITY, },),).toEqual([
              '--extension',
              '/repo/packages/pi/spawn/dist/final/node/index.mjs',
            ],);
          },
        },),
        it({
          name: 'omits extension flag when parent mapping has no extension path',
          fn: async function testNoExtensionArgs() {
            expect(extensionArguments({
              identity: {
                ...IDENTITY,
                extensionPath: '',
              },
            },),).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: piCommandArguments.name,
      children: [
        it({
          name: 'combines pi executable, extension path, extra arguments, and prompt',
          fn: async function testPiArguments() {
            expect(piCommandArguments({
              args: {
                prompt: 'do work',
                extraArguments: ' --model openai/gpt-5.1   --thinking high ',
              },
              identity: IDENTITY,
            },),).toEqual([
              'pi',
              '--extension',
              '/repo/packages/pi/spawn/dist/final/node/index.mjs',
              '--model',
              'openai/gpt-5.1',
              '--thinking',
              'high',
              'do work',
            ],);
          },
        },),
      ],
    },),
    describe({
      name: terminalInvocation.name,
      children: [
        it({
          name: 'wraps child pi invocation with terminal-exec delimiter and title',
          fn: async function testTerminalInvocation() {
            expect(terminalInvocation({
              spawnId: '12345678-90ab-cdef',
              args: {
                prompt: 'do work',
              },
              identity: IDENTITY,
            },),).toEqual({
              command: 'terminal-exec',
              args: [
                '--title=spawn-pi 12345678',
                '--',
                'pi',
                '--extension',
                '/repo/packages/pi/spawn/dist/final/node/index.mjs',
                'do work',
              ],
            },);
          },
        },),
      ],
    },),
  ],
},);
