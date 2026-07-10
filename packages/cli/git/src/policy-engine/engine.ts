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
  PolicyDefinition,
  PolicyFinding,
} from '../api/policy-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  createEngineFailureEvent,
  createFindingEvent,
  type PolicyEvent,
} from './events.ts';
import { requireRootPolicy, } from './require-root-policy.ts';
import type {
  ParsedPolicyControls,
  PolicyEngineResult,
  RunPolicyEngineOptions,
} from './types.ts';

/**
 * Wrapper-only continue flag.
 */
const KEEP_GOING_FLAG = '--cli-git-keep-going';
/**
 * Value-taking options whose following token is never wrapper control syntax.
 */
const VALUE_TAKING_OPTIONS: ReadonlySet<string> = new Set([
  '-c',
  '-C',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--attr-source',
  '-m',
  '--message',
  '-F',
  '--file',
  '--author',
  '--date',
]);
/**
 * Supported policies in fixed built-in order.
 */
const BUILT_IN_POLICIES: readonly PolicyDefinition[] = [requireRootPolicy,];
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
 * Returns escape flag for policy ID.
 *
 * @param policyId - policy receiving one-invocation bypass
 *
 * @returns exact wrapper-only flag
 */
function escapeFlag(policyId: string,): string {
  return `--no-enforce-${policyId}`;
}

/**
 * Parses wrapper controls without treating option values or pathspecs as flags.
 *
 * @param args - exact wrapper arguments
 *
 * @returns controls plus forwardable argument sequence
 */
function parsePolicyControls(args: readonly string[],): ParsedPolicyControls {
  /**
   * Escape flags recognized by current built-in registry.
   */
  const knownEscapeFlags = new Map(BUILT_IN_POLICIES.map(function toEscapeEntry(policy,) {
    return [
      escapeFlag(policy.name,),
      policy.name,
    ] as const;
  },),);
  /**
   * Mutable scan is isolated so cursor state cannot leak into later engine work.
   */
  const controls = (function collectControls(): ParsedPolicyControls {
    /**
     * Policy IDs bypassed before pathspec separator.
     */
    const escapedPolicyIds = new Set<string>();
    /**
     * Whether invocation requested continued policy collection.
     */
    let keepGoing = false;
    /**
     * Whether Git pathspec separator was consumed.
     */
    let separatorReached = false;
    /**
     * Whether current token is previous option's value.
     */
    let previousTakesValue = false;
    /**
     * Arguments retained for real Git.
     */
    const forwardableArgs = args.filter(function retainArgument(arg,) {
      if (separatorReached)
        return true;
      if (arg === '--') {
        separatorReached = true;
        return true;
      }
      if (previousTakesValue) {
        previousTakesValue = false;
        return true;
      }
      previousTakesValue = VALUE_TAKING_OPTIONS.has(arg,);
      if (arg === KEEP_GOING_FLAG) {
        keepGoing = true;
        return false;
      }
      /**
       * Policy selected by current exact escape flag.
       */
      const escapedPolicyId = knownEscapeFlags.get(arg,);
      if (escapedPolicyId !== undefined) {
        escapedPolicyIds.add(escapedPolicyId,);
        return false;
      }
      return true;
    },);
    return {
      args: forwardableArgs,
      keepGoing,
      escapedPolicyIds,
    };
  })();
  return controls;
}

/**
 * Creates current command policy context with lazy facts for this candidate version.
 *
 * @param rawArgs - exact wrapper arguments
 *
 * @param transformedArgs - wrapper controls removed before real Git
 *
 * @returns initial candidate-state context
 */
function createPolicyContext({
  rawArgs,
  transformedArgs,
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[]
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
    trigger: 'pre-forward',
    command: {
      rawArgs,
      transformedArgs,
      subcommand,
      effectiveCwd,
      repositoryRoot: effectiveCwd,
      escapedPolicyIds: new Set(),
    },
    git: EMPTY_LAZY_GIT_FACTS,
    signal: new AbortController().signal,
  };
}

/**
 * Confirms returned policy findings have first-slice runtime shape.
 *
 * @param findings - untrusted policy return value
 *
 * @returns whether every finding has required non-empty strings
 */
function findingsAreValid(findings: readonly PolicyFinding[],): boolean {
  return findings.every(function findingIsValid(finding,) {
    return ((typeof finding.code) === 'string')
      && (finding.code
        .length
        > 0)
      && ((typeof finding.message) === 'string')
      && (finding.message
        .length
        > 0);
  },);
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
}: RunPolicyEngineOptions,): Promise<PolicyEngineResult> {
  /**
   * Wrapper controls and real-Git arguments.
   */
  const controls = parsePolicyControls(args,);
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
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'config-invalid',
        message: 'Built-in policy configuration is invalid.',
      },),],
      configWarnings: [],
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
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'config-invalid',
        message: `Unknown built-in policy ID: ${unknownId}`,
      },),],
      configWarnings: [],
      exitCode: 2,
      shouldForward: false,
    };
  }

  /**
   * Direct-check filter optimized for sequential lookup.
   */
  const selectedSet = new Set(selectedIds,);
  /**
   * Candidate-state context shared by current stable pass.
   */
  const context = createPolicyContext({
    rawArgs: args,
    transformedArgs: controls.args,
  },);
  /**
   * Settled events buffered until policy checks finish.
   */
  const events: PolicyEvent[] = [];
  /**
   * Non-blocking unsafe severity diagnostics.
   */
  const configWarnings: string[] = [];

  for (const policy of registeredPolicies) {
    if (!policy.triggers
      .includes(trigger,))
      continue;
    if ((selectedSet.size > 0) && (!selectedSet.has(policy.name,)))
      continue;
    if (controls.escapedPolicyIds
      .has(policy.name,))
      continue;

    /**
     * Persistent override or policy declaration default.
     */
    const severity = parsedConfig.output
      .policies[policy.name]
      ?? policy.defaultSeverity;
    if (severity === 'off')
      continue;
    if ((severity === 'warn') && (!policy.warnSafe))
      configWarnings.push(`Policy ${policy.name} is warn-unsafe but configured as warn.`,);

    try {
      /**
       * Findings from current policy in fixed sequential order.
       */
      // oxlint-disable-next-line no-await-in-loop -- Policy contract requires sequential checks in fixed registration order.
      const findings = await policy.check({
        context: {
          ...context,
          trigger,
        },
        options: undefined,
      },);
      if (!findingsAreValid(findings,))
        throw new TypeError(`Policy ${policy.name} returned an invalid finding.`,);
      events.push(...findings.map(function toFindingEvent(
        finding,
        findingIndex,
      ) {
        return createFindingEvent({
          sequence: events.length + findingIndex,
          trigger,
          policyId: policy.name,
          severity,
          code: finding.code,
          message: finding.message,
          ...(finding.path === undefined ? {} : { path: finding.path, }),
          ...(finding.location === undefined ? {} : { location: finding.location, }),
          fix: finding.patch === undefined ? 'none' : 'available',
        },);
      },),);
      if ((severity === 'error') && (findings.length > 0)
        && (!controls.keepGoing))
        break;
    }
    catch (error: unknown) {
      /**
       * Safe diagnostic for arbitrary thrown policy value.
       */
      const message = Error.isError(error,) ? error.message : String(error,);
      events.push(createEngineFailureEvent({
        sequence: events.length,
        code: 'policy-incomplete',
        message,
        trigger,
        policyId: policy.name,
      },),);
      return {
        args: controls.args,
        events,
        configWarnings,
        exitCode: 2,
        shouldForward: false,
      };
    }
  }

  /**
   * Whether stable pass contains any blocking finding.
   */
  const hasError = events.some(function isBlockingFinding(event,) {
    return (event.type === 'finding') && (event.severity === 'error');
  },);
  return {
    args: controls.args,
    events,
    configWarnings,
    exitCode: hasError ? 1 : 0,
    shouldForward: !hasError,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
