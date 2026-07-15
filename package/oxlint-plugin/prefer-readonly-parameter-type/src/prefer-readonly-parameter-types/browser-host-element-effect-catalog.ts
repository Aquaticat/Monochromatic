/**
 * Audited browser element and token-list host effects.
 *
 * @module
 */

import {
  WEB_SOURCES,
  webAuthority,
} from './browser-host-authority.ts';
import type {
  IntrinsicEffectEntry,
  IntrinsicEffectTarget,
} from './intrinsic-effect-catalog.ts';

/**
 * Shared receiver mutation target.
 */
const RECEIVER: IntrinsicEffectTarget = { kind: 'receiver', };

/**
 * Exact source-derived element algorithm anchors.
 */
const ELEMENT_ALGORITHM_ANCHORS = {
  append: 'sha256:afd1d5de4c27a228c3b7300cf5439c5417b33cd1ab5a7dd440b777ddcd5338af',
  closest: 'sha256:9533a4606f506ae9153ca4f24c83f81c19ab880d8095c2c26493734b37dfb944',
  getBoundingClientRect: 'sha256:a502bd1929bfc68c3fed08e01fc88373f14f1e8dc36681aeb099b1b6187f7f41',
  hidePopover: 'sha256:83d88645f123f3300b6c4a9919c7e3029a0a30db4dcb933f319c44ba681ad08f',
  querySelector: 'sha256:5d602c74e50627ef14b0f909d60c256aa71a5c0cb9566aadd5d5e06e3be466eb',
  querySelectorAll: 'sha256:6d9312e7835144b477c992b3ca9f4f9c6c98aed0b134bb64399bca7044c5d920',
  setAttribute: 'sha256:19b5afa2c8de4a6eb44fe2962dc8323a8235ff6a69af77b61951ce9be68e9571',
  toggle: 'sha256:3b944ec3d5676134fb7cea4b4a75576e5cd32aa2f5b4a24e3959f0b50fc0be00',
} as const;

/**
 * Browser element effects audited against DOM and CSSOM View algorithms.
 */
export const BROWSER_HOST_ELEMENT_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'ParentNode',
    member: 'append',
    targets: [
      RECEIVER,
      {
        kind: 'arguments-from',
        startIndex: 0,
      },
    ],
    evidence: 'DOM commit 5796f716 ParentNode.append inserts or moves supplied nodes',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.append,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'Element',
    member: 'closest',
    targets: [],
    evidence: 'DOM commit 5796f716 Element.closest only returns first matching inclusive ancestor',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.closest,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'ParentNode',
    member: 'querySelector',
    targets: [],
    evidence: 'DOM commit 5796f716 ParentNode.querySelector only returns first matching descendant',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.querySelector,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'ParentNode',
    member: 'querySelectorAll',
    targets: [],
    evidence: 'DOM commit 5796f716 ParentNode.querySelectorAll only returns static matching descendants',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.querySelectorAll,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'Element',
    member: 'setAttribute',
    targets: [RECEIVER,],
    evidence: 'DOM commit 5796f716 Element.setAttribute changes receiver attribute state',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.setAttribute,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'DOMTokenList',
    member: 'toggle',
    targets: [RECEIVER,],
    evidence: 'DOM commit 5796f716 DOMTokenList.toggle changes associated token state',
    authority: webAuthority({
      source: WEB_SOURCES.dom,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.toggle,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'HTMLElement',
    member: 'hidePopover',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 HTMLElement.hidePopover changes receiver popover state',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.hidePopover,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'Element',
    member: 'getBoundingClientRect',
    targets: [],
    evidence: 'CSSOM View commit 0222af95 getBoundingClientRect returns a computed DOMRect',
    authority: webAuthority({
      source: WEB_SOURCES.cssomView,
      algorithm: ELEMENT_ALGORITHM_ANCHORS.getBoundingClientRect,
    },),
  },
];
