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

export { VERIFIED_READER_COUNT, } from './prefer-readonly-parameter-types/effect-default-library-reader-authority.ts';

export {
  parameterBindingSlots,
  type ParameterSlotTable,
  parameterSlotTable,
  slotsByParameterFrom,
} from './prefer-readonly-parameter-types/effect-parameter-slots.ts';

export {
  asEffectSlot,
  asParameterIndex,
  canonicalPropertyKey,
  type EffectSlot,
  NOT_A_STATIC_KEY,
  type ParameterIndex,
} from './prefer-readonly-parameter-types/effect-slot-identity.ts';

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

/**
 * Verified inert collection members, exported for the built-artifact probe test.
 *
 * @internal
 */
export {
  ITERATOR_MEMBER_NAMES,
  MEMBER_CHANNEL_INTERNAL_SLOT,
  MEMBER_CHANNEL_RECEIVER_INDEX,
  MEMBER_CHANNELS_BY_INTERFACE,
  VERIFIED_MEMBER_CHANNEL_COUNT,
} from './prefer-readonly-parameter-types/effect-member-channel-authority.ts';

/**
 * Ancestor directory walk, exported so its test can exercise built output.
 *
 * @internal
 */
export { ancestorDirectories, } from './prefer-readonly-parameter-types/ancestor-directories.ts';

/**
 * Verified member result relations, exported for the built-artifact probe test.
 *
 * @internal
 */
export {
  FRESH_CONTAINER_MEMBER_NAMES,
  RESULT_PROVENANCE_BY_INTERFACE,
  RESULT_RELATION_RECEIVER_VALUE,
  VERIFIED_RESULT_RELATION_COUNT,
} from './prefer-readonly-parameter-types/effect-result-provenance-authority.ts';
