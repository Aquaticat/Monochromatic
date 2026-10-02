/**
 Pi extension entry point for model retirement.

 Superseded models leave the live catalog at `session_start`, the earliest point an
 extension can read the catalog at all, so the model picker stops offering them and
 `find` stops resolving them. `pi --list-models` and the startup model choice are
 settled before this handler runs; both consequences are recorded in
 `doc/planning/pi-model-retirement.md`.

 @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { registerModelRetirement, } from './register-model-retirement.ts';

export {
  applyRetirements,
  readsFromRegistry,
  registerModelRetirement,
  type ChatModelReader,
  type ClassifierModelReader,
  type FailedProvider,
  type ImageModelReader,
  type LiveModelIdentity,
  type ProviderRegistrar,
  type RetirementLog,
  type RetirementPassSummary,
} from './register-model-retirement.ts';
export {
  planProviderFilters,
  REGISTERABLE,
  toModelConfig,
  type CatalogRead,
  type FilterPlanning,
  type ProviderFilterPlan,
  type SkippedProvider,
} from './provider-filter.ts';
export {
  classifyToken,
  isDateShapedRaw,
  NO_NUMERIC_RUN,
  parseModelId,
  splitOnNonTokenCharacters,
  stripOrganizationPrefix,
  type ModelIdParse,
  type TokenClassification,
} from './id-tokens.ts';
export {
  decideRetirements,
  type AbstentionCounts,
  type CatalogEntry,
  type Retirement,
  type RetirementDecision,
} from './retirement-rule.ts';
export {
  compareRecency,
  UNORDERED,
  type Recency,
} from './retirement-order.ts';
export {
  formatAbstentions,
  formatFailedProvider,
  formatLiveModelWarning,
  formatPlanningSummary,
  formatRetirementLine,
  formatSkippedProvider,
  type PlanningCounts,
} from './retirement-report.ts';

//region Extension entry point

/**
 Model retirement pi extension.

 Delegates registration to {@link registerModelRetirement}.

 @param pi - pi extension API

 @mutates pi - `registerModelRetirement` registers the session-start handler that
 replaces provider model lists

 @example
 ```typescript
 // In ~/.pi/agent/settings.json:
 // { "packages": ["/path/to/package/pi-plugin/model-retirement"] }
 ```
 */
export default function modelRetirement(pi: ForeignBorrowed<ExtensionAPI>,): void {
  registerModelRetirement({ pi, },);
}

//endregion Extension entry point
