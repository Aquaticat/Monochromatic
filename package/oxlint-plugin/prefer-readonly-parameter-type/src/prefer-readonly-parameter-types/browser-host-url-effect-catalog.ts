/**
 * Audited browser URL host effects.
 *
 * @module
 */

import {
  WEB_SOURCES,
  webAuthority,
} from './browser-host-authority.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact source-derived URL algorithm anchors.
 */
const URL_ALGORITHM_ANCHORS = {
  searchParamsGet: 'sha256:331038456350c08b67efa72ed719b61aaf7a6ef3c3a89142ae0896e035474633',
} as const;

/**
 * URL effects audited against URL Standard algorithms.
 */
export const BROWSER_HOST_URL_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'URLSearchParams',
    member: 'get',
    targets: [],
    evidence: 'URL commit 9dc3827f URLSearchParams.get only returns first matching tuple value',
    authority: webAuthority({
      source: WEB_SOURCES.url,
      algorithm: URL_ALGORITHM_ANCHORS.searchParamsGet,
    },),
  },
];
