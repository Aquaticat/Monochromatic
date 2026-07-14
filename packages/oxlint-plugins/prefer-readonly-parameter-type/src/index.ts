import {
  eslintCompatPlugin,
  type Plugin,
} from '@oxlint/plugins';

import { preferReadonlyParameterTypes, } from './prefer-readonly-parameter-types.ts';

export {
  classifyReadonlyType,
  propertyIsReadonly,
  type ReadonlyClassification,
} from './prefer-readonly-parameter-types/readonly-classifier.ts';

export {
  closeSemanticBridge,
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
  intrinsicCallableEffectQuery,
  intrinsicEffectQuery,
  intrinsicProvenance,
  NO_INTRINSIC_PROVENANCE,
  NO_INTRINSIC_QUERY,
} from './prefer-readonly-parameter-types/intrinsic-effect-query.ts';

export {
  hostEffectAuthorityAvailable,
  type HostEffectAuthority,
} from './prefer-readonly-parameter-types/host-effect-authority.ts';

export {
  INTRINSIC_EFFECTS,
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
  type IntrinsicArgumentPropertyInvocation,
  type IntrinsicEffectEntry,
  type IntrinsicEffectQuery,
  type IntrinsicEffectTarget,
  type IntrinsicProvenance,
} from './prefer-readonly-parameter-types/intrinsic-effect-catalog.ts';

export {
  findNodeAtOffset,
  typescriptOffset,
} from './prefer-readonly-parameter-types/typescript-node-map.ts';

/**
 * Oxlint plugin enforcing honest readonly parameter and mutation contracts.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts
 * import { defineConfig } from 'oxlint';
 * export default defineConfig({
 *   jsPlugins: ['\@monochromatic-dev/config-oxlint-prefer-readonly-parameter-type'],
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
