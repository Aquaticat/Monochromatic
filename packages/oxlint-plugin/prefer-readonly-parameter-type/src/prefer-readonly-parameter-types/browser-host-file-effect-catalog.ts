/**
 * Audited browser File API host effects.
 *
 * @module
 */

import {
  WEB_SOURCES,
  webAuthority,
} from './browser-host-authority.ts';
import type {
  IntrinsicEffectEntry,
} from './intrinsic-effect-catalog.ts';

/**
 * Exact source-derived File API algorithm anchors.
 */
const FILE_ALGORITHM_ANCHORS = {
  blobText: 'sha256:ba362f05d739d6de500ca6e0d3fb42bf9438c620f2f654d909f4de05b50e7e91',
  createObjectUrl: 'sha256:6940ee9650716da490ec6b174b4e9f16e34b189f94e81aca983bf5ffd89052d7',
  fileListItem: 'sha256:1e4fa33357e171999c6ebeefe132fdfba7a46a5448fa2909750d2e93180a2287',
} as const;

/**
 * Browser file effects audited against File API algorithms.
 */
export const BROWSER_HOST_FILE_EFFECTS: readonly IntrinsicEffectEntry[] = [
  {
    provenance: { kind: 'dom', },
    ownerType: 'Blob',
    member: 'text',
    targets: [],
    evidence: 'File API commit cd1d1da9 Blob.text reads immutable blob bytes into text',
    authority: webAuthority({
      source: WEB_SOURCES.fileApi,
      algorithm: FILE_ALGORITHM_ANCHORS.blobText,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'FileList',
    member: 'item',
    targets: [],
    evidence: 'File API commit cd1d1da9 FileList.item returns indexed file without changing list',
    authority: webAuthority({
      source: WEB_SOURCES.fileApi,
      algorithm: FILE_ALGORITHM_ANCHORS.fileListItem,
    },),
  },
  {
    provenance: { kind: 'dom', },
    ownerType: 'URL',
    member: 'createObjectURL',
    targets: [],
    opaqueTargets: [{
      kind: 'argument',
      index: 0,
    },],
    evidence: 'File API commit cd1d1da9 createObjectURL retains blob in host blob URL store',
    authority: webAuthority({
      source: WEB_SOURCES.fileApi,
      algorithm: FILE_ALGORITHM_ANCHORS.createObjectUrl,
    },),
  },
];
