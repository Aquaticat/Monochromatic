/**
 * Audited browser Fetch host effects.
 *
 * @module
 */

import {
  WEB_SOURCES,
  webAuthority,
} from './browser-host-authority.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact source-derived Fetch Body algorithm anchors.
 */
const FETCH_ALGORITHM_ANCHORS = {
  json: 'sha256:035ab97d41fcf56804974e48c79c6770c3f716208f52b5207626bda5bb018d07',
  text: 'sha256:8f43f7bcc892f9b1ae86e41820d78e4274e8aae80a2f036edfe3cfc419655ec9',
} as const;

/**
 * Fetch body effects audited against Fetch Standard algorithms.
 */
export const BROWSER_HOST_FETCH_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'Body',
    member: 'json',
    targets: [{ kind: 'receiver', },],
    evidence: 'Fetch commit 586cd2a4 Body.json fully reads and disturbs receiver body before parsing JSON',
    authority: webAuthority({
      source: WEB_SOURCES.fetch,
      algorithm: FETCH_ALGORITHM_ANCHORS.json,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'Body',
    member: 'text',
    targets: [{ kind: 'receiver', },],
    evidence: 'Fetch commit 586cd2a4 Body.text fully reads and disturbs receiver body before UTF-8 decoding',
    authority: webAuthority({
      source: WEB_SOURCES.fetch,
      algorithm: FETCH_ALGORITHM_ANCHORS.text,
    },),
  },
];
