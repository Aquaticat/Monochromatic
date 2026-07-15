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
  fillRect: 'sha256:d6fc30bb9fcf85ff3077bebda85c712a38255a0bcc342e114475b02fda8f7774',
  textDrawing: 'sha256:55e989d08d5d06e9cb079ebf00481499511a85bf42ae5b68853a6daef0ee4e02',
  stateStack: 'sha256:8a8ac3c75610f3f439d500479736a797f406b14f10aa434a224175089ef08d7f',
  transformations: 'sha256:3805edd80bfa450f29ab5d3a826c7039c3709d17af989b25c12db3dd16dfed47',
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
  ...[
    {
      ownerType: 'CanvasRect',
      member: 'fillRect',
      algorithm: CANVAS_ALGORITHM_ANCHORS.fillRect,
      evidence: 'fills receiver canvas bitmap',
    },
    {
      ownerType: 'CanvasText',
      member: 'fillText',
      algorithm: CANVAS_ALGORITHM_ANCHORS.textDrawing,
      evidence: 'fills text glyphs into receiver canvas bitmap',
    },
    {
      ownerType: 'CanvasText',
      member: 'strokeText',
      algorithm: CANVAS_ALGORITHM_ANCHORS.textDrawing,
      evidence: 'strokes text glyphs into receiver canvas bitmap',
    },
    {
      ownerType: 'CanvasState',
      member: 'save',
      algorithm: CANVAS_ALGORITHM_ANCHORS.stateStack,
      evidence: 'pushes receiver drawing state',
    },
    {
      ownerType: 'CanvasState',
      member: 'restore',
      algorithm: CANVAS_ALGORITHM_ANCHORS.stateStack,
      evidence: 'pops and restores receiver drawing state',
    },
    {
      ownerType: 'CanvasTransform',
      member: 'rotate',
      algorithm: CANVAS_ALGORITHM_ANCHORS.transformations,
      evidence: 'changes receiver current transformation matrix',
    },
    {
      ownerType: 'CanvasTransform',
      member: 'translate',
      algorithm: CANVAS_ALGORITHM_ANCHORS.transformations,
      evidence: 'changes receiver current transformation matrix',
    },
  ].map(function canvasReceiverMutation({
    ownerType,
    member,
    algorithm,
    evidence,
  }: Readonly<{
    ownerType: string;
    member: string;
    algorithm: string;
    evidence: string;
  }>,): IntrinsicEffectEntry {
    return {
      provenance: { kind: 'dom', },
      ownerType,
      member,
      targets: [RECEIVER,],
      evidence: `HTML commit 255188e5 ${evidence}`,
      authority: webAuthority({
        source: WEB_SOURCES.html,
        algorithm,
      },),
    };
  },),
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
