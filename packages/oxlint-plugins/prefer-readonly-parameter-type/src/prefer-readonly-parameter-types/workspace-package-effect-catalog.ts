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
  ...[
    'resolveEffectiveScope',
    'resolveRequestedModel',
  ].map(function modelSelectionCapabilityEffect(member,): IntrinsicEffectEntry {
    return {
      provenance: {
        kind: 'package',
        packageName: '@monochromatic-dev/pi-shared-model-selection',
        major: 0,
      },
      ownerType: 'globalThis',
      member,
      targets: [{
        kind: 'argument',
        index: 0,
      },],
      evidence: 'pi-shared-model-selection 0.0.1 invokes model scope or registry callbacks from options',
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
