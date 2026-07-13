/**
 * Audited Pi extension API effects.
 *
 * @module
 */

import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Pi extension methods that change host state through extension capability.
 */
export const PI_PACKAGE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  'appendEntry',
  'registerTool',
].map(function piExtensionApiEffect(member,): IntrinsicEffectEntry {
  return {
    provenance: {
      kind: 'package',
      packageName: '@earendil-works/pi-coding-agent',
      major: 0,
    },
    ownerType: 'ExtensionAPI',
    member,
    targets: [{ kind: 'receiver', },],
    evidence: '@earendil-works/pi-coding-agent 0.80.6 extension loader and agent session state updates',
  };
},);
