/**
 * Demand-driven package implementation effect inference.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  CallExpression,
  Node,
  SourceFile,
} from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import {
  type CallableEffectSummary,
  type EffectSummaryIndex,
  NO_EFFECT_SUMMARY,
} from './effect-summary-index.ts';
import {
  PACKAGE_CALL_IDENTITY_UNAVAILABLE,
  packageCallIdentity,
} from './effect-package-call-identity.ts';
import { packageDeclarationCallIdentity, } from './effect-package-declaration-identity.ts';
import { exportedCallable, } from './external-exported-callable.ts';
import {
  EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE,
  openExternalImplementation,
} from './external-implementation-project.ts';
import {
  INSTALLED_PACKAGE_UNAVAILABLE,
  installedPackageForFile,
} from './installed-package-identity.ts';
import { packageVersionIsLocked, } from './lockfile-package-eligibility.ts';
import {
  PACKAGE_IMPLEMENTATION_UNAVAILABLE,
  resolvePackageImplementation,
} from './package-implementation-resolution.ts';

/**
 * External implementation inference logger.
 */
const l = tagged({ tag: 'external-callable-effect', },);

/**
 * Sentinel when external callable cannot be proved from implementation.
 */
export const EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE: unique symbol = Symbol(
  'external package callable effect could not be inferred',
);

/**
 * Proven external callable effect and exact package provenance.
 */
export type ExternalCallableEffect = {
  readonly summary: CallableEffectSummary;
  readonly provenance: string;
};

/**
 * Builder callback reusing effect engine without a module cycle.
 */
export type ExternalEffectIndexBuilder = (options: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
  readonly analysisRoot: string;
}) => EffectSummaryIndex;

/**
 * Demand-driven external effect resolver passed through direct scans.
 */
export type ExternalCallableEffectResolver = (options: {
  readonly consumerProject: Project;
  readonly call: CallExpression;
  readonly declaration: Node;
}) => ExternalCallableEffect | typeof EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;

/**
 * Process cache by exact package implementation and export identity.
 */
const effectByImplementation = new Map<
  string,
  ExternalCallableEffect | typeof EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE
>();

/**
 * Recursive package inference keys currently being analyzed.
 */
const activeInferenceKeys = new Set<string>();

/**
 * Clears process-local external callable results at semantic lifecycle boundary.
 *
 * @example
 * ```ts
 * clearExternalCallableEffectCache();
 * ```
 */
export function clearExternalCallableEffectCache(): void {
  effectByImplementation.clear();
  activeInferenceKeys.clear();
}

/**
 * Infers external package callable effects from shipped implementation.
 *
 * @param consumerProject - Caller project resolving declaration and import identity.
 *
 * @param call - Invoked package call.
 *
 * @param declaration - Resolved external declaration selected by call signature.
 *
 * @param buildIndex - Effect engine callback for external configured project.
 *
 * @returns proven callable effect or unavailable sentinel.
 *
 * @example
 * ```ts
 * externalCallableEffect({ consumerProject: project, call, declaration });
 * ```
 */
export function externalCallableEffect({
  consumerProject,
  call,
  declaration,
  buildIndex,
}: {
  readonly consumerProject: Project;
  readonly call: CallExpression;
  readonly declaration: Node;
  readonly buildIndex: ExternalEffectIndexBuilder;
}): ExternalCallableEffect | typeof EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE {
  /**
   * Exact package identity from selected declaration source.
   */
  const packageIdentity = installedPackageForFile(
    declaration.getSourceFile()
      .fileName,
  );
  if (packageIdentity === INSTALLED_PACKAGE_UNAVAILABLE)
    return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
  /**
   * Exact authored import identity or declaration-owner fallback.
   */
  const importedCallIdentity = packageCallIdentity({
    project: consumerProject,
    checker: consumerProject.checker,
    call,
  },);
  /**
   * Final package export identity for direct or retained receiver call.
   */
  const callIdentity = importedCallIdentity === PACKAGE_CALL_IDENTITY_UNAVAILABLE
    ? packageDeclarationCallIdentity({
      identity: packageIdentity,
      call,
      declaration,
    },)
    : importedCallIdentity;
  if (callIdentity === PACKAGE_CALL_IDENTITY_UNAVAILABLE)
    return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
  if (!packageVersionIsLocked({
    configFileName: consumerProject.configFileName,
    identity: packageIdentity,
  },))
    return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
  /**
   * Shipped runtime implementation selected through package exports.
   */
  const implementation = resolvePackageImplementation({
    identity: packageIdentity,
    moduleSpecifier: callIdentity.moduleSpecifier,
  },);
  if (implementation === PACKAGE_IMPLEMENTATION_UNAVAILABLE)
    return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
  /**
   * Stable recursive-inference identity before project snapshot validation.
   */
  const baseCacheKey = [
    implementation.packageName,
    implementation.packageVersion,
    implementation.exportKey,
    implementation.implementationPath,
    implementation.analysisPath,
    implementation.implementationDigest,
    callIdentity.exportName,
    callIdentity.memberPath
      .join('.',),
  ].join('\0',);
  if (activeInferenceKeys.has(baseCacheKey,))
    return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
  activeInferenceKeys.add(baseCacheKey,);
  /**
   * Disposable recursive-inference guard for every return and throw path.
   */
  using inferenceGuard = {
    [Symbol.dispose](): void {
      activeInferenceKeys.delete(baseCacheKey,);
    },
  };
  try {
    /**
     * External implementation session or fail-closed sentinel.
     */
    const opened = openExternalImplementation({
      consumerProject,
      packageRoot: implementation.packageRoot,
      implementationPath: implementation.analysisPath,
      implementationDigest: implementation.implementationDigest,
    },);
    if (opened === EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE)
      return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
    /**
     * Reusable external implementation project session.
     */
    const session = opened;
    /**
     * Exact callable cache identity including transitive project snapshot.
     */
    const cacheKey = `${baseCacheKey}\0${session.snapshotIdentity}`;
    /**
     * Prior exact implementation inference.
     */
    const cached = effectByImplementation.get(cacheKey,);
    if (cached !== undefined)
      return cached;
    /**
     * Runtime callable declaration selected from exact module export.
     */
    const callable = exportedCallable({
      project: session.project,
      sourceNode: session.implementationSource,
      exportName: callIdentity.exportName,
      memberPath: callIdentity.memberPath,
      packageRoot: implementation.packageRoot,
    },);
    if ((typeof callable) === 'symbol') {
      effectByImplementation.set(
        cacheKey,
        EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE,
      );
      return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
    }
    /**
     * Complete fixed-point effects over demanded external package implementation.
     */
    const index = buildIndex({
      project: session.project,
      activeSourceFile: session.implementationSource,
      analysisRoot: implementation.packageRoot,
    },);
    /**
     * Effect summary for exact runtime export declaration.
     */
    const summary = index.get(callable,);
    if (summary === NO_EFFECT_SUMMARY) {
      effectByImplementation.set(
        cacheKey,
        EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE,
      );
      return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
    }
    /**
     * Proven package effect with exact version and export provenance.
     */
    const result: ExternalCallableEffect = {
      summary,
      provenance: `${implementation.packageName}@${implementation.packageVersion} ${implementation.exportKey} ${[
        callIdentity.exportName,
        ...callIdentity.memberPath,
      ].join('.',)}`,
    };
    effectByImplementation.set(
      cacheKey,
      result,
    );
    return result;
  }
  catch (error) {
    l.debug(`external effect inference failed for ${baseCacheKey}: ${String(error,)}`,);
    return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
  }
}
