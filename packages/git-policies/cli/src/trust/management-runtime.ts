/**
 * Trust management command runtime.
 *
 * @module
 */
import { createInterface, } from 'node:readline/promises';
import {
  createEngineFailureEvent,
  type EngineFailureCode,
  renderPolicyEvents,
} from '../policy-engine/events.ts';
import { resolveAccountRegistryRoot, } from './account-root.ts';
import {
  CONFIG_ABSENT,
  discoverConfig,
  resolveConfigRepositoryRoot,
} from './config-discovery.ts';
import {
  inspectTrust,
  trustConfig,
  untrustConfig,
  untrustRepository,
} from './trust-service.ts';
import { TrustedConfigError, } from './config-loader.ts';

/**
 * Trust management action parsed by Optique.
 */
export type TrustManagementAction = Readonly<{
  /**
   * Action discriminator.
   */
  command: 'status' | 'trust' | 'untrust';
  /**
   * Explicit noninteractive consent for trust only.
   */
  yes?: true;
}>;

/**
 * Trust management runtime options.
 */
export type TrustManagementOptions = Readonly<{
  /**
   * Parsed action.
   */
  action: TrustManagementAction;
  /**
   * Git global options before `cli-git`.
   */
  gitGlobalArgs: readonly string[];
  /**
   * Internal complete test registry root.
   */
  registryRoot?: string;
}>;

/**
 * Writes trust disclosure to stderr.
 *
 * @param text - complete human-readable disclosure
 */
function discloseTrust(text: string,): void {
  console.error(text,);
}

/**
 * Supplies current audit time.
 *
 * @returns current Date
 */
function currentTime(): Date {
  return new Date();
}

/**
 * Emits one trust-management failure on stdout JSONL.
 *
 * @param code - stable engine failure code
 *
 * @param message - human-readable failure detail
 *
 * @returns engine failure exit code
 */
function emitTrustFailure({
  code,
  message,
}: Readonly<{
  code: EngineFailureCode;
  message: string;
}>,): 2 {
  process.stdout
    .write(renderPolicyEvents([createEngineFailureEvent({
    sequence: 0,
    code,
    message,
  },),],),);
  return 2;
}

/**
 * Requests explicit interactive consent without auto-trusting CI.
 *
 * @returns whether user typed exact affirmative `yes`
 */
async function promptForTrust(): Promise<boolean> {
  if ((!process.stdin
    .isTTY) || (!process.stderr
      .isTTY))
    return false;
  /**
   * Disposable readline prompt bound to terminal streams.
   */
  using prompt = createInterface({
    input: process.stdin,
    output: process.stderr,
  },);
  /**
   * Exact interactive response.
   */
  const answer = await prompt.question('Type yes to trust this exact snapshot: ',);
  return answer.trim()
    .toLowerCase()
    === 'yes';
}

/**
 * Runs trust, untrust, or status without executing live configuration in preflight.
 *
 * @param action - parsed management action
 *
 * @param gitGlobalArgs - Git global options determining effective repository
 *
 * @param registryRoot - internal test override unavailable from environment or config
 *
 * @returns settled cli-git exit code
 *
 * @example
 * ```ts
 * await runTrustManagement({ action: { command: 'status' }, gitGlobalArgs: [], registryRoot });
 * ```
 */
export async function runTrustManagement({
  action,
  gitGlobalArgs,
  registryRoot,
}: TrustManagementOptions,): Promise<0 | 2> {
  try {
    /**
     * Canonical config discovered without execution.
     */
    const discovered = await discoverConfig(gitGlobalArgs,);
    if (discovered === CONFIG_ABSENT) {
      if (action.command === 'status') {
        console.log(JSON.stringify({
          schemaVersion: 1,
          type: 'trust-status',
          configPresent: false,
          trusted: false,
          unchanged: false,
          reason: 'no-config',
        },),);
        return 0;
      }
      if (action.command === 'untrust') {
        /**
         * Canonical repository root retained after config deletion.
         */
        const repositoryRoot = await resolveConfigRepositoryRoot(gitGlobalArgs,);
        if (repositoryRoot === CONFIG_ABSENT)
          return emitTrustFailure({
            code: 'trust-failed',
            message: 'No repository was found for trust recovery.',
          },);
        /**
         * Injected test root or OS-account-derived production root.
         */
        const recoveredRegistryRoot = registryRoot ?? await resolveAccountRegistryRoot();
        /**
         * Recovered recursive revocation summary.
         */
        const result = await untrustRepository({
          repositoryRoot,
          registryRoot: recoveredRegistryRoot,
          disclose: discloseTrust,
        },);
        console.log(JSON.stringify({
          schemaVersion: 1,
          type: 'untrust-summary',
          configPath: null,
          removed: result.removed,
          affectedRoots: result.affectedRoots,
        },),);
        return 0;
      }
      return emitTrustFailure({
        code: 'trust-failed',
        message: 'No repository configuration was found at the canonical repository root.',
      },);
    }
    /**
     * Injected test root or OS-account-derived production root.
     */
    const effectiveRegistryRoot = registryRoot ?? await resolveAccountRegistryRoot();
    if (action.command === 'status') {
      console.log(JSON.stringify({
        schemaVersion: 1,
        type: 'trust-status',
        ...await inspectTrust({
          discovered,
          registryRoot: effectiveRegistryRoot,
        },),
      },),);
      return 0;
    }
    if (action.command === 'untrust') {
      /**
       * Recursive revocation summary after pre-mutation disclosure.
       */
      const result = await untrustConfig({
        discovered,
        registryRoot: effectiveRegistryRoot,
        disclose: discloseTrust,
      },);
      console.log(JSON.stringify({
        schemaVersion: 1,
        type: 'untrust-summary',
        configPath: discovered.configPath,
        removed: result.removed,
        affectedRoots: result.affectedRoots,
      },),);
      return 0;
    }
    await trustConfig({
      discovered,
      registryRoot: effectiveRegistryRoot,
      yes: action.yes === true,
      adapters: {
        disclose: discloseTrust,
        prompt: promptForTrust,
        now: currentTime,
      },
    },);
    console.log(JSON.stringify({
      schemaVersion: 1,
      type: 'trust-summary',
      configPath: discovered.configPath,
      trusted: true,
    },),);
    return 0;
  }
  catch (error: unknown) {
    return emitTrustFailure({
      code: error instanceof TrustedConfigError
        ? error.code
        : 'trust-failed',
      message: Error.isError(error,)
        ? error.message
        : String(error,),
    },);
  }
}
