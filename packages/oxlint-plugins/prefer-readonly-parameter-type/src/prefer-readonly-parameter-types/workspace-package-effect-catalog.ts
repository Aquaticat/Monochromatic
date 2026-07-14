/**
 * Audited effects for workspace-owned package call boundaries.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact workspace package effects audited against current source.
 */
export const WORKSPACE_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...[
    'debug',
    'error',
    'fatal',
    'flush',
    'info',
    'trace',
    'warn',
  ].map(function loggerCapabilityEffect(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@monochromatic-dev/module-logger',
        major: 0,
      },
      ownerType: 'Logger',
      member,
      targets: [{ kind: 'receiver', },],
      evidence: 'module-logger 0.0.1 invokes stateful sink-backed logger capability',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/agent-harnesses-shared-usage-projection',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'projectUsagePercent',
    targets: [],
    evidence: 'agent-harnesses-shared-usage-projection 0.0.1 reads numeric snapshot fields',
  },
  ...[
    'formatRateLimitSegment',
    'formatRateLimitStatus',
  ].map(function usageProjectionStyleEffect(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@monochromatic-dev/agent-harnesses-shared-usage-projection',
        major: 0,
      },
      ownerType: 'globalThis',
      member,
      targets: [],
      invokedArgumentProperties: [{
        argumentIndex: 0,
        propertyNames: ['style',],
      },],
      evidence: 'agent-harnesses-shared-usage-projection 0.0.1 invokes supplied style callbacks',
    };
  },),
  ...[
    'isRecord',
    'parseMutationContractBlocks',
  ].map(function sharedPluginObservation(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@monochromatic-dev/config-oxlint-shared',
        major: 0,
      },
      ownerType: 'globalThis',
      member,
      targets: [],
      evidence: 'config-oxlint-shared 0.0.1 source pure parser and record predicates',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/pi-shared-model-selection',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'budgetModelSlug',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'pi-shared-model-selection 0.0.1 reads caller-owned model identity fields',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/pi-shared-model-selection',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'selectBudgetModel',
    targets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'pi-shared-model-selection 0.0.1 reads selection options and invokes supplied auth callbacks',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/pi-shared-model-selection',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'resolveEffectiveScope',
    targets: [{
      kind: 'argument',
      index: 0,
      propertyNames: ['ctx',],
    },],
    evidence: 'pi-shared-model-selection 0.0.1 invokes scope callbacks from options.ctx',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/pi-shared-model-selection',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'resolveRequestedModel',
    targets: [{
      kind: 'argument',
      index: 0,
      propertyNames: [
        'scope',
        'modelRegistry',
      ],
    },],
    evidence: 'pi-shared-model-selection 0.0.1 reads scope and invokes options.modelRegistry.getAll',
  },
  ...[
    'caughtValueStack',
    'caughtValueText',
  ].map(function caughtValueConversion(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@monochromatic-dev/module-caught-value',
        major: 0,
      },
      ownerType: 'globalThis',
      member,
      targets: [{
        kind: 'argument',
        index: 0,
      },],
      evidence: 'module-caught-value 0.0.1 preserves Error fields or invokes standard string-conversion hooks',
    };
  },),
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/module-current-time-context',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'formatTimeContext',
    targets: [],
    evidence: 'module-current-time-context 0.0.1 source reads Date local-time fields and formats primitive text',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/module-or-throw',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'nonNullishOrThrow',
    targets: [],
    evidence: 'module-or-throw 0.0.1 nonNullishOrThrow validation without argument mutation',
  },
];
