/**
 * Recursive MJS and TypeScript descendant enrollment. @module
 */
import { captureTrustCandidate, } from './candidate.ts';
import { executeStoredConfig, } from './config-loader.ts';
import type { ValidatedConfig, } from './config-validation.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { createPrivateBuildDirectory, } from './explicit-typescript-trust.ts';
import { validateMjs, } from './mjs-validator.ts';
import {
  listTrustRecords,
  trustIdentityKey,
} from './registry-catalog.ts';
import { acquireRecursiveRegistryLock, } from './registry-recursive-lock.ts';
import { prepareMjsRecord, } from './registry-storage.ts';
import { prepareTypeScriptRecord, } from './registry-typescript-storage.ts';
import { recoverProvenanceTransactions, } from './registry-transaction.ts';
import {
  activeRecursiveAuthorizers,
  canonicalAuthorizers,
} from './recursive-trust.ts';
import { buildTypeScriptCandidate, } from './typescript-builder.ts';
import type {
  LoadedTrustedConfig,
  TrustCandidate,
  TrustIdentity,
  TypeScriptTrustCandidate,
} from './types.ts';

/**
 * No recursive root authorizes candidate.
 */
export const RECURSIVE_TRUST_ABSENT: unique symbol = Symbol('no RECURSIVE_ROOT authorizes candidate config',);

/**
 * Revalidates exact recursive roots immediately before installation.
 *
 * @param registryRoot - complete registry root
 *
 * @param repositoryRoot - descendant repository root
 *
 * @param expected - identities that authorized candidate build
 */
async function assertAuthorizersCurrent({
  registryRoot,
  repositoryRoot,
  expected,
}: Readonly<{
  registryRoot: string;
  repositoryRoot: string;
  expected: readonly TrustIdentity[];
}>,): Promise<void> {
  /**
   * Fresh complete registry catalog.
   */
  const entries = await listTrustRecords({ registryRoot, },);
  /**
   * Fresh unchanged covering roots.
   */
  const current = canonicalAuthorizers(await activeRecursiveAuthorizers({
    entries,
    repositoryRoot,
  },));
  /**
   * Deterministic exact provenance keys.
   */
  const currentKeys = current.map(function currentKey(identity,) {
    return trustIdentityKey(identity,);
  },);
  /**
   * Expected provenance keys from initial authorization.
   */
  const expectedKeys = expected.map(function expectedKey(identity,) {
    return trustIdentityKey(identity,);
  },);
  if ((currentKeys.length !== expectedKeys.length)
    || currentKeys.some(function keyChanged(
      key,
      index,
    ) { return key !== expectedKeys[index]; },)) {
    throw new Error('Recursive trust authorizers changed during descendant enrollment.',);
  }
}

/**
 * Validates and installs one MJS descendant.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact MJS candidate
 *
 * @param authorizingRoots - inherited roots
 *
 * @param recordedAt - audit timestamp
 *
 * @mutates candidate through handle.writeFile configured VFS handler or native-boundary access to candidate.bytes
 *
 * @returns loaded installed config
 */
async function enrollMjs({
  registryRoot,
  candidate,
  authorizingRoots,
  recordedAt,
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
  authorizingRoots: readonly TrustIdentity[];
  recordedAt: string;
}>,): Promise<LoadedTrustedConfig> {
  validateMjs({
    bytes: candidate.bytes,
    sourceName: candidate.discovered
      .configPath,
  },);
  /**
   * Runtime-validated config after disposable validation lock releases.
   */
  const validated = await (async function validateMjsCandidate(): Promise<ValidatedConfig> {
    /**
     * Disposable private validation record.
     */
    await using validationRecord = await prepareMjsRecord({
      registryRoot,
      candidate,
      recordedAt,
      authorizingRoots,
    },);
    return await executeStoredConfig(validationRecord.executablePath,);
  })();
  await assertAuthorizersCurrent({
    registryRoot,
    repositoryRoot: candidate.discovered
      .repositoryRoot,
    expected: authorizingRoots,
  },);
  /**
   * Final exact descendant record.
   */
  await using prepared = await prepareMjsRecord({
    registryRoot,
    candidate,
    recordedAt,
    recursiveChildren: validated.recursiveChildren,
    authorizingRoots,
  },);
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}

/**
 * Executes TypeScript bundle from disposable record.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact bundle candidate
 *
 * @param authorizingRoots - inherited roots
 *
 * @param recordedAt - audit timestamp
 *
 * @returns runtime-validated config
 */
async function validateTypeScriptCandidate({
  registryRoot,
  candidate,
  authorizingRoots,
  recordedAt,
}: Readonly<{
  registryRoot: string;
  candidate: TypeScriptTrustCandidate;
  authorizingRoots: readonly TrustIdentity[];
  recordedAt: string;
}>,): Promise<ValidatedConfig> {
  /**
   * Disposable private validation record.
   */
  await using prepared = await prepareTypeScriptRecord({
    registryRoot,
    candidate,
    recordedAt,
    authorizingRoots,
  },);
  return await executeStoredConfig(prepared.executablePath,);
}

/**
 * Builds, validates, and installs one TypeScript descendant.
 *
 * @param discovered - canonical TypeScript config
 *
 * @param registryRoot - complete registry root
 *
 * @param authorizingRoots - inherited roots
 *
 * @param recordedAt - audit timestamp
 *
 * @returns loaded installed config
 */
async function enrollTypeScript({
  discovered,
  registryRoot,
  authorizingRoots,
  recordedAt,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
  authorizingRoots: readonly TrustIdentity[];
  recordedAt: string;
}>,): Promise<LoadedTrustedConfig> {
  /**
   * Disposable private tsdown output directory.
   */
  await using buildDirectory = await createPrivateBuildDirectory();
  /**
   * Exact private descendant build.
   */
  const candidate = await buildTypeScriptCandidate({
    discovered,
    buildDirectory: buildDirectory.path,
  },);
  /**
   * Runtime validation before persistent enrollment.
   */
  const validated = await validateTypeScriptCandidate({
    registryRoot,
    candidate,
    authorizingRoots,
    recordedAt,
  },);
  await assertAuthorizersCurrent({
    registryRoot,
    repositoryRoot: discovered.repositoryRoot,
    expected: authorizingRoots,
  },);
  /**
   * Final exact source and bundle record.
   */
  await using prepared = await prepareTypeScriptRecord({
    registryRoot,
    candidate,
    recordedAt,
    recursiveChildren: validated.recursiveChildren,
    authorizingRoots,
  },);
  await prepared.commit();
  return {
    validated,
    record: prepared.record,
  };
}

/**
 * Auto-enrolls exact descendant under every current recursive root.
 *
 * @param discovered - canonical descendant config
 *
 * @param registryRoot - complete private registry root
 *
 * @param recordedAt - audit timestamp
 *
 * @returns loaded config or absence when no root authorizes it
 *
 * @example
 * ```ts
 * await autoEnrollRecursiveConfig({ discovered, registryRoot, recordedAt });
 * ```
 */
export async function autoEnrollRecursiveConfig({
  discovered,
  registryRoot,
  recordedAt,
}: Readonly<{
  discovered: DiscoveredConfig;
  registryRoot: string;
  recordedAt: string;
}>,): Promise<LoadedTrustedConfig | typeof RECURSIVE_TRUST_ABSENT> {
  /**
   * Registry-wide serialization against revocation.
   */
  await using recursiveLock = await acquireRecursiveRegistryLock({ registryRoot, },);
  await recoverProvenanceTransactions({ registryRoot, },);
  /**
   * Entry candidate establishes exact identity before authorization.
   */
  const candidate = await captureTrustCandidate(discovered,);
  /**
   * Every installed record before enrollment.
   */
  const entries = await listTrustRecords({ registryRoot, },);
  /**
   * Every unchanged recursive root covering descendant.
   */
  const authorizingRoots = canonicalAuthorizers(await activeRecursiveAuthorizers({
    entries,
    repositoryRoot: discovered.repositoryRoot,
  },),);
  if (authorizingRoots.length === 0)
    return RECURSIVE_TRUST_ABSENT;
  return discovered.format === 'mjs'
    ? await enrollMjs({
      registryRoot,
      candidate,
      authorizingRoots,
      recordedAt,
    },)
    : await enrollTypeScript({
      discovered,
      registryRoot,
      authorizingRoots,
      recordedAt,
    },);
}
