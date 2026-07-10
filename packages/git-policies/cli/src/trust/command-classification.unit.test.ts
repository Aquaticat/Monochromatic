import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { classifyConfigLoading, } from './command-classification.ts';

await describe({
  name: 'trusted config command classification',
  children: [
    it({
      name: 'skips known inspection commands',
      fn: async function testKnownReadOnly() {
        expect(classifyConfigLoading(['status',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['log', '--oneline',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['-C', '/repo', 'show', 'HEAD',]),).toBe('skip-config',);
      },
    },),
    it({
      name: 'classifies branch mixed forms from arguments',
      fn: async function testBranchForms() {
        expect(classifyConfigLoading(['branch',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['branch', '--list', 'feature-*',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['branch', '--contains', 'HEAD',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['branch', 'feature',]),).toBe('load-config',);
        expect(classifyConfigLoading(['branch', '-d', 'feature',]),).toBe('load-config',);
        expect(classifyConfigLoading(['branch', '-M', 'main',]),).toBe('load-config',);
        expect(classifyConfigLoading(['branch', '--set-upstream-to=origin/main',]),).toBe('load-config',);
      },
    },),
    it({
      name: 'classifies tag mixed forms from arguments',
      fn: async function testTagForms() {
        expect(classifyConfigLoading(['tag',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['tag', '--list', 'v*',]),).toBe('skip-config',);
        expect(classifyConfigLoading(['tag', 'v1',]),).toBe('load-config',);
        expect(classifyConfigLoading(['tag', '-d', 'v1',]),).toBe('load-config',);
        expect(classifyConfigLoading(['tag', '-s', 'v1',]),).toBe('load-config',);
        expect(classifyConfigLoading(['tag', '--delete=v1',]),).toBe('load-config',);
      },
    },),
    it({
      name: 'loads unknown and ambiguous commands',
      fn: async function testUnknownCommands() {
        expect(classifyConfigLoading(['future-command',]),).toBe('load-config',);
        expect(classifyConfigLoading([],),).toBe('load-config',);
        expect(classifyConfigLoading(['commit',]),).toBe('load-config',);
      },
    },),
  ],
},);
