/**
 * Construction inputs for one exact-snapshot demand-driven effect index.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import type { EffectAnalysisBudget, } from './effect-analysis-budget.ts';
import type { EffectProjectFingerprint, } from './effect-project-fingerprint.ts';
import type { ExternalEffectIndexBuilder, } from './external-callable-effect.ts';

/**
 * Inputs needed to construct one exact-snapshot demand index.
 */
export type DemandDrivenEffectIndexOptions = {
  readonly project: Project;
  readonly indexedSourceFiles: ReadonlyMap<string, SourceFile>;
  readonly projectFingerprint: EffectProjectFingerprint;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly cacheRootOverride?: string;
  readonly analysisRoot?: string;
  readonly buildIndex: ExternalEffectIndexBuilder;
  readonly analysisBudget: EffectAnalysisBudget;
};
