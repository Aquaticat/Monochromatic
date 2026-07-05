/**
 * Tests for pi guardrail Bash command blocking.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  evaluateBashGuard,
  invokesBunTest,
} from './bash-guard.ts';

await describe({
  name: 'bash guard',
  children: [
    describe({
      name: 'bun test detection',
      children: [
        it({
          name: 'detects direct bun test invocation',
          fn: async function testDirectBunTest() {
            expect(invokesBunTest('bun test',),).toBe(true,);
          },
        },),
        it({
          name: 'detects bun test after command separator',
          fn: async function testBunTestAfterSeparator() {
            expect(invokesBunTest('cd x && bun test foo.ts',),).toBe(true,);
          },
        },),
        it({
          name: 'detects bun test in subshell segment',
          fn: async function testBunTestInSubshell() {
            expect(invokesBunTest('(bun test)',),).toBe(true,);
          },
        },),
        it({
          name: 'allows prose containing bun test inside echo',
          fn: async function testEchoAllowsBunTestText() {
            expect(invokesBunTest('echo "use bun test here"',),).toBe(false,);
          },
        },),
        it({
          name: 'allows bun run test script command',
          fn: async function testBunRunTestAllowed() {
            expect(invokesBunTest('bun run test',),).toBe(false,);
          },
        },),
        it({
          name: 'allows longer test-prefixed words',
          fn: async function testLongerWordsAllowed() {
            expect(invokesBunTest('bun tests',),).toBe(false,);
            expect(invokesBunTest('bun test_runner',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: 'guard decision',
      children: [
        it({
          name: 'blocks Bash input invoking bun test',
          fn: async function testBlocksBunTestInput() {
            const decision = evaluateBashGuard({ command: 'bun test foo.unit.test.ts', },);
            expect(decision?.block,).toBe(true,);
            expect(decision?.reason.includes('mise run //packages/<path>:test:unit',),).toBe(true,);
          },
        },),
        it({
          name: 'allows non-object and non-string inputs',
          fn: async function testAllowsMalformedInput() {
            expect(evaluateBashGuard(undefined,),).toBe(undefined,);
            expect(evaluateBashGuard({ command: 1, },),).toBe(undefined,);
          },
        },),
      ],
    },),
  ],
},);
