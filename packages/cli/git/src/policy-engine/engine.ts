/**
 * First stable-pass policy engine slice. @module
 */
import * as v from 'valibot';
import {
  ABSENT_GIT_VALUE,
  type LazyPolicyGitFacts,
} from '../api/context-types.ts';
import type {
  PolicyContext,
  PolicyTrigger,
} from '../api/policy-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { BUILT_IN_POLICIES, } from './built-ins.ts';
import { parsePolicyControls, } from './controls.ts';
import {
  createEngineFailureEvent,
  type PolicyEvent,
} from './events.ts';
import { applyFixedTransforms, } from './fixed-transforms.ts';
import { runPolicyStage, } from './policy-stage.ts';
import type {
  PolicyEngineResult,
  RunPolicyEngineOptions,
  RuntimePolicyDefinition,
} from './types.ts';

/**
 * Empty lazy Git facts for command-only built-ins in first slice.
 */
const EMPTY_LAZY_GIT_FACTS: LazyPolicyGitFacts = {
  candidates: function candidates() { return Promise.resolve([],); },
  headOid: function headOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
  landedCommitOid: function landedCommitOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
  pushUpdates: function pushUpdates() { return Promise.resolve([],); },
};
/**
 * Built-in-only configuration schema for this slice.
 */
const ENGINE_CONFIG_SCHEMA = v.looseObject({
  policies: v.optional(
    v.record(
      v.string(),
      v.picklist([
        'off',
        'warn',
        'error',
      ] as const,),
    ),
    {}
  ),
},);

/**
 * Creates current command policy context with lazy facts for this candidate version.
 *
 * @param rawArgs - exact wrapper arguments
 *
 * @param transformedArgs - wrapper controls removed before real Git
 *
 * @param escapedPolicyIds - invocation-wide skipped policy identifiers
 *
 * @param trigger - active lifecycle point
 *
 * @returns initial candidate-state context
 */
function createPolicyContext({
  rawArgs,
  transformedArgs,
  escapedPolicyIds,
  trigger,
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[];
  escapedPolicyIds: ReadonlySet<string>;
  trigger: PolicyTrigger;
}>,): PolicyContext {
  /**
   * Parsed command location and effective directory.
   */
  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(transformedArgs,);
  /**
   * Subcommand or explicit absence sentinel.
   */
  const subcommand = transformedArgs[subcommandIndex] ?? ABSENT_GIT_VALUE;
  return {
    candidateVersion: 0,
    trigger,
    command: {
      rawArgs,
      transformedArgs,
      subcommand,
      effectiveCwd,
      repositoryRoot: effectiveCwd,
      escapedPolicyIds,
    },
    git: EMPTY_LAZY_GIT_FACTS,
    signal: new AbortController().signal,
  };
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Internal registry contains callback-bearing policy declarations; engine reads but never mutates them, as documented in docs/troubleshooting/oxlint-prefer-readonly-authoring-identity.md. */
/**
 * Runs configured built-ins and buffers only settled pass events.
 *
 * @param args - exact wrapper arguments
 *
 * @param trigger - lifecycle point being checked
 *
 * @param config - persistent built-in settings
 *
 * @param selectedPolicyIds - direct-check filter
 *
 * @param registeredPolicies - internal deterministic registry adapter
 *
 * @param policyOptions - runtime-validated outputs by effective policy ID
 *
 * @returns policy decision and forwardable arguments
 *
 * @example
 * ```ts
 * await runPolicyEngine({ args: ['status'], trigger: 'pre-forward' });
 * ```
 */
export async function runPolicyEngine({
  args,
  trigger,
  config = {},
  selectedPolicyIds,
  registeredPolicies = BUILT_IN_POLICIES,
  policyOptions = new Map(),
}: RunPolicyEngineOptions,): Promise<PolicyEngineResult> {
  /**
   * Wrapper controls and real-Git arguments.
   */
  const controls = parsePolicyControls({
    args,
    registeredPolicies,
  },);
  /**
   * Runtime-authoritative built-in configuration parse.
   */
  const parsedConfig = v.safeParse(
    ENGINE_CONFIG_SCHEMA,
    config,
  );
  if (!parsedConfig.success) {
    return {
      args: controls.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'config-invalid',
        message: 'Built-in policy configuration is invalid.',
      },),],
      exitCode: 2,
      shouldForward: false,
    };
  }

  /**
   * Every policy ID supported by current built-in registry.
   */
  const knownIds = new Set(registeredPolicies.map(function policyId(policy,) {
    return policy.name;
  },),);
  /**
   * IDs named by persistent configuration.
   */
  const configuredIds = Object.keys(parsedConfig.output
    .policies,);
  /**
   * IDs named by direct-check filter.
   */
  const selectedIds = selectedPolicyIds ?? [];
  /**
   * First ID outside built-in registry.
   */
  const unknownId = [
    ...configuredIds,
    ...selectedIds,
  ].find(function isUnknown(policyId,) {
    return !knownIds.has(policyId,);
  },);
  if (unknownId !== undefined) {
    return {
      args: controls.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'config-invalid',
        message: `Unknown built-in policy ID: ${unknownId}`,
      },),],
      exitCode: 2,
      shouldForward: false,
    };
  }

  /**
   * Direct-check filter optimized for sequential lookup.
   */
  const selectedSet = new Set(selectedIds,);
  /**
   * Canonical built-in IDs separating trusted plugins from fixed core.
   */
  const builtInIds = new Set(BUILT_IN_POLICIES.map(function builtInId(policy,) {
    return policy.name;
  },),);
  /**
   * Configurable built-ins retained in canonical registry order.
   */
  const builtInPolicies = registeredPolicies.filter(function isBuiltIn(policy,) {
    return builtInIds.has(policy.name,);
  },);
  /**
   * Trusted plugin policies retained after fixed transforms.
   */
  const pluginPolicies = registeredPolicies.filter(function isPlugin(policy,) {
    return !builtInIds.has(policy.name,);
  },);
  /**
   * Built-ins inspect control-clean raw semantic facts before transforms.
   */
  const builtInStage = await runPolicyStage({
    policies: builtInPolicies,
    context: createPolicyContext({
      rawArgs: args,
      transformedArgs: controls.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      trigger,
    },),
    trigger,
    severities: parsedConfig.output
      .policies,
    selectedPolicyIds: selectedSet,
    escapedPolicyIds: controls.escapedPolicyIds,
    policyOptions,
    keepGoing: controls.keepGoing,
    sequence: 0,
  },);
  if ((!builtInStage.complete) || builtInStage.stopped) {
    return {
      args: controls.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: builtInStage.events,
      exitCode: builtInStage.complete ? 1 : 2,
      shouldForward: false,
    };
  }
  /**
   * Fixed transforms run only at forwarded command lifecycle point.
   */
  const fixedStage = trigger === 'pre-forward'
    ? await applyFixedTransforms({
      args: controls.args,
      sequence: builtInStage.events
        .length,
    },)
    : {
      args: controls.args,
      events: [],
      complete: true,
    };
  /**
   * Events settled before trusted plugins execute.
   */
  const stagedEvents: readonly PolicyEvent[] = [
    ...builtInStage.events,
    ...fixedStage.events,
  ];
  /**
   * Whether fixed core produced expected blocking rejection.
   */
  const coreBlocked = fixedStage.events
    .some(function isCoreFinding(event,) {
    return event.type === 'core-finding';
  },);
  if ((!fixedStage.complete) || (coreBlocked && (!controls.keepGoing))) {
    return {
      args: fixedStage.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events: stagedEvents,
      exitCode: fixedStage.complete ? 1 : 2,
      shouldForward: false,
    };
  }
  /**
   * Plugins inspect exact raw input and fixed transformed command facts.
   */
  const pluginStage = await runPolicyStage({
    policies: pluginPolicies,
    context: createPolicyContext({
      rawArgs: args,
      transformedArgs: fixedStage.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      trigger,
    },),
    trigger,
    severities: parsedConfig.output
      .policies,
    selectedPolicyIds: selectedSet,
    escapedPolicyIds: controls.escapedPolicyIds,
    policyOptions,
    keepGoing: controls.keepGoing,
    sequence: stagedEvents.length,
  },);
  /**
   * Complete ordered invocation events.
   */
  const events: readonly PolicyEvent[] = [
    ...stagedEvents,
    ...pluginStage.events,
  ];
  if (!pluginStage.complete) {
    return {
      args: fixedStage.args,
      escapedPolicyIds: controls.escapedPolicyIds,
      events,
      exitCode: 2,
      shouldForward: false,
    };
  }
  /**
   * Whether stable pass contains any blocking policy or core finding.
   */
  const hasError = events.some(function isBlockingEvent(event,) {
    return (event.type === 'core-finding')
      || ((event.type === 'finding') && (event.severity === 'error'));
  },);
  return {
    args: fixedStage.args,
    escapedPolicyIds: controls.escapedPolicyIds,
    events,
    exitCode: hasError ? 1 : 0,
    shouldForward: !hasError,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
