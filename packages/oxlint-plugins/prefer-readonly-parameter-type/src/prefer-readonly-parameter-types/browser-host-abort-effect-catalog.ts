/**
 * Audited browser abort host effects.
 *
 * @module
 */

import {
  WEB_SOURCES,
  webAuthority,
} from './browser-host-authority.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';

/**
 * Exact source-derived abort algorithm anchors.
 */
const ABORT_ALGORITHM_ANCHORS = {
  abortControllerAbort: 'sha256:405c8ef94b7c685123b021107f00578994e4aef4bef80c0a8580ce76629d79c7',
  abortSignalAny: 'sha256:a0f0637ca30beb66d5eaea24d677a9f80e7d01434eacb16533347a0e7d8e3aab',
  abortSignalTimeout: 'sha256:d54f577719b4e9835ab1e597a7401b8cd2bff0cd9d5880929484f33076de5d61',
} as const;

/**
 * Browser abort effects audited against DOM algorithms.
 */
export const BROWSER_HOST_ABORT_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'AbortController',
    member: 'abort',
    targets: [{ kind: 'receiver', },],
    opaqueTargets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'DOM commit 5796f716 AbortController abort steps retain reason',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ABORT_ALGORITHM_ANCHORS.abortControllerAbort,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'AbortSignal',
    member: 'any',
    targets: [],
    opaqueTargets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'DOM commit 5796f716 AbortSignal.any dependent-signal relations',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ABORT_ALGORITHM_ANCHORS.abortSignalAny,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'AbortSignal',
    member: 'timeout',
    targets: [],
    evidence: 'DOM commit 5796f716 AbortSignal.timeout creates and schedules an owned signal from primitive delay',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ABORT_ALGORITHM_ANCHORS.abortSignalTimeout,
    },),
  },
];
