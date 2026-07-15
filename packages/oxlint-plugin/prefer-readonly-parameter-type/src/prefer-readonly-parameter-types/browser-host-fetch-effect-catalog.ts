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
  fetch: 'sha256:36b9f23463024fd526e782a8d4cfabc501201cb09350dd70a2915d448c948334',
  headersGet: 'sha256:706591c91e1faf57d65deba7252bbcb1a0a7fc9756b0bccfe1a037492d8a1a7f',
  headersHas: 'sha256:6e4fe29b526226809e5f6f296f6636e296d8ff1606ddc26d457142cc3176ae99',
  headersSet: 'sha256:46181196a07584ad868e8119105df96f5a1a64dd3bbd63a2e2fcf50c69f08856',
  json: 'sha256:035ab97d41fcf56804974e48c79c6770c3f716208f52b5207626bda5bb018d07',
  responseJson: 'sha256:67d718d4e201f3cc9a57b9e1ae7fe5554c030d78579a52ad026969da6b6935d9',
  text: 'sha256:8f43f7bcc892f9b1ae86e41820d78e4274e8aae80a2f036edfe3cfc419655ec9',
} as const;

/**
 * Fetch body effects audited against Fetch Standard algorithms.
 */
export const BROWSER_HOST_FETCH_EFFECTS: readonly IntrinsicEffectEntry[] = [
  ...([
    {
      member: 'get',
      algorithm: FETCH_ALGORITHM_ANCHORS.headersGet,
    },
    {
      member: 'has',
      algorithm: FETCH_ALGORITHM_ANCHORS.headersHas,
    },
  ] as const).map(function headersObservation(entry,): IntrinsicEffectEntry {
    /**
     * Audited member and algorithm identity for one observational operation.
     */
    const {
      member,
      algorithm,
    } = entry;
    return {
      provenance: { kind: 'dom', },
      ownerType: 'Headers',
      member,
      targets: [],
      evidence: `Fetch commit 586cd2a4 Headers.${member} only observes receiver header list`,
      authority: webAuthority({
        source: WEB_SOURCES.fetch,
        algorithm,
      },),
    };
  },),
  {
    provenance: { kind: 'dom', },
    ownerType: 'Headers',
    member: 'set',
    targets: [{ kind: 'receiver', },],
    evidence: 'Fetch commit 586cd2a4 Headers.set changes receiver header list',
    authority: webAuthority({
      source: WEB_SOURCES.fetch,
      algorithm: FETCH_ALGORITHM_ANCHORS.headersSet,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'globalThis',
    member: 'fetch',
    targets: [],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 1,
        propertyNames: [
          'body',
          'headers',
          'signal',
        ],
      },
    ],
    evidence: 'Fetch commit 586cd2a4 fetch constructs and asynchronously uses a request from input and init',
    authority: webAuthority({
      source: WEB_SOURCES.fetch,
      algorithm: FETCH_ALGORITHM_ANCHORS.fetch,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'Response',
    member: 'json',
    targets: [],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 1,
        propertyNames: ['headers',],
      },
    ],
    evidence: 'Fetch commit 586cd2a4 Response.json serializes data and reads response initialization',
    authority: webAuthority({
      source: WEB_SOURCES.fetch,
      algorithm: FETCH_ALGORITHM_ANCHORS.responseJson,
    },),
  },
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
