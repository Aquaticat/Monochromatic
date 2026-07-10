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
/** Lifecycle triggers currently invocable through first policy-engine slice. */
const INVOCABLE_TRIGGERS = [
  'pre-forward',
  'direct-check',
] as const;
/** Policy that must never execute when escaped across lifecycle triggers. */
const LIFECYCLE_POLICY: RuntimePolicyDefinition = {
  name: 'lifecycle-policy',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: INVOCABLE_TRIGGERS,
  check: function rejectUnexpectedLifecycleExecution() {
    return Promise.reject(new Error('escaped lifecycle policy executed',),);
  },
};
/** Policy proving later invocation stages can observe earlier escape controls. */
const ESCAPE_OBSERVER_POLICY: RuntimePolicyDefinition = {
  name: 'escape-observer',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: INVOCABLE_TRIGGERS,
  check: function observeEscapedPolicy({ context, }) {
    if (context.command.escapedPolicyIds.has('lifecycle-policy',))
      return Promise.resolve([],);
    return Promise.resolve([{
      code: 'escape-state-missing',
      message: 'Invocation-wide escape state was not retained.',
    },],);
  },
};
/** Plugin proving raw and fixed transformed command views. */
const TRANSFORM_OBSERVER_POLICY: RuntimePolicyDefinition = {
  name: 'fixture/transform-observer',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['pre-forward',],
  check: function observeTransformViews({ context, }) {
    const rawMatches = context.command.rawArgs.join('\0',) === ['push', 'origin', 'main',].join('\0',);
    const transformedMatches = context.command.transformedArgs.join('\0',)
      === ['push', '--atomic', 'origin', 'main',].join('\0',);
    if (rawMatches && transformedMatches)
      return Promise.resolve([],);
    return Promise.resolve([{
      code: 'command-view-mismatch',
      message: 'Plugin did not receive stable raw and transformed command views.',
    },],);
  },
};
/** Policy exposing candidate version and ordered patch proposal. */
const PATCH_POLICY: RuntimePolicyDefinition = {
  name: 'fixture/patch',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: ['pre-forward',],
  check: function proposePatch({ context, }) {
    return Promise.resolve([{
      code: `version-${String(context.candidateVersion,)}`,
      message: 'fixture patch',
      path: 'file.txt',
      patch: {
        kind: 'git-unified',
        targetId: 'target',
        path: 'file.txt',
        bytes: new TextEncoder().encode('patch',),
      },
    },],);
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
/** Policy returning a finding that violates engine validation. */
const INVALID_FINDING_POLICY: RuntimePolicyDefinition = {
  name: 'invalid-finding-policy',
  defaultSeverity: 'error',
  warnSafe: true,
  triggers: ['pre-forward',],
  check: function checkInvalidFindingPolicy() {
    return Promise.resolve([{ code: '', message: '', },],);
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
        expect(result.args,).toEqual(['status',],);
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
        expect(warnResult.events[1]?.type,).toBe('configuration-warning',);
        expect(warnResult.events[1]?.policyId,).toBe('require-root',);
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
        expect(escapedResult.args,).toEqual([
          '-c',
          'advice.statusHints=false',
          'status',
        ],);
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
        expect(addWarn.events[1]?.type,).toBe('configuration-warning',);
        expect(addWarn.events[1]?.policyId,).toBe('add-explicit',);
        /** Warn-safe branch policy finding. */
        const branchWarn = await runPolicyEngine({
          args: ['branch', 'policy-topic',],
          trigger: 'pre-forward',
          config: { policies: { 'require-root': 'off', 'branch-worktree-only': 'warn', }, },
        },);
        expect(branchWarn.shouldForward,).toBe(true,);
        expect(branchWarn.events[0]?.policyId,).toBe('branch-worktree-only',);
        expect(branchWarn.events.length,).toBe(1,);
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
      name: 'stages fixed transforms before plugin command facts',
      fn: async function testPluginTransformFacts() {
        /** Plugin-only staged engine result. */
        const result = await runPolicyEngine({
          args: ['push', 'origin', 'main',],
          trigger: 'pre-forward',
          registeredPolicies: [TRANSFORM_OBSERVER_POLICY,],
        },);
        expect(result.events,).toEqual([],);
        expect(result.args,).toEqual(['push', '--atomic', 'origin', 'main',],);
        expect(result.shouldForward,).toBe(true,);
      },
    },),
    it({
      name: 'retains escaped policy for complete invocation lifecycle',
      fn: async function testFullLifecycleEscape() {
        /** Results from every supported lifecycle trigger. */
        const results = await Promise.all(INVOCABLE_TRIGGERS.map(async function runEscapedTrigger(trigger,) {
          return runPolicyEngine({
            args: ['--no-enforce-lifecycle-policy', 'status',],
            trigger,
            registeredPolicies: [LIFECYCLE_POLICY, ESCAPE_OBSERVER_POLICY,],
          },);
        },),);
        results.forEach(function assertSkipped(result,) {
          expect(result.events,).toEqual([],);
          expect(result.escapedPolicyIds.has('lifecycle-policy',),).toBe(true,);
          expect(result.shouldForward,).toBe(true,);
        },);
        const [preForwardResult, directCheckResult,] = results;
        expect(preForwardResult?.args,).toEqual([
          '-c',
          'advice.statusHints=false',
          'status',
        ],);
        expect(directCheckResult?.args,).toEqual(['status',],);
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
        expect(continuedResult.args,).toEqual([
          '-c',
          'advice.statusHints=false',
          'status',
        ],);
      },
    },),
    it({
      name: 'retains ordered patches and candidate version',
      fn: async function testPatchPassFacts() {
        /** Candidate-aware provisional pass. */
        const result = await runPolicyEngine({
          args: ['--cli-git-keep-going', 'commit', '--no-only', '-m', 'message',],
          trigger: 'pre-forward',
          candidateVersion: 2,
          registeredPolicies: [PATCH_POLICY, THROWING_POLICY,],
        },);
        expect(result.patches,).toHaveLength(1,);
        expect(result.events,).toHaveLength(1,);
        expect(result.patches[0]?.targetId,).toBe('target',);
        expect(result.events[0]?.type === 'finding' ? result.events[0].code : '',)
          .toBe('fixture/patch/version-2',);
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
        expect(result.events[0]?.type === 'engine-failure' ? result.events[0].code : '',)
          .toBe('plugin-threw',);
      },
    },),
    it({
      name: 'distinguishes invalid policy output from plugin exceptions',
      fn: async function testInvalidFindingFailure() {
        /** Engine-owned validation failure after plugin completion. */
        const result = await runPolicyEngine({
          args: ['status',],
          trigger: 'pre-forward',
          registeredPolicies: [INVALID_FINDING_POLICY,],
        },);
        expect(result.exitCode,).toBe(2,);
        expect(result.events[0]?.type === 'engine-failure' ? result.events[0].code : '',)
          .toBe('policy-incomplete',);
      },
    },),
  ],
},);
