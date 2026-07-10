import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { runPolicyEngine, } from './engine.ts';

await describe({
  name: 'policy engine',
  children: [
    it({
      name: 'uses default error severity for require-root',
      fn: async function testDefaultErrorSeverity() {
        /** Result from package directory below repository root. */
        const result = await runPolicyEngine({ args: ['status',], trigger: 'pre-forward', },);
        expect(result.exitCode,).toBe(1,);
        expect(result.shouldForward,).toBe(false,);
        expect(result.events[0]?.type,).toBe('finding',);
        expect(result.events[0]?.sequence,).toBe(0,);
      },
    },),
    it({
      name: 'persists off and warn severity behavior',
      fn: async function testPersistentSeverityBehavior() {
        /** Disabled policy result. */
        const offResult = await runPolicyEngine({
          args: ['status',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', }, },
        },);
        /** Warn-only policy result. */
        const warnResult = await runPolicyEngine({
          args: ['status',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'warn', }, },
        },);
        expect(offResult.events,).toEqual([],);
        expect(offResult.exitCode,).toBe(0,);
        expect(warnResult.exitCode,).toBe(0,);
        expect(warnResult.events[0]?.type,).toBe('finding',);
        expect(warnResult.configWarnings,).toEqual([
          'Policy require-root is warn-unsafe but configured as warn.',
        ],);
      },
    },),
    it({
      name: 'strips flag-position escape but preserves pathspec and option values',
      fn: async function testEscapePosition() {
        /** Escaped invocation result. */
        const escapedResult = await runPolicyEngine({
          args: ['--no-enforce-require-root', 'status',],
          trigger: 'pre-forward',
        },);
        /** Pathspec token result. */
        const pathspecResult = await runPolicyEngine({
          args: ['status', '--', '--no-enforce-require-root',],
          trigger: 'pre-forward',
        },);
        /** Message value result. */
        const valueResult = await runPolicyEngine({
          args: ['commit', '-m', '--no-enforce-require-root',],
          trigger: 'pre-forward',
        },);
        expect(escapedResult.events,).toEqual([],);
        expect(escapedResult.args,).toEqual(['status',],);
        expect(pathspecResult.exitCode,).toBe(1,);
        expect(valueResult.exitCode,).toBe(1,);
        expect(valueResult.args,).toEqual(['commit', '-m', '--no-enforce-require-root',],);
      },
    },),
    it({
      name: 'rejects unknown policy IDs as engine failures',
      fn: async function testUnknownPolicyId() {
        /** Invalid built-in configuration result. */
        const result = await runPolicyEngine({
          args: ['status',],
          trigger: 'pre-forward',
          config: { policies: { unknown: 'error', }, },
        },);
        expect(result.exitCode,).toBe(2,);
        expect(result.events[0]?.type,).toBe('engine-failure',);
      },
    },),
  ],
},);
