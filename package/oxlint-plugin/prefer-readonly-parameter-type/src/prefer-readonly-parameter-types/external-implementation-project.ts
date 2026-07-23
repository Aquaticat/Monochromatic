/**
 * Disposable TypeScript project for shipped package implementation.
 *
 * @module
 */

import { dirname, } from 'node:path';

import type { SourceFile, } from 'typescript/unstable/ast';
import {
  API,
  type Project,
} from 'typescript/unstable/sync';

import { effectProjectFingerprint, } from './effect-project-fingerprint.ts';
import { externalProjectConfigPath, } from './external-project-config.ts';
import { externalRuntimeShadowFiles, } from './external-runtime-shadow-files.ts';
import {
  configureNativeApiChildShutdown,
  nativeApiChild,
} from './typescript-sync-native-shutdown.ts';

/**
 * Maximum declaration-shadow discovery passes before conservative rejection.
 */
const MAX_RUNTIME_SHADOW_PASSES = 32;

/**
 * Sentinel when external implementation project cannot be opened.
 */
export const EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE: unique symbol = Symbol(
  'external implementation configured project was unavailable',
);

/**
 * Disposable TypeScript project over one shipped package implementation.
 */
export type ExternalImplementationSession = {
  readonly project: Project;
  readonly implementationSource: SourceFile;
  readonly snapshotIdentity: string;
  readonly close: () => void;
};

/**
 * Reusable external implementation sessions by generated config path.
 */
const sessionByConfig = new Map<string, ExternalImplementationSession>();

/**
 * Computes stable identity from project source snapshot signatures.
 *
 * @param project - External implementation project.
 *
 * @param implementationSource - Runtime entry source.
 *
 * @returns deterministic process snapshot identity.
 */
function externalSnapshotIdentity({
  project,
  implementationSource,
}: {
  readonly project: Project;
  readonly implementationSource: SourceFile;
}): string {
  return effectProjectFingerprint({
    project,
    activeSourceFile: implementationSource,
  },)
    .digest;
}

/**
 * Opens one generated configured project without publishing it to process cache.
 *
 * @param configPath - Generated project configuration.
 *
 * @param implementationPath - Exact runtime source required from project.
 *
 * @returns disposable project session or unavailable sentinel.
 */
function openExternalProject({
  configPath,
  implementationPath,
}: {
  readonly configPath: string;
  readonly implementationPath: string;
}): ExternalImplementationSession | typeof EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE {
  /**
   * Independent TypeScript client for current generated project.
   */
  const api = new API({ cwd: dirname(configPath,), },);
  configureNativeApiChildShutdown(nativeApiChild(api,),);
  /**
   * Configured project snapshot for shipped implementation.
   */
  const snapshot = api.updateSnapshot({
    openProjects: [configPath,],
  },);
  /**
   * Loaded generated project.
   */
  const project = snapshot.getProject(configPath,);
  /**
   * Shipped implementation source in generated project.
   */
  const implementationSource = project?.program
    .getSourceFile(implementationPath,);
  if ((project === undefined) || (implementationSource === undefined)) {
    snapshot.dispose();
    api.close();
    return EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE;
  }
  return {
    project,
    implementationSource,
    snapshotIdentity: externalSnapshotIdentity({
      project,
      implementationSource,
    },),
    close(): void {
      snapshot.dispose();
      api.close();
    },
  };
}

/**
 * Opens disposable TypeScript project for shipped implementation.
 *
 * @param consumerProject - Caller project selecting cache root.
 *
 * @param packageRoot - Exact package root accepted by analyzer.
 *
 * @param implementationPath - Shipped implementation entry path.
 *
 * @param implementationDigest - Runtime and source-map content identity.
 *
 * @returns disposable semantic implementation session.
 *
 * @example
 * ```ts
 * const session = openExternalImplementation({
 *   consumerProject,
 *   packageRoot,
 *   implementationPath,
 *   implementationDigest,
 * });
 * ```
 */
export function openExternalImplementation({
  consumerProject,
  packageRoot,
  implementationPath,
  implementationDigest,
}: {
  readonly consumerProject: Project;
  readonly packageRoot: string;
  readonly implementationPath: string;
  readonly implementationDigest: string;
}): ExternalImplementationSession | typeof EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE {
  /**
   * Runtime roots discovered from exact entry and declaration-shadowed imports.
   */
  const implementationFiles = { current: [implementationPath,], };
  for (let pass = 0; pass < MAX_RUNTIME_SHADOW_PASSES; pass++) {
    /**
     * Generated configured-project path for current reached roots.
     */
    const configPath = externalProjectConfigPath({
      consumerProject,
      packageRoot,
      implementationPath,
      implementationDigest,
      implementationFiles: implementationFiles.current,
    },);
    /**
     * Prior process-local final session for exact reached roots.
     */
    const cached = sessionByConfig.get(configPath,);
    if (cached !== undefined)
      return cached;
    /**
     * Current project used to discover declaration-shadowed runtime siblings.
     */
    const session = openExternalProject({
      configPath,
      implementationPath,
    },);
    if (session === EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE)
      return session;
    /**
     * Runtime siblings reached through declarations selected by module resolution.
     */
    const nextFiles = [...new Set([
      ...implementationFiles.current,
      ...externalRuntimeShadowFiles({
        project: session.project,
        packageRoot,
      },),
    ],),].toSorted();
    if (nextFiles.length === implementationFiles.current.length) {
      sessionByConfig.set(
        configPath,
        session,
      );
      return session;
    }
    session.close();
    implementationFiles.current = nextFiles;
  }
  return EXTERNAL_IMPLEMENTATION_PROJECT_UNAVAILABLE;
}

/**
 * Closes every process-local external implementation project.
 *
 * @example
 * ```ts
 * closeExternalImplementationProjects();
 * ```
 */
export function closeExternalImplementationProjects(): void {
  sessionByConfig.forEach(function closeSession(session,): void {
    session.close();
  },);
  sessionByConfig.clear();
}
