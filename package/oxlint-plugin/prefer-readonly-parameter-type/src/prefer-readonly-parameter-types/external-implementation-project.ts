/**
 * Disposable TypeScript project for shipped package implementation.
 *
 * @module
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

import type { SourceFile, } from 'typescript/unstable/ast';
import {
  API,
  type Project,
} from 'typescript/unstable/sync';

import { effectProjectFingerprint, } from './effect-project-fingerprint.ts';
import {
  contentDigest,
  effectCacheRoot,
} from './effect-summary-cache-identity.ts';
import {
  configureNativeApiChildShutdown,
  nativeApiChild,
} from './typescript-sync-native-shutdown.ts';

/**
 * Generated external configured-project schema.
 */
const EXTERNAL_PROJECT_SCHEMA = 3;

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
 * Writes deterministic generated TypeScript config when absent.
 *
 * @param consumerProject - Caller project selecting dependency-local cache root.
 *
 * @param packageRoot - Exact package root accepted for source analysis.
 *
 * @param implementationPath - Shipped runtime entry.
 *
 * @param implementationDigest - Runtime and source-map content identity.
 *
 * @returns generated config path.
 */
function externalConfigPath({
  consumerProject,
  packageRoot,
  implementationPath,
  implementationDigest,
}: {
  readonly consumerProject: Project;
  readonly packageRoot: string;
  readonly implementationPath: string;
  readonly implementationDigest: string;
}): string {
  /**
   * Dependency-local persistent cache root.
   */
  const cacheRoot = effectCacheRoot({
    projectKey: consumerProject.configFileName,
  },);
  /**
   * Exact generated project identity.
   */
  const projectIdentity = contentDigest(
    `${String(EXTERNAL_PROJECT_SCHEMA,)}\0${packageRoot}\0${implementationPath}\0${implementationDigest}`,
  );
  /**
   * Generated project directory.
   */
  const directory = join(
    cacheRoot,
    'external-projects',
    projectIdentity,
  );
  /**
   * Generated TypeScript config path.
   */
  const configPath = join(
    directory,
    'tsconfig.json',
  );
  // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous semantic visitor reuses deterministic package-analysis project when already materialized.
  if (existsSync(configPath,))
    return configPath;
  /**
   * Deterministic JavaScript-capable TypeScript project config.
   */
  const configText = `${JSON.stringify(
    {
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      maxNodeModuleJsDepth: 10,
      noEmit: true,
      skipLibCheck: true,
      strict: false,
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ESNext',
      resolveJsonModule: true,
    },
    files: [implementationPath,],
  },
    null,
    2,
  )}\n`;
  // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous semantic visitor materializes deterministic package-analysis project before TypeScript snapshot.
  mkdirSync(
    directory,
    { recursive: true, },
  );
  try {
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous semantic visitor writes generated package-analysis configuration once.
    writeFileSync(
      configPath,
      configText,
      { flag: 'wx', },
    );
    return configPath;
  }
  catch (error) {
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Concurrent writer may have atomically materialized identical content-addressed config.
    if (existsSync(configPath,))
      return configPath;
    throw error;
  }
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
   * Generated configured-project path.
   */
  const configPath = externalConfigPath({
    consumerProject,
    packageRoot,
    implementationPath,
    implementationDigest,
  },);
  /**
   * Prior process-local session for exact implementation project.
   */
  const cached = sessionByConfig.get(configPath,);
  if (cached !== undefined)
    return cached;
  /**
   * Independent TypeScript API avoids invalidating caller snapshot mid-analysis.
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
  /**
   * Reusable session closed with semantic bridge lifecycle.
   */
  const session: ExternalImplementationSession = {
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
  sessionByConfig.set(
    configPath,
    session,
  );
  return session;
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
