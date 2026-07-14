/**
 * Audited browser canvas host effects.
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
 * Shared receiver effect target.
 */
const RECEIVER: IntrinsicEffectTarget = { kind: 'receiver', };

/**
 * Exact source-derived HTML canvas algorithm anchors.
 */
const CANVAS_ALGORITHM_ANCHORS = {
  beginPath: 'sha256:3a89df2abbfa728f8b3b73fc85440817b4e46d50eae8f6959e46f7ee0f74519d',
  clearRect: 'sha256:d88d05ce8037b68a44b7122fe34ba024454dcb077b050463ccfbd1e79204dede',
  drawImage: 'sha256:8f514e766f4f3f04c78e4ff6d6347f595e1914c26afa08afd4bb55c8758c1d3c',
  getContext: 'sha256:26faf4ce5f2be1e534f79d0a101f44736b95ca09eca5951b5d5c3d41ee6a495b',
  lineTo: 'sha256:ca46c6c397391ecef054be5c34f5e3f54ba2e245c4bb6153c503c1a248049b77',
  offscreenGetContext: 'sha256:5ab8f5b240265e016c169cdae97fee125416f352e2e0cee26cb94ab3a6522510',
  moveTo: 'sha256:85f831a8935bedd2af80d721ee408ff6f110efae627b2881bd507201a2e820f0',
  stroke: 'sha256:4727d358a130165274d5c2ad8c91ecf8b6567b26850c52aafe7e6b93bd715b1f',
} as const;

/**
 * Canvas effects audited against HTML algorithms.
 */
export const BROWSER_HOST_CANVAS_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'HTMLCanvasElement',
    member: 'getContext',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 getContext sets canvas context mode and returns its rendering context',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.getContext,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'OffscreenCanvas',
    member: 'getContext',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 getContext sets offscreen canvas context mode and returns its rendering context',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.offscreenGetContext,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasRect',
    member: 'clearRect',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 clearRect erases pixels in receiver canvas bitmap',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.clearRect,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasDrawImage',
    member: 'drawImage',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 drawImage paints source image onto receiver canvas bitmap',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.drawImage,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasDrawPath',
    member: 'beginPath',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 beginPath empties receiver current path',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.beginPath,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasDrawPath',
    member: 'stroke',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 stroke paints receiver current path onto canvas bitmap',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.stroke,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasPath',
    member: 'lineTo',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 lineTo appends a line to receiver current path',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.lineTo,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'CanvasPath',
    member: 'moveTo',
    targets: [RECEIVER,],
    evidence: 'HTML commit 255188e5 moveTo appends a point to receiver current path',
    authority: webAuthority({
      source: WEB_SOURCES.html,
      algorithm: CANVAS_ALGORITHM_ANCHORS.moveTo,
    },),
  },
];
