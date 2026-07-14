/**
 * Audited browser host intrinsic effects.
 *
 * @module
 */

import { BROWSER_HOST_ABORT_EFFECTS, } from './browser-host-abort-effect-catalog.ts';
import { BROWSER_HOST_CANVAS_EFFECTS, } from './browser-host-canvas-effect-catalog.ts';
import { BROWSER_HOST_ELEMENT_EFFECTS, } from './browser-host-element-effect-catalog.ts';
import { BROWSER_HOST_FETCH_EFFECTS, } from './browser-host-fetch-effect-catalog.ts';
import { BROWSER_HOST_FILE_EFFECTS, } from './browser-host-file-effect-catalog.ts';
import {
  WEB_SOURCES,
  webAuthority,
} from './browser-host-authority.ts';
import type { HostEffectAuthority, } from './host-effect-authority.ts';
import type {
  IntrinsicEffectEntry,
  IntrinsicEffectTarget,
} from './intrinsic-effect-catalog.ts';

/**
 * Shared receiver mutation target.
 */
const RECEIVER: IntrinsicEffectTarget = { kind: 'receiver', };

/**
 * Source-derived browser method anchor hashes by catalog identity.
 */
const WEB_ALGORITHM_ANCHORS = {
  appendChild: 'sha256:5d063a8b82179b815e00eae7ed1cc5b3fcc3eabf9f2bc742218a647e95ad675a',
  cloneNode: 'sha256:82deb73db8f82c01434816211f17baef753591b66a1ef67271455d7515e62d96',
  dispatchEvent: 'sha256:513c877a5321849e995571d84d86a278124d857343cd680c5ee4affff3995d73',
  encode: 'sha256:f61da30fc3fd309597028e8ee0fb0ff77da618859b5238a66cafc505756a786a',
  decode: 'sha256:e19cea57bbca13d5041d7ca6caa7c7d7b9c8dc6bd958e51db8980fe5d7378db9',
  getComputedStyle: 'sha256:9970074e7543a80243752a4d734bd7d7a2988077f150041659239973746e6219',
  insertBefore: 'sha256:1c2b86080639a216da4d35e79bd29f5d19e9e749b2f50a95d736d0b820292ece',
  measureText: 'sha256:fcdabc79f582733404bb294e8d0b9bf2429b6dc524915282b710d76426bcba63',
  preventDefault: 'sha256:9fd71e24e4810b4f92cfaf47c09ccd152d40028dd983eb33d4b11e1caf7c540c',
  removeChild: 'sha256:9180ae64f3f7eb313e68b44de00705e8acd88177caa47e30b65a2690b73ae147',
  replaceChild: 'sha256:722404e9ffe9a1bb0aee1dcb28d93c65ff19f76c6b6072ebe44a18cae4b4bf2b',
  replaceChildren: 'sha256:6ab281a7b681f42a0b10791ccd87e78c14196a62a53ab1c351dda1f49ed11cf1',
  setTimeout: 'sha256:4ae7288c3254a058c96d35aeacf3354893538a13c069a7d11f5f2736ed1b5118',
  stopImmediatePropagation: 'sha256:d975ca83f649634b6717e11629030f4c6f5e2d8138a1b90a0799e863825608b9',
  stopPropagation: 'sha256:59c695a9d2721a02881cb640e78f748fbbbf0afd5a0cbff85201302ab9a4fe0d',
  addEventListener: 'sha256:2fdcb18b4ac564ae45b6cd82db275af5ef10bf5d240f0697e90bc948e6cbd202',
  removeEventListener: 'sha256:653abfdfde3f9cece9521f66da4b25bfeb5116aa4df8d9bd076e880200f5b965',
} as const;

/**
 * Creates receiver-mutating browser-host entry.
 *
 * @param ownerType - Declaring receiver type symbol.
 *
 * @param member - Declaring callable member symbol.
 *
 * @param evidence - Audited standard algorithm.
 *
 * @param authority - Exact standard revision.
 *
 * @returns browser-host receiver effect.
 */
function receiverEffect({
  ownerType,
  member,
  evidence,
  authority,
}: {
  readonly ownerType: string;
  readonly member: string;
  readonly evidence: string;
  readonly authority: HostEffectAuthority;
}): IntrinsicEffectEntry {
  return {
    provenance: { kind: 'dom', },
    ownerType,
    member,
    targets: [RECEIVER,],
    evidence,
    authority,
  };
}

/**
 * Browser-host effects audited against standards algorithms.
 */
export const BROWSER_HOST_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'globalThis',
    member: 'setTimeout',
    targets: [],
    forwardedCallbacks: [{
      callbackArgumentIndex: 0,
      sourceArgumentStartIndex: 2,
    },],
    invokedArgumentIndexes: [0,],
    evidence: 'HTML commit 255188e5 timer initialization steps invoke supplied handler later',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: WEB_ALGORITHM_ANCHORS.setTimeout,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'globalThis',
    member: 'getComputedStyle',
    targets: [],
    evidence: 'CSSOM commit 0222af95 getComputedStyle algorithm',
    authority: webAuthority({
      source: WEB_SOURCES.cssom,
      algorithm: WEB_ALGORITHM_ANCHORS.getComputedStyle,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasRenderingContext2D',
    member: 'measureText',
    targets: [],
    evidence: 'HTML commit 255188e5 Canvas measureText algorithm',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: WEB_ALGORITHM_ANCHORS.measureText,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'TextEncoder',
    member: 'encode',
    targets: [],
    evidence: 'Encoding commit a985b62a TextEncoder.encode algorithm',
    authority: webAuthority({
      source: WEB_SOURCES.encoding,
      algorithm: WEB_ALGORITHM_ANCHORS.encode,
    },),
  },
  receiverEffect({
    ownerType: 'TextDecoder',
    member: 'decode',
    evidence: 'Encoding commit a985b62a TextDecoder.decode algorithm',
    authority: webAuthority({
      source: WEB_SOURCES.encoding,
      algorithm: WEB_ALGORITHM_ANCHORS.decode,
    },),
  },),
  ...BROWSER_HOST_ABORT_EFFECTS,
  ...BROWSER_HOST_CANVAS_EFFECTS,
  ...BROWSER_HOST_ELEMENT_EFFECTS,
  ...BROWSER_HOST_FETCH_EFFECTS,
  ...BROWSER_HOST_FILE_EFFECTS,
  {
    provenance: { kind: 'dom', },
    ownerType: 'EventTarget',
    member: 'addEventListener',
    targets: [RECEIVER,],
    opaqueTargets: [
      {
        kind: 'argument',
        index: 1,
      },
      {
        kind: 'argument',
        index: 2,
      },
    ],
    evidence: 'DOM commit 5796f716 addEventListener retains callback and signal relation',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: WEB_ALGORITHM_ANCHORS.addEventListener,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'EventTarget',
    member: 'dispatchEvent',
    targets: [
      RECEIVER,
      {
        kind: 'argument',
        index: 0,
      },
    ],
    opaqueTargets: [
      RECEIVER,
      {
        kind: 'argument',
        index: 0,
      },
    ],
    evidence: 'DOM commit 5796f716 dispatchEvent invokes listeners with event',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: WEB_ALGORITHM_ANCHORS.dispatchEvent,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'EventTarget',
    member: 'removeEventListener',
    targets: [RECEIVER,],
    opaqueTargets: [{
      kind: 'argument',
      index: 2,
    },],
    evidence: 'DOM commit 5796f716 removeEventListener reads options and mutates listener list',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: WEB_ALGORITHM_ANCHORS.removeEventListener,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'Node',
    member: 'cloneNode',
    targets: [],
    evidence: 'DOM commit 5796f716 cloneNode algorithm',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: WEB_ALGORITHM_ANCHORS.cloneNode,
    },),
  },
  ...Object.entries({
    appendChild: WEB_ALGORITHM_ANCHORS.appendChild,
    insertBefore: WEB_ALGORITHM_ANCHORS.insertBefore,
    removeChild: WEB_ALGORITHM_ANCHORS.removeChild,
  },)
    .map(function nodeEffect([member, algorithm,],): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'dom', },
      ownerType: 'Node',
      member,
      targets: [
        RECEIVER,
        {
          kind: 'argument',
          index: 0,
        },
      ],
      evidence: 'DOM commit 5796f716 node tree mutation algorithms',
      authority: webAuthority({
        source: WEB_SOURCES.dom,
        algorithm,
      },),
    };
  },),
  {
    provenance: { kind: 'dom', },
    ownerType: 'Node',
    member: 'replaceChild',
    targets: [
      RECEIVER,
      {
        kind: 'argument',
        index: 0,
      },
      {
        kind: 'argument',
        index: 1,
      },
    ],
    evidence: 'DOM commit 5796f716 replaceChild mutates new and replaced child tree relations',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: WEB_ALGORITHM_ANCHORS.replaceChild,
    },),
  },
  ...Object.entries({
    preventDefault: WEB_ALGORITHM_ANCHORS.preventDefault,
    stopImmediatePropagation: WEB_ALGORITHM_ANCHORS.stopImmediatePropagation,
    stopPropagation: WEB_ALGORITHM_ANCHORS.stopPropagation,
  },)
    .map(function eventEffect([member, algorithm,],): IntrinsicEffectEntry {
    return receiverEffect({
      ownerType: 'Event',
      member,
      evidence: 'DOM commit 5796f716 Event cancellation and propagation-state algorithms',
      authority: webAuthority({
        source: WEB_SOURCES.dom,
        algorithm,
      },),
    },);
  },),
  {
    provenance: { kind: 'dom', },
    ownerType: 'ParentNode',
    member: 'replaceChildren',
    targets: [
      RECEIVER,
      {
        kind: 'arguments-from',
        startIndex: 0,
      },
    ],
    evidence: 'DOM commit 5796f716 ParentNode.replaceChildren algorithm',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: WEB_ALGORITHM_ANCHORS.replaceChildren,
    },),
  },
];
