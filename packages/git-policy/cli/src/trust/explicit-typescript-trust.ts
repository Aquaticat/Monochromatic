/**
 * Explicit two-stage TypeScript bundle trust. @module
 */
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  executeStoredConfig,
  exactBytesEqual,
  TrustedConfigError,
} from './config-loader.ts';
import type { ValidatedConfig, } from './config-validation.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { readPrivateFile, } from './record-validation.ts';
import { recordDirectory, } from './registry-path.ts';
import {
  ensureRegistryRoot,
  isMissingPath,
} from './registry-io.ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';
import { loadRecord, } from './registry-storage.ts';
import { prepareTypeScriptRecord, } from './registry-typescript-storage.ts';
import { explicitAuthorizers, } from './recursive-trust.ts';
import { buildTypeScriptCandidate, } from './typescript-builder.ts';
import type {
  LoadedTrustedConfig,
  TrustConsentAdapters,
  TypeScriptTrustCandidate,
} from './types.ts';

/**
 * Disposable private build directory.
 */
export type PrivateBuildDirectory = Readonly<{
  /**
   * Exact private path.
   */
  path: string;
  /**
   * Removes private build state.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Creates private disposable tsdown output directory.
 *
 * @returns private directory handle
 *
 * @example
 * ```ts
 * await using directory = await createPrivateBuildDirectory();
 * ```
 */
export async function createPrivateBuildDirectory(): Promise<PrivateBuildDirectory> {
  /**
   * Private random output path.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'cli-git-typescript-build-',
  ),);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Determines prior exact bundle state without execution.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - rebuilt exact candidate
 *
 * @returns disclosure snapshot state
 */
async function bundleState({
  registryRoot,
  candidate,
}: Readonly<{
  registryRoot: string;
  candidate: TypeScriptTrustCandidate;
}>,): Promise<'new' | 'unchanged' | 'changed' | 'corrupt'> {
  try {
    /**
     * Existing validated exact record.
     */
    const record = await loadRecord({
      registryRoot,
      candidate: candidate.entry,
    },);
    /**
     * Exact prior stored bundle.
     */
    const storedBytes = await readPrivateFile(join(
      recordDirectory({
        registryRoot,
        identity: candidate.entry
          .identity,
      },),
      record.executableSnapshotFile,
    ),);
    return exactBytesEqual({
      left: candidate.executableBytes,
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
 * Creates complete TypeScript root consent disclosure.
 *
 * @param candidate - exact rebuilt candidate
 *
 * @param state - prior bundle state
 *
 * @returns human-readable disclosure
 */
function rootDisclosure({
  candidate,
  state,
}: Readonly<{
  candidate: TypeScriptTrustCandidate;
  state: 'new' | 'unchanged' | 'changed' | 'corrupt';
}>,): string {
  /**
   * Exact tracked source list.
   */
  const sources = candidate.sources
    .map(function sourceLine(source,) {
    return `Tracked source: ${source.canonicalPath} (${source.size} bytes)`;
  },);
  /**
   * Bare-package invalidation warnings.
   */
  const packageWarnings = candidate.barePackageImports
    .map(function packageWarning(specifier,) {
    return `Warning: bare package import is bundled but excluded from automatic invalidation: ${specifier}`;
  },);
  return [
    'cli-git trust request',
    `Configuration: ${candidate.entry
      .discovered
      .configPath}`,
    'Format: typescript',
    `Filesystem identity: ${candidate.entry
      .identity
      .filesystemId}`,
    `Filesystem identity stability: ${candidate.entry
      .filesystemStable
      ? 'stable across reboot'
      : `runtime-only (${candidate.entry
        .filesystemStabilityReason
        ?? 'stable identity unavailable'})`}`,
    `Exact bundle state: ${state}`,
    `Exact bundle bytes: ${String(candidate.executableBytes
      .byteLength,)}`,
    ...sources,
    ...packageWarnings,
    'Authority: trusted bundled code runs with your full account permissions.',
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
    'New descendant configs auto-enroll exact bundles without another prompt and run with full account permissions.',
  ].join('\n',);
}

/**
 * Executes bundle candidate from temporary record without persistence.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact TypeScript candidate
 *
 * @param recordedAt - audit timestamp
 *
 * @returns runtime-validated config
 */
async function validatePrivateCandidate({
  registryRoot,
  candidate,
  recordedAt,
}: Readonly<{
  registryRoot: string;
  candidate: TypeScriptTrustCandidate;
  recordedAt: string;
}>,): Promise<ValidatedConfig> {
  /**
   * Disposable private validation record.
   */
  await using prepared = await prepareTypeScriptRecord({
    registryRoot,
    candidate,
    recordedAt,
  },);
  return await executeStoredConfig(prepared.executablePath,);
}

/**
 * Explicitly trusts one rebuilt TypeScript bundle with two-stage consent.
 *
 * @param discovered - canonical TypeScript config
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
 * await trustTypeScript({ discovered, registryRoot, yes: true, adapters });
 * ```
 */
export async function trustTypeScript({
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
   * Disposable private tsdown output directory.
   */
  await using buildDirectory = await createPrivateBuildDirectory();
  /**
   * Fresh build required for every explicit trust.
   */
  const candidate = await buildTypeScriptCandidate({
    discovered,
    buildDirectory: buildDirectory.path,
  },);
  await ensureRegistryRoot(registryRoot,);
  /**
   * Exact prior bundle state.
   */
  const state = await bundleState({
    registryRoot,
    candidate,
  },);
  adapters.disclose(rootDisclosure({
    candidate,
    state,
  },),);
  if (!(yes || await adapters.prompt()))
    throw new TrustedConfigError(
      'trust-failed',
      'Trust declined; no persistent record was installed.',
    );
  /**
   * Stable timestamp shared by validation and final record.
   */
  const recordedAt = adapters.now()
    .toISOString();
  /**
   * Built config executes only after first consent.
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
    return yes || await adapters.prompt();
  })();
  /**
   * Registry-wide lock serializes enrollment and revocation.
   */
  await using recursiveLock = await acquireRecursiveRegistryLock({ registryRoot, },);
  /**
   * Explicit self-authorizer plus unchanged outer roots.
   */
  const authorizingRoots = await explicitAuthorizers({
    registryRoot,
    candidate: candidate.entry,
  },);
  /**
   * Final source and bundle record installed only after validation.
   */
  await using prepared = await prepareTypeScriptRecord({
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
