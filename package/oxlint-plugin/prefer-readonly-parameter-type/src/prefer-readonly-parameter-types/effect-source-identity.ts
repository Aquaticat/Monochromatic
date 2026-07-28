/**
 * Layered-cache identity for one reached source.
 *
 * Split out of `effect-demand-index.ts` for the code-line budget. It is the only piece of that
 * module that captures nothing from the index it belongs to: everything else there is a closure
 * over the graph being expanded, so this is what could move without threading state through a
 * new parameter list.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

/**
 * Address a source's summaries are stored and looked up under.
 */
export type EffectSourceIdentity = {
  readonly projectKey: string;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly fileName: string;
  readonly sourceText: string;
  readonly cacheRootOverride?: string;
};

/**
 * Builds layered-cache identity for one reached source.
 *
 * @param project - Semantic project owning cache scope.
 *
 * @param scopeKey - Persistent scope identity.
 *
 * @param projectDigest - Exact semantic project identity.
 *
 * @param sourceFile - Reached source whose summaries are requested.
 *
 * @param cacheRootOverride - Optional disposable cache root.
 *
 * @returns shared process and persistent cache identity.
 *
 * @example
 * ```ts
 * sourceIdentity({ project, scopeKey, projectDigest, sourceFile });
 * ```
 */
export function sourceIdentity({
  project,
  scopeKey,
  projectDigest,
  sourceFile,
  cacheRootOverride,
}: {
  readonly project: Project;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly sourceFile: SourceFile;
  readonly cacheRootOverride?: string;
}): EffectSourceIdentity {
  return {
    projectKey: project.configFileName,
    scopeKey,
    projectDigest,
    fileName: sourceFile.fileName,
    sourceText: sourceFile.text,
    ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
  };
}
