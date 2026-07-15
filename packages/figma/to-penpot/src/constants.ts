/**
 * Shared constants for the Figma-to-Penpot converter.
 *
 * @module figma-to-penpot-constants
 */

import { SKIP, } from './read.ts';
import type {
  PenpotShapeType,
  PenpotTransform,
} from './types.ts';

/**
 * SVG-shaped identity matrix used as the default transform and as the reset value when normalising shape positions into x/y.
 */
export const IDENTITY_TRANSFORM: PenpotTransform = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

/**
 * Penpot feature flags required for the importer to accept files produced by this converter; older clients without these are not the intended consumers.
 */
export const DEFAULT_FEATURES: readonly string[] = [
  'fdata/path-data',
  'design-tokens/v1',
  'variants/v1',
  'layout/grid',
  'components/v2',
  'fdata/shape-data-type',
];

/**
 * Penpot binfile schema version stamped onto every produced {@link PenpotFile}.
 */
export const PENPOT_FILE_VERSION = 67;

/**
 * All-zero UUID Penpot uses as the implicit root-frame id on every page.
 */
export const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Degenerate non-zero extent Penpot's root frame uses so its selrect is valid without occupying real space.
 */
export const ROOT_FRAME_EXTENT = 0.01;

/**
 * Default font size, in px, for Figma text nodes whose size is missing.
 */
export const DEFAULT_FONT_SIZE = 16;

/**
 * Background colour Penpot pages fall back to for `.fig`/`.jam` canvases.
 */
export const PAGE_BACKGROUND_FIG = '#F5F5F5';

/**
 * Background colour Penpot pages fall back to for `.deck` slides.
 */
export const PAGE_BACKGROUND_DECK = '#FFFFFF';

/**
 * Lookup mapping each Figma `NodeType` to its Penpot shape equivalent, or the {@link SKIP} sentinel when the node has no Penpot counterpart and should be dropped.
 */
export const FIGMA_NODE_TYPE_MAP: Record<string, PenpotShapeType | typeof SKIP> = {
  // Structural nodes (no direct Penpot shape)
  'NodeType.DOCUMENT': SKIP,
  'NodeType.NONE': SKIP,
  'NodeType.NODE': SKIP,
  // Deck-specific structural nodes (skip; slides become pages)
  'NodeType.SLIDE_GRID': SKIP,
  'NodeType.SLIDE_ROW': SKIP,
  // Containers
  'NodeType.CANVAS': 'frame',
  'NodeType.FRAME': 'frame',
  'NodeType.SECTION': 'frame',
  'NodeType.GROUP': 'group',
  'NodeType.SYMBOL': 'frame',
  'NodeType.INSTANCE': 'frame',
  'NodeType.COMPONENT': 'frame',
  'NodeType.COMPONENT_SET': 'frame',
  'NodeType.STICKY': 'frame',
  'NodeType.SLIDE': 'frame',
  // Primitives
  'NodeType.TEXT': 'text',
  'NodeType.ROUNDED_RECTANGLE': 'rect',
  'NodeType.RECTANGLE': 'rect',
  'NodeType.LINE': 'path',
  'NodeType.VECTOR': 'path',
  'NodeType.ELLIPSE': 'circle',
  'NodeType.BOOLEAN_OPERATION': 'bool',
  'NodeType.STAR': 'path',
  'NodeType.POLYGON': 'path',
  'NodeType.REGULAR_POLYGON': 'path',
  // Other
  'NodeType.TABLE': 'frame',
  'NodeType.VARIABLE': SKIP,
  'NodeType.VARIABLE_SET': SKIP,
};
