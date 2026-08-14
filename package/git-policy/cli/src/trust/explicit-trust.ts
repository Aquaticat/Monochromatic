/**
 * Explicit two-stage MJS trust consent and persistence. @module
 */
import { captureTrustCandidate, } from './candidate.ts';
import {
  executeStoredConfig,
  exactBytesEqual,
  TrustedConfigError,
} from './config-loader.ts';
import type { ValidatedConfig, } from './config-validation.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { validateMjs, } from './mjs-validator.ts';
import { readPrivateFile, } from './record-validation.ts';
import { recordDirectory, } from './registry-path.ts';
import {
  ensureRegistryRoot,
  isMissingPath,
} from './registry-io.ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';
import {
  loadRecord,
  prepareMjsRecord,
} from './registry-storage.ts';
import { explicitAuthorizers, } from './recursive-trust.ts';
import type {
  LoadedTrustedConfig,
  TrustCandidate,
  TrustConsentAdapters,
} from './types.ts';

/**
 * Determines prior exact snapshot state without execution.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact live candidate
 *
 * @returns disclosure snapshot state
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
     * Existing validated record.
     */
    const record = await loadRecord({
      registryRoot,
      candidate,
    },);
    /**
     * Exact existing snapshot bytes.
     */
    const storedBytes = await readPrivateFile(`${recordDirectory({
      registryRoot,
      identity: candidate.identity,
    },)}/${record.executableSnapshotFile}`,);
    return exactBytesEqual({
      left: candidate.bytes,
      right: storedBytes,
    })
      ? 'unchanged'
      : 'changed';
  }
  catch (error: unknown) {
    return isMissingPath(error,) ? 'new' : 'corrupt';
  }
}

/**
 * Creates complete root consent disclosure.
 *
 * @param candidate - exact candidate
 *
 * @param state - prior snapshot state
 *
 * @param nodeBuiltins - retained built-in imports
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
   * Disclosure-friendly retained built-ins.
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
 * Creates second-stage recursive authority disclosure.
 *
 * @param repositoryRoot - exact canonical recursive root
 *
 * @returns human-readable cross-filesystem warning
 */
function recursiveDisclosure(repositoryRoot: string,): string {
  return [
    'cli-git recursive trust request',
    `Recursive root: ${repositoryRoot}`,
    'Authority covers current and future descendant repositories beneath this exact canonical root.',
    'Inheritance intentionally crosses filesystem and mounted-volume boundaries.',
    'New descendant configs auto-enroll exact snapshots without another prompt and run with full account permissions.',
  ].join('\n',);
}

/**
 * Executes candidate from private temporary record without persistence.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact source candidate
 *
 * @param recordedAt - audit timestamp
 *
 * @mutates candidate through handle.writeFile configured VFS handler or native-boundary access to candidate.bytes
 *
 * @returns runtime-validated config
 */
async function validatePrivateCandidate({
  registryRoot,
  candidate,
  recordedAt,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
  recordedAt: string;
}>,): Promise<ValidatedConfig> {
  /**
   * Disposable private validation record.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt,
  },);
  return await executeStoredConfig(prepared.executablePath,);
}

/**
 * Explicitly trusts one self-contained MJS snapshot with two-stage consent.
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
   * Syntax and module-edge validation before consent.
   */
  const validation = validateMjs({
    bytes: candidate.bytes,
    sourceName: discovered.configPath,
  },);
  await ensureRegistryRoot(registryRoot,);
  /**
   * Exact prior snapshot state.
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
   * Root trust decision preserving unavailable terminal state.
   */
  const rootConsent = yes ? 'approved' : await adapters.prompt();
  if (rootConsent === 'unavailable')
    throw new TrustedConfigError(
      'trust-consent-unavailable',
      [
        'Interactive consent is unavailable because stdin or stderr is not a terminal, or input ended before a response.',
        'After reviewing the disclosure, run `git cli-git trust --yes`.',
        'No new trust record was installed.',
      ].join(' ',),
    );
  if (rootConsent === 'declined')
    throw new TrustedConfigError(
      'trust-failed',
      'Trust declined; no persistent record was installed.',
    );
  /**
   * Stable audit timestamp shared by validation and final record.
   */
  const recordedAt = adapters.now()
    .toISOString();
  /**
   * Root config executed and validated only after first consent.
   */
  const validated = await validatePrivateCandidate({
    registryRoot,
    candidate,
    recordedAt,
  },);
  /**
   * Whether second-stage recursive authority was accepted.
   */
  const recursiveChildren = await (async function resolveRecursiveConsent(): Promise<boolean> {
    if (!validated.recursiveChildren)
      return false;
    adapters.disclose(recursiveDisclosure(discovered.repositoryRoot,),);
    /**
     * Recursive trust decision preserving unavailable terminal state.
     */
    const recursiveConsent = yes ? 'approved' : await adapters.prompt();
    if (recursiveConsent === 'unavailable')
      throw new TrustedConfigError(
        'trust-consent-unavailable',
        [
          'Interactive consent is unavailable because stdin or stderr is not a terminal, or input ended before a response.',
          'After reviewing the disclosure, run `git cli-git trust --yes`.',
          'No new trust record was installed.',
        ].join(' ',),
      );
    return recursiveConsent === 'approved';
  })();
  /**
   * Registry-wide lock serializes enrollment and revocation planning.
   */
  await using recursiveLock = await acquireRecursiveRegistryLock({ registryRoot, },);
  /**
   * Explicit self-authorizer plus every current recursive outer root.
   */
  const authorizingRoots = await explicitAuthorizers({
    registryRoot,
    candidate,
  },);
  /**
   * Final record is written only after validation and both applicable decisions.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt,
    recursiveChildren,
    authorizingRoots,
  },);
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}
