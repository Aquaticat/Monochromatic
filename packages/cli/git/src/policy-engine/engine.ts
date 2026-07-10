/** First stable-pass policy engine slice. @module */
import * as v from 'valibot';
import { ABSENT_GIT_VALUE, } from '../api/context-types.ts';
import type {
  PolicyContext,
  PolicyDefinition,
  PolicyFinding,
  PolicySeverity,
} from '../api/policy-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  createEngineFailureEvent,
  createFindingEvent,
  type PolicyEvent,
} from './events.ts';
import { requireRootPolicy, } from './require-root-policy.ts';

/** Wrapper-only continue flag. */
const KEEP_GOING_FLAG = '--cli-git-keep-going';
/** Value-taking options whose following token is never wrapper control syntax. */
const VALUE_TAKING_OPTIONS: ReadonlySet<string> = new Set([
  '-c', '-C', '--git-dir', '--work-tree', '--namespace', '--super-prefix',
  '--attr-source', '-m', '--message', '-F', '--file', '--author', '--date',
]);
/** Supported policies in fixed built-in order. */
const BUILT_IN_POLICIES: readonly PolicyDefinition<undefined>[] = [requireRootPolicy,];
/** Built-in-only configuration schema for this slice. */
const ENGINE_CONFIG_SCHEMA = v.looseObject({
  policies: v.optional(v.record(v.string(), v.picklist(['off', 'warn', 'error',] as const,),), {}),
},);

/** Configuration accepted by engine invocation. */
export type PolicyEngineConfig = Readonly<{
  /** Persistent built-in severity overrides. */
  policies?: Readonly<Record<string, PolicySeverity>>;
}>;
/** Policy engine invocation options. */
export type RunPolicyEngineOptions = Readonly<{
  /** Exact wrapper arguments. */
  args: readonly string[];
  /** Lifecycle trigger. */
  trigger: 'pre-forward' | 'direct-check';
  /** Persistent built-in settings. */
  config?: PolicyEngineConfig;
  /** Optional direct-check policy filter. */
  selectedPolicyIds?: readonly string[];
}>;
/** Stable policy-engine result. */
export type PolicyEngineResult = Readonly<{
  /** Forwardable args after wrapper controls are removed. */
  args: readonly string[];
  /** Stable ordered events. */
  events: readonly PolicyEvent[];
  /** Unsafe warning configuration diagnostics. */
  configWarnings: readonly string[];
  /** Settled cli-git exit code. */
  exitCode: 0 | 1 | 2;
  /** Whether real Git should run. */
  shouldForward: boolean;
}>;
/** Parsed invocation controls. */
type ParsedPolicyControls = Readonly<{
  /** Forwardable arguments. */
  args: readonly string[];
  /** Continue mode. */
  keepGoing: boolean;
  /** Escaped policy IDs. */
  escapedPolicyIds: ReadonlySet<string>;
}>;

/** Returns escape flag for policy ID. */
function escapeFlag(policyId: string,): string {
  return `--no-enforce-${policyId}`;
}

/** Parses wrapper controls without treating option values or pathspecs as flags. */
function parsePolicyControls(args: readonly string[],): ParsedPolicyControls {
  const knownEscapeFlags = new Map(BUILT_IN_POLICIES.map(function toEscapeEntry(policy,) {
    return [escapeFlag(policy.name,), policy.name,] as const;
  },),);
  const escapedPolicyIds = new Set<string>();
  let keepGoing = false;
  let separatorReached = false;
  let previousTakesValue = false;
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
    const escapedPolicyId = knownEscapeFlags.get(arg,);
    if (escapedPolicyId !== undefined) {
      escapedPolicyIds.add(escapedPolicyId,);
      return false;
    }
    return true;
  },);
  return { args: forwardableArgs, keepGoing, escapedPolicyIds, };
}

/** Creates current command policy context with lazy facts for this candidate version. */
function createPolicyContext({
  rawArgs,
  transformedArgs,
}: Readonly<{ rawArgs: readonly string[]; transformedArgs: readonly string[]; }>,): PolicyContext {
  const { effectiveCwd, subcommandIndex, } = parseGlobalOptions(transformedArgs,);
  return {
    command: {
      rawArgs,
      transformedArgs,
      subcommand: transformedArgs[subcommandIndex],
      effectiveCwd,
      escapedPolicyIds: new Set(),
    },
    repositoryRoot: effectiveCwd,
    candidateVersion: 0,
    stagedPaths: async function stagedPaths() { return []; },
    worktreePaths: async function worktreePaths() { return []; },
    readIndexBlob: async function readIndexBlob() { return ABSENT_GIT_VALUE; },
    readWorktreeFile: async function readWorktreeFile() { return ABSENT_GIT_VALUE; },
    readCandidateFile: async function readCandidateFile() { return ABSENT_GIT_VALUE; },
  };
}

/** Confirms returned policy findings have first-slice runtime shape. */
function findingsAreValid(findings: readonly PolicyFinding[],): boolean {
  return findings.every(function findingIsValid(finding,) {
    return typeof finding.code === 'string'
      && finding.code.length > 0
      && typeof finding.message === 'string'
      && finding.message.length > 0;
  },);
}

/**
 * Runs configured built-ins and buffers only settled pass events.
 *
 * @param options - invocation facts and persistent settings
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
}: RunPolicyEngineOptions,): Promise<PolicyEngineResult> {
  const controls = parsePolicyControls(args,);
  const parsedConfig = v.safeParse(ENGINE_CONFIG_SCHEMA, config,);
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

  const knownIds = new Set(BUILT_IN_POLICIES.map(function policyId(policy,) {
    return policy.name;
  },),);
  const configuredIds = Object.keys(parsedConfig.output.policies,);
  const selectedIds = selectedPolicyIds ?? [];
  const unknownId = [...configuredIds, ...selectedIds,].find(function isUnknown(policyId,) {
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

  const selectedSet = new Set(selectedIds,);
  const context = createPolicyContext({ rawArgs: args, transformedArgs: controls.args, },);
  const events: PolicyEvent[] = [];
  const configWarnings: string[] = [];
  let hasError = false;

  for (const policy of BUILT_IN_POLICIES) {
    if (!policy.triggers.includes(trigger,))
      continue;
    if (selectedSet.size > 0 && !selectedSet.has(policy.name,))
      continue;
    if (controls.escapedPolicyIds.has(policy.name,))
      continue;

    const severity = parsedConfig.output.policies[policy.name] ?? policy.defaultSeverity;
    if (severity === 'off')
      continue;
    if (severity === 'warn' && !policy.warnSafe)
      configWarnings.push(`Policy ${policy.name} is warn-unsafe but configured as warn.`,);

    try {
      const findings = await policy.check({
        context,
        trigger,
        severity,
        options: undefined,
      },);
      if (!findingsAreValid(findings,))
        throw new TypeError(`Policy ${policy.name} returned an invalid finding.`,);
      events.push(...findings.map(function toFindingEvent(finding,) {
        return createFindingEvent({
          sequence: events.length,
          trigger,
          policyId: policy.name,
          severity,
          code: finding.code,
          message: finding.message,
          path: finding.path,
          location: finding.location,
          fix: finding.patch === undefined ? 'none' : 'available',
        },);
      },),);
      if (severity === 'error' && findings.length > 0) {
        hasError = true;
        if (!controls.keepGoing)
          break;
      }
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error,);
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

  return {
    args: controls.args,
    events,
    configWarnings,
    exitCode: hasError ? 1 : 0,
    shouldForward: !hasError,
  };
}
