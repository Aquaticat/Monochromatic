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
      packageName: '@monochromatic-dev/module-toml-edit',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'tomlGetValue',
    targets: [],
    evidence: 'module-toml-edit commit 7a7124af929b6bb98615d515ff40e91df99c2a6c toml-get-value.ts sha256 1bd3965418b617460193cb60538a628e1b49ed89f56ec4bb709a55bae7532b6d materializes fresh values without mutating edit or path',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/module-toml-edit',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'tomlHas',
    targets: [],
    evidence: 'module-toml-edit commit 7a7124af929b6bb98615d515ff40e91df99c2a6c toml-has.ts sha256 81e22b8fd772d6bf5ae4a4c73cc437fda674fe05f90e69a162bad27209d3a2f5 materializes a fresh document view and navigates to a boolean without mutating edit or path',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/module-toml-edit',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'tomlSet',
    targets: [],
    opaqueTargets: [{
      kind: 'argument',
      index: 0,
      propertyNames: ['value',],
    },],
    evidence: 'module-toml-edit commit 7a7124af929b6bb98615d515ff40e91df99c2a6c toml-set.ts sha256 ff0a3c732c17a64769744646c0e7ee2436b5cb698dce1f4586709eef90c4edf3 returns fresh state while value traversal can invoke caller hooks; moduleTomlEdit.tomlSet',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/dev-script-file-enforcer',
      major: 0,
    },
    ownerType: 'globalThis',
    member: 'overwriteEach',
    targets: [],
    invokedArgumentProperties: [{
      argumentIndex: 0,
      propertyNames: ['files',],
      typeCondition: { kind: 'may-be-callable', },
    },],
    evidence: 'dev-script-file-enforcer 0.0.1 io/write.ts sha256 4a01fcd2e1ac1a43365c3591b3d477f6fd2d4be0d2fe8798c10df4046c353842 observes eager file arrays and invokes lazy files builders',
  },
  {
    provenance: {
      kind: 'package',
      packageName: '@monochromatic-dev/module-zip-writer',
      major: 0,
    },
    ownerType: 'ZipWriter',
    member: 'add',
    targets: [{ kind: 'receiver', },],
    opaqueTargets: [{
      kind: 'argument',
      index: 1,
      typeCondition: { kind: 'not-definitely-string', },
    },],
    evidence: 'module-zip-writer 0.0.1 index.ts sha256 8f8368a6425fa203195cc48ec66396d1a47684f3fdd1ef4103583febfa2e1dff mutates receiver entries, owns encoded string bytes, and retains supplied Uint8Array content',
  },
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
