/**
 * Single-artifact MJS trust lifecycle.
 *
 * @module
 */
import { captureTrustCandidate, } from './candidate.ts';
import {
  executeStoredConfig,
  exactBytesEqual,
  loadStrictMjs,
  TrustedConfigError,
} from './config-loader.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { validateMjs, } from './mjs-validator.ts';
import { readPrivateFile, } from './record-validation.ts';
import { recordDirectory, } from './registry-path.ts';
import { ensureRegistryRoot, } from './registry-io.ts';
import {
  loadRecord,
  prepareMjsRecord,
  removeRecord,
} from './registry-storage.ts';
import type {
  LoadedTrustedConfig,
  TrustCandidate,
  TrustStatus,
} from './types.ts';

/**
 * Trust consent and output adapters.
 */
export type TrustConsentAdapters = Readonly<{
  /**
   * Writes human-readable disclosure to stderr boundary.
   */
  disclose: (text: string,) => void;
  /**
   * Requests explicit interactive affirmative response.
   */
  prompt: () => Promise<boolean>;
  /**
   * Supplies audit timestamp.
   */
  now: () => Date;
}>;

/**
 * Reports whether filesystem error means path absence.
 *
 * @param error - arbitrary failure
 *
 * @returns whether code is ENOENT
 */
function isMissingPath(error: unknown,): boolean {
  return Error.isError(error,)
    && ('code' in error)
    && (error.code === 'ENOENT');
}

/**
 * Determines snapshot change state for disclosure without executing config.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact live candidate
 *
 * @returns human-readable exact snapshot state
 */
async function snapshotState({
  registryRoot,
  candidate,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
}>,): Promise<'new' | 'unchanged' | 'changed' | 'corrupt'> {
  try {
    /**
     * Existing validated record when present.
     */
    const record = await loadRecord({
      registryRoot,
      candidate,
    },);
    /**
     * Existing record directory.
     */
    const directory = recordDirectory({
      registryRoot,
      identity: candidate.identity,
    },);
    /**
     * Existing exact executable bytes.
     */
    const storedBytes = await readPrivateFile(joinSnapshot({
      directory,
      snapshotFile: record.executableSnapshotFile,
    },),);
    return exactBytesEqual({
      left: candidate.bytes,
      right: storedBytes,
    })
      ? 'unchanged'
      : 'changed';
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return 'new';
    return 'corrupt';
  }
}

/**
 * Resolves record-relative snapshot path after registry validation supplied path.
 *
 * @param directory - exact record directory
 *
 * @param snapshotFile - validated record-relative path
 *
 * @returns absolute snapshot path
 */
function joinSnapshot({
  directory,
  snapshotFile,
}: Readonly<{
  directory: string;
  snapshotFile: string;
}>,): string {
  return `${directory}/${snapshotFile}`;
}

/**
 * Creates complete root-consent disclosure.
 *
 * @param candidate - exact candidate
 *
 * @param state - exact snapshot comparison state
 *
 * @param nodeBuiltins - retained Node built-in imports
 *
 * @returns human-readable disclosure
 */
function rootDisclosure({
  candidate,
  state,
  nodeBuiltins,
}: Readonly<{
  candidate: TrustCandidate;
  state: 'new' | 'unchanged' | 'changed' | 'corrupt';
  nodeBuiltins: readonly string[];
}>,): string {
  /**
   * Disclosure-friendly retained built-in list.
   */
  const builtins = nodeBuiltins.length === 0 ? '(none)' : nodeBuiltins.join(', ',);
  return [
    'cli-git trust request',
    `Configuration: ${candidate.discovered
      .configPath}`,
    'Format: mjs',
    `Filesystem identity: ${candidate.identity
      .filesystemId}`,
    `Filesystem identity stability: ${candidate.filesystemStable
      ? 'stable across reboot'
      : `runtime-only (${candidate.filesystemStabilityReason ?? 'stable identity unavailable'})`}`,
    `Exact snapshot state: ${state}`,
    `Exact snapshot bytes: ${candidate.size}`,
    `Static Node built-ins: ${builtins}`,
    'Authority: trusted code runs with your full account permissions.',
    'It may read and write files, run programs, access the network, automatically modify Git content, and behave incorrectly despite transaction safeguards.',
    'Recursive intent is evaluated only after root execution is authorized.',
  ].join('\n',);
}

/**
 * Explicitly trusts one self-contained MJS snapshot.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @param yes - explicit noninteractive approval
 *
 * @param adapters - disclosure, prompt, and clock effects
 *
 * @returns loaded validated config installed by trust
 *
 * @example
 * ```ts
 * await trustMjs({ discovered, registryRoot, yes: true, adapters });
 * ```
 */
export async function trustMjs({
  discovered,
  registryRoot,
  yes,
  adapters,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
  yes: boolean;
  adapters: TrustConsentAdapters;
}>,): Promise<LoadedTrustedConfig> {
  /**
   * Exact pre-consent source candidate.
   */
  const candidate = await captureTrustCandidate(discovered,);
  /**
   * Syntax and static self-containment result.
   */
  const validation = validateMjs({
    bytes: candidate.bytes,
    sourceName: discovered.configPath,
  },);
  await ensureRegistryRoot(registryRoot,);
  /**
   * Exact prior snapshot comparison state.
   */
  const state = await snapshotState({
    registryRoot,
    candidate,
  },);
  adapters.disclose(rootDisclosure({
    candidate,
    state,
    nodeBuiltins: validation.nodeBuiltins,
  },),);
  /**
   * Explicit noninteractive or interactive root consent.
   */
  const approved = yes || await adapters.prompt();
  if (!approved)
    throw new TrustedConfigError(
      'trust-failed',
      'Trust declined; no persistent record was installed.',
    );

  /**
   * Private candidate record removed automatically unless committed.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt: adapters.now()
      .toISOString(),
  },);
  /**
   * Config executed and validated from private stored candidate.
   */
  const validated = await executeStoredConfig(prepared.executablePath,);
  if (validated.recursiveChildren) {
    throw new TrustedConfigError(
      'trust-failed',
      'Configuration requests recursive child trust, which is implemented by follow-up issue #346.',
    );
  }
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}

/**
 * Loads exact trusted record for one config-loading command.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @returns validated config executed from stored snapshot
 *
 * @example
 * ```ts
 * await loadTrustedConfig({ discovered, registryRoot });
 * ```
 */
export async function loadTrustedConfig({
  discovered,
  registryRoot,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
}>,): Promise<LoadedTrustedConfig> {
  /**
   * Fresh live candidate compared with exact stored bytes.
   */
  const candidate = await captureTrustCandidate(discovered,);
  /**
   * Validated exact-identity record or stable trust failure.
   */
  const record = await (async function readTrustedRecord(): ReturnType<typeof loadRecord> {
    try {
      return await loadRecord({
        registryRoot,
        candidate,
      },);
    }
    catch (error: unknown) {
      if (isMissingPath(error,)) {
        throw new TrustedConfigError(
          'config-untrusted',
          'cli-git configuration is not trusted; run `git cli-git trust` after reviewing it.',
        );
      }
      throw new TrustedConfigError(
        'trust-failed',
        `Trust record is invalid: ${String(error,)}`,
        { cause: error, },
      );
    }
  })();
  /**
   * Exact persistent record directory.
   */
  const directory = recordDirectory({
    registryRoot,
    identity: candidate.identity,
  },);
  return await loadStrictMjs({
    recordDirectory: directory,
    candidate,
    record,
  },);
}

/**
 * Inspects exact current trust state without executing configuration.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @returns trust status
 *
 * @example
 * ```ts
 * await inspectTrust({ discovered, registryRoot });
 * ```
 */
export async function inspectTrust({
  discovered,
  registryRoot,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
}>,): Promise<TrustStatus> {
  if (discovered.format !== 'mjs') {
    return {
      configPresent: true,
      trusted: false,
      unchanged: false,
      configPath: discovered.configPath,
      reason: 'typescript-unsupported',
    };
  }
  /**
   * Fresh live candidate inspected without execution.
   */
  const candidate = await captureTrustCandidate(discovered,);
  try {
    /**
     * Existing validated record.
     */
    const record = await loadRecord({
      registryRoot,
      candidate,
    },);
    /**
     * Exact existing record directory.
     */
    const directory = recordDirectory({
      registryRoot,
      identity: candidate.identity,
    },);
    /**
     * Exact stored executable bytes.
     */
    const snapshotBytes = await readPrivateFile(joinSnapshot({
      directory,
      snapshotFile: record.executableSnapshotFile,
    },),);
    /**
     * Live-to-stored byte equality.
     */
    const unchanged = exactBytesEqual({
      left: candidate.bytes,
      right: snapshotBytes,
    });
    return {
      configPresent: true,
      trusted: unchanged,
      unchanged,
      configPath: discovered.configPath,
      filesystemId: candidate.identity
        .filesystemId,
      reason: unchanged ? 'trusted' : 'changed',
    };
  }
  catch (error: unknown) {
    return {
      configPresent: true,
      trusted: false,
      unchanged: false,
      configPath: discovered.configPath,
      filesystemId: candidate.identity
        .filesystemId,
      reason: isMissingPath(error,) ? 'untrusted' : 'corrupt',
    };
  }
}

/**
 * Removes exact trust record without executing configuration.
 *
 * @param discovered - canonical discovered config
 *
 * @param registryRoot - injected or account-derived root
 *
 * @returns whether record existed
 *
 * @example
 * ```ts
 * await untrustConfig({ discovered, registryRoot });
 * ```
 */
export async function untrustConfig({
  discovered,
  registryRoot,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
}>,): Promise<boolean> {
  /**
   * Fresh identity candidate used without executing config.
   */
  const candidate = await captureTrustCandidate(discovered,);
  return await removeRecord({
    registryRoot,
    candidate,
  },);
}
