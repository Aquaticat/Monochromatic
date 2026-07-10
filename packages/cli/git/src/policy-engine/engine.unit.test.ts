import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { RuntimePolicyDefinition, } from './types.ts';
import { runPolicyEngine, } from './engine.ts';
import { renderPolicyEvents, } from './events.ts';

/** First deterministic ordering policy. */
const FIRST_POLICY: RuntimePolicyDefinition = {
  name: 'first-policy',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: ['pre-forward',],
  check: function checkFirstPolicy() {
    return Promise.resolve([{ code: 'first', message: 'first finding', },],);
  },
};
/** Second deterministic ordering policy. */
const SECOND_POLICY: RuntimePolicyDefinition = {
  name: 'second-policy',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: ['pre-forward',],
  check: function checkSecondPolicy() {
    return Promise.resolve([{ code: 'second', message: 'second finding', },],);
  },
};
/** Policy that violates engine exception contract. */
const THROWING_POLICY: RuntimePolicyDefinition = {
  name: 'throwing-policy',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: ['pre-forward',],
  check: function checkThrowingPolicy() {
    return Promise.reject(new Error('intentional policy failure',),);
  },
};

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
        expect(renderPolicyEvents(result.events,).endsWith('\n',),).toBe(true,);
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
      name: 'runs migrated safeguards with policy metadata and severity',
      fn: async function testMigratedPolicyMetadata() {
        /** Warn-unsafe add policy finding. */
        const addWarn = await runPolicyEngine({
          args: ['add', '.',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', 'add-explicit': 'warn', }, },
        },);
        expect(addWarn.shouldForward,).toBe(true,);
        /** Settled add warning event. */
        const [addEvent,] = addWarn.events;
        expect(addEvent?.policyId,).toBe('add-explicit',);
        expect(addEvent?.type,).toBe('finding',);
        if (addEvent?.type === 'finding')
          expect(addEvent.severity,).toBe('warn',);
        expect(addWarn.configWarnings,).toContain('Policy add-explicit is warn-unsafe but configured as warn.',);
        /** Warn-safe branch policy finding. */
        const branchWarn = await runPolicyEngine({
          args: ['branch', 'policy-topic',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', 'branch-worktree-only': 'warn', }, },
        },);
        expect(branchWarn.shouldForward,).toBe(true,);
        expect(branchWarn.events[0]?.policyId,).toBe('branch-worktree-only',);
        expect(branchWarn.configWarnings,).toEqual([],);
        /** Persistently disabled linked policy. */
        const linkedOff = await runPolicyEngine({
          args: ['clean', '-fd',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', 'linked-worktree-only': 'off', }, },
        },);
        expect(linkedOff.events,).toEqual([],);
      },
    },),
    it({
      name: 'preserves legacy and generic full-lifecycle escape controls',
      fn: async function testMigratedEscapeControls() {
        /** Legacy aliases in flag position. */
        const linked = await runPolicyEngine({
          args: ['clean', '-fd', '--no-enforce-worktree',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', }, },
        },);
        const branch = await runPolicyEngine({
          args: ['branch', 'topic', '--no-enforce-worktree-branch',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', }, },
        },);
        const add = await runPolicyEngine({
          args: ['add', '.', '--no-enforce-bulk-add',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', }, },
        },);
        expect(linked.args,).toEqual(['clean', '-fd',],);
        expect(branch.args,).toEqual(['branch', 'topic',],);
        expect(add.args,).toEqual(['add', '.',],);
        expect(linked.escapedPolicyIds.has('linked-worktree-only',),).toBe(true,);
        expect(branch.escapedPolicyIds.has('branch-worktree-only',),).toBe(true,);
        expect(add.escapedPolicyIds.has('add-explicit',),).toBe(true,);
        /** Abbreviated clean option consumes apparent alias as value. */
        const cleanValue = await runPolicyEngine({
          args: ['clean', '--excl', '--no-enforce-worktree', '--dry-run',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', }, },
        },);
        expect(cleanValue.args,).toContain('--no-enforce-worktree',);
        expect(cleanValue.escapedPolicyIds.has('linked-worktree-only',),).toBe(false,);
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
    it({
      name: 'honors fixed order and keep-going collection',
      fn: async function testKeepGoingOrder() {
        /** Default first-error result. */
        const stoppedResult = await runPolicyEngine({
          args: ['status',],
          trigger: 'pre-forward',
          registeredPolicies: [FIRST_POLICY, SECOND_POLICY,],
        },);
        /** Continued result. */
        const continuedResult = await runPolicyEngine({
          args: ['--cli-git-keep-going', 'status',],
          trigger: 'pre-forward',
          registeredPolicies: [FIRST_POLICY, SECOND_POLICY,],
        },);
        expect(stoppedResult.events,).toHaveLength(1,);
        expect(continuedResult.events,).toHaveLength(2,);
        expect(continuedResult.events.map(function eventCode(event,) {
          return event.type === 'finding' ? event.code : event.type;
        },),).toEqual(['first-policy/first', 'second-policy/second',],);
        expect(continuedResult.args,).toEqual(['status',],);
      },
    },),
    it({
      name: 'stops keep-going mode on policy failure',
      fn: async function testPolicyFailureStop() {
        /** Engine failure before later policy. */
        const result = await runPolicyEngine({
          args: ['--cli-git-keep-going', 'status',],
          trigger: 'pre-forward',
          registeredPolicies: [THROWING_POLICY, SECOND_POLICY,],
        },);
        expect(result.exitCode,).toBe(2,);
        expect(result.events,).toHaveLength(1,);
        expect(result.events[0]?.type,).toBe('engine-failure',);
      },
    },),
  ],
},);
