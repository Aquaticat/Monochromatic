import {
  eslintCompatPlugin,
  type Plugin,
} from '@oxlint/plugins';

import { preferReadonlyParameterTypes, } from './prefer-readonly-parameter-types.ts';
import { initializeSemanticBridge, } from './prefer-readonly-parameter-types/typescript-sync-adapter.ts';

export {
  classifyReadonlyType,
  propertyIsReadonly,
  type ReadonlyClassification,
} from './prefer-readonly-parameter-types/readonly-classifier.ts';

export {
  closeSemanticBridge,
  initializeSemanticBridge,
  openSemanticFile,
  semanticBridgeCacheStats,
  type SemanticBridgeCacheStats,
  type SemanticFileSession,
} from './prefer-readonly-parameter-types/typescript-sync-adapter.ts';

export {
  clearEffectSummaryCache,
  effectSummaryCacheStats,
  type EffectSummaryCacheStats,
} from './prefer-readonly-parameter-types/effect-summary-cache.ts';

export {
  clearFinalEffectIndexCache,
  finalEffectIndexCacheStats,
  type FinalEffectIndexCacheStats,
} from './prefer-readonly-parameter-types/effect-final-index-cache.ts';

export {
  buildEffectSummaryIndex,
  NO_EFFECT_SUMMARY,
  type CallableEffectSummary,
  type EffectSummaryIndex,
} from './prefer-readonly-parameter-types/effect-summaries.ts';

export {
  SemanticBridgeError,
  type SemanticBridgeFailureReason,
} from './prefer-readonly-parameter-types/semantic-bridge-error.ts';

export {
  findNodeAtOffset,
  typescriptOffset,
} from './prefer-readonly-parameter-types/typescript-node-map.ts';

initializeSemanticBridge();

/**
 * Oxlint plugin enforcing honest readonly parameter and mutation contracts.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts
 * import { defineConfig } from 'oxlint';
 * export default defineConfig({
 *   jsPlugins: ['\@monochromatic-dev/oxlint-plugin-prefer-readonly-parameter-type'],
 * });
 * ```
 */
const plugin: Plugin = eslintCompatPlugin({
  meta: {
    name: 'prefer-readonly-parameter-type',
  },
  rules: {
    'prefer-readonly-parameter-types': preferReadonlyParameterTypes,
  },
},);

export default plugin;
