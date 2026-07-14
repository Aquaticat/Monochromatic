/**
 * Optique management-command parser and dispatcher. @module
 */
import {
  command,
  constant,
  flag,
  object,
  optional,
  or,
  runParserSync,
} from '@optique/core';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { DIRECT_MANAGEMENT_PARSER, } from './management-direct-parser.ts';
import {
  createEngineFailureEvent,
  renderPolicyEvents,
} from './policy-engine/events.ts';
import { prepareDirectCheckFacts, } from './policy-engine/direct-check-facts.ts';
import { runDirectFix, } from './policy-engine/direct-fix.ts';
import { runPolicyEngine, } from './policy-engine/engine.ts';
import { TrustedConfigError, } from './trust/config-loader.ts';
import { runTrustManagement, } from './trust/management-runtime.ts';
import {
  resolveRuntimeConfig,
  RUNTIME_CONFIG_ABSENT,
} from './trust/runtime-config.ts';

/**
 * Sentinel returned when Optique renders help or a usage failure.
 */
const PARSE_STOPPED = Symbol('Optique management parsing stopped',);
/**
 * Trust command parser.
 */
const TRUST_PARSER = command(
  'trust',
  object({
    command: constant('trust' as const,),
    yes: optional(flag('--yes',),),
  },),
);
/**
 * Untrust command parser.
 */
const UNTRUST_PARSER = command(
  'untrust',
  object({
    command: constant('untrust' as const,),
  },),
);
/**
 * Status command parser.
 */
const STATUS_PARSER = command(
  'status',
  object({
  command: constant('status' as const,),
},),
);
/**
 * First management grammar slice.
 */
const MANAGEMENT_PARSER = or(
  TRUST_PARSER,
  UNTRUST_PARSER,
  STATUS_PARSER,
  DIRECT_MANAGEMENT_PARSER,
);

/**
 * Detects positional input before explicit pathspec separator.
 *
 * @param args - complete management arguments
 *
 * @returns whether non-option input appears before `--`
 */
function hasPreSeparatorPositional(args: readonly string[],): boolean {
  /**
   * Tokens before pathspec separator, excluding command name.
   */
  const separatorIndex = args.indexOf('--',);
  /**
   * Option region that cannot contain direct-check paths.
   */
  const optionRegion = args.slice(
    1,
    separatorIndex === (-1) ? args.length : separatorIndex,
  );
  /**
   * Parser state for separated `--policy <id>` values.
   */
  const state = optionRegion.reduce(
    function inspectOptionRegion(
    current,
    token,
  ): Readonly<{
    expectsPolicyValue: boolean;
    positionalFound: boolean
  }> {
    if (current.positionalFound)
      return current;
    if (current.expectsPolicyValue) {
      return {
        expectsPolicyValue: false,
        positionalFound: false,
      };
    }
    if (token === '--policy') {
      return {
        expectsPolicyValue: true,
        positionalFound: false,
      };
    }
    return {
      expectsPolicyValue: false,
      positionalFound: (token === '-') || (!token.startsWith('-',)),
    };
  },
    {
    expectsPolicyValue: false,
    positionalFound: false,
  },
  );
  return state.positionalFound;
}

/**
 * Direct-check runtime configuration resolution.
 */
type DirectRuntimeResolution =
  | Readonly<{ loaded: Awaited<ReturnType<typeof resolveRuntimeConfig>>; }>
  | Readonly<{ error: unknown; }>;

/**
 * Loads trusted direct-check config while retaining stable failure output.
 *
 * @param gitGlobalArgs - global options determining repository
 *
 * @param registryRoot - internal private registry root
 *
 * @returns loaded config or captured failure
 */
async function resolveDirectRuntime({
  gitGlobalArgs,
  registryRoot,
}: Readonly<{
  gitGlobalArgs: readonly string[];
  registryRoot?: string;
}>,): Promise<DirectRuntimeResolution> {
  try {
    return {
      loaded: await resolveRuntimeConfig({
        args: gitGlobalArgs,
        forceLoad: true,
        ...(registryRoot === undefined ? {} : { registryRoot, }),
      },),
    };
  }
  catch (error: unknown) {
    return { error, };
  }
}

/**
 * Parses and runs one namespaced management command.
 *
 * @param args - arguments following `git cli-git`
 *
 * @param gitGlobalArgs - arguments preceding `cli-git`
 *
 * @param registryRoot - internal complete test registry root
 *
 * @returns settled cli-git exit code
 *
 * @example
 * ```ts
 * await runManagementCommand({ args: ['status'], gitGlobalArgs: [] });
 * ```
 */
export async function runManagementCommand({
  args,
  gitGlobalArgs,
  registryRoot,
}: Readonly<{
  args: readonly string[];
  gitGlobalArgs: readonly string[];
  registryRoot?: string;
}>,): Promise<0 | 1 | 2> {
  /**
   * Parsed management action or parse-stop sentinel.
   */
  const parsed: unknown = runParserSync(
    MANAGEMENT_PARSER,
    'git cli-git',
    args,
    {
      onError: function stopAfterUsageError() { return PARSE_STOPPED; },
    },
  );
  if (parsed === PARSE_STOPPED)
    return 2;

  if (((typeof parsed) !== 'object') || (parsed === null)
    || (!('command' in parsed)))
    return 2;
  if ((parsed.command === 'trust')
    || (parsed.command === 'untrust')
    || (parsed.command === 'status')) {
    return await runTrustManagement({
      action: {
        command: parsed.command,
        ...(('yes' in parsed) && (parsed.yes === true) ? { yes: true, } : {}),
      },
      gitGlobalArgs,
      ...(registryRoot === undefined ? {} : { registryRoot, }),
    },);
  }

  if (((parsed.command !== 'check') && (parsed.command !== 'fix'))
    || (!('pathspecs' in parsed))
    || (!Array.isArray(parsed.pathspecs,))
    || (!('policies' in parsed))
    || (!Array.isArray(parsed.policies,)))
    return 2;
  if (hasPreSeparatorPositional(args,)) {
    console.error(`git cli-git ${parsed.command} pathspecs must follow --.`,);
    return 2;
  }
  /**
   * Position of required pathspec separator.
   */
  const separatorIndex = args.indexOf('--',);
  /**
   * Whether invocation selected non-empty pathspec scope.
   */
  const hasPathspecScope = (separatorIndex !== (-1)) && (parsed.pathspecs
    .length
    > 0);
  /**
   * Whether invocation selected complete repository scope.
   */
  const hasAllScope = ('all' in parsed) && (parsed.all === true);
  if (hasAllScope === hasPathspecScope) {
    console.error(`git cli-git ${parsed.command} requires exactly one scope: --all or non-empty pathspecs after --.`,);
    return 2;
  }
  if ((separatorIndex === (-1)) && (parsed.pathspecs
    .length
    > 0)) {
    console.error(`git cli-git ${parsed.command} pathspecs must follow --.`,);
    return 2;
  }

  /**
   * Deduplicated direct-check filter preserving first occurrence order.
   */
  const selectedPolicyIds = [...new Set(parsed.policies
    .filter(function isString(value,): value is string {
      return (typeof value) === 'string';
    },),),];
  /**
   * Trusted direct-check config resolution.
   */
  const runtimeResolution = await resolveDirectRuntime({
    gitGlobalArgs,
    ...(registryRoot === undefined ? {} : { registryRoot, }),
  },);
  if ('error' in runtimeResolution) {
    /**
     * Stable direct trust failure code.
     */
    const code = runtimeResolution.error instanceof TrustedConfigError
      ? runtimeResolution.error
        .code
      : 'trust-failed';
    process.stdout
      .write(renderPolicyEvents([createEngineFailureEvent({
      sequence: 0,
      code,
      message: caughtValueText(runtimeResolution.error,),
    },),],),);
    return 2;
  }
  /**
   * Loaded config or no-config sentinel.
   */
  const runtimeConfig = runtimeResolution.loaded;
  /**
   * Concrete direct-check Git pathspec scope.
   */
  const directPathspecs: readonly string[] = hasAllScope
    ? [':/',]
    : parsed.pathspecs
      .filter(function stringPathspec(value,): value is string {
      return (typeof value) === 'string';
    },);
  if (parsed.command === 'fix') {
    /**
     * Converged direct-fix operation.
     */
    const fixed = await runDirectFix({
      gitGlobalArgs,
      pathspecs: directPathspecs,
      policyOptions: {
        selectedPolicyIds,
        ...(runtimeConfig === RUNTIME_CONFIG_ABSENT
          ? {}
          : {
            config: { policies: runtimeConfig.validated
              .policySeverities, },
            registeredPolicies: runtimeConfig.validated
              .registeredPolicies,
            policyOptions: runtimeConfig.validated
              .policyOptions,
          }),
      },
    },);
    /**
     * Stable direct-fix JSONL.
     */
    const renderedEvents = renderPolicyEvents(fixed.policyResult
      .events,);
    if (renderedEvents !== '')
      process.stdout
        .write(renderedEvents,);
    return fixed.policyResult
      .exitCode;
  }
  /**
   * Exact private worktree/index projection or stable setup failure.
   */
  const directFacts = await prepareDirectCheckFacts({
    args,
    gitGlobalArgs,
    pathspecs: directPathspecs,
  },);
  if (directFacts.kind === 'failed') {
    process.stdout
      .write(renderPolicyEvents(directFacts.result
        .events,));
    return directFacts.result
      .exitCode;
  }
  /**
   * Scope-bound exact direct-check candidate facts.
   */
  await using scopedDirectFacts = directFacts.scope;
  /**
   * Built-in and trusted-plugin direct-check decision.
   */
  const result = await runPolicyEngine({
    args: gitGlobalArgs,
    trigger: 'direct-check',
    selectedPolicyIds,
    gitFacts: scopedDirectFacts.gitFacts,
    repositoryRoot: scopedDirectFacts.repositoryRoot,
    ...(runtimeConfig === RUNTIME_CONFIG_ABSENT
      ? {}
      : {
        config: { policies: runtimeConfig.validated
          .policySeverities, },
        registeredPolicies: runtimeConfig.validated
          .registeredPolicies,
        policyOptions: runtimeConfig.validated
          .policyOptions,
      }),
  },);
  /**
   * Stable direct-command JSONL.
   */
  const renderedEvents = renderPolicyEvents(result.events,);
  if (renderedEvents !== '')
    process.stdout
      .write(renderedEvents,);
  return result.exitCode;
}
