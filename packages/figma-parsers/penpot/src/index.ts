/**
 * Figma-to-Penpot file converter.
 *
 * Converts decoded Figma Kiwi documents (from `@monochromatic-dev/figma-kiwi`)
 * into Penpot binfile-v3 format: a ZIP archive of JSON files following
 * the penpot/export-files schema.
 *
 * @module figma-to-penpot
 */

import type { FigmaFile, } from '@monochromatic-dev/figma-kiwi';

import { ZipWriter, } from '@monochromatic-dev/module-zip-writer';

// region Types

/** UUID v4 string. */
type Uuid = string;

/** Penpot shape type enum. */
type PenpotShapeType = 'frame' | 'group' | 'bool' | 'rect' | 'circle' | 'path' | 'text'
  | 'image' | 'svg-raw';

/** Penpot fill object. */
type PenpotFill = {
  fillColor?: string;
  fillOpacity?: number;
  fillColorGradient?: Record<string, unknown>;
  fillImage?: {
    name: string;
    width: number;
    height: number;
    mtype: string;
    id: Uuid;
  };
};

/** Penpot stroke object. */
type PenpotStroke = {
  strokeStyle: 'solid' | 'dotted' | 'dashed' | 'mixed';
  strokeAlignment: 'center' | 'inner' | 'outer';
  strokeWidth: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeColorGradient?: Record<string, unknown>;
  strokeCapStart?: string;
  strokeCapEnd?: string;
};

/** Penpot 2D transform matrix. */
type PenpotTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/** Penpot rect (selection rectangle). */
type PenpotSelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Penpot point. */
type PenpotPoint = {
  x: number;
  y: number;
};

/** A Penpot shape object (core data model). */
type PenpotShape = {
  id: Uuid;
  name: string;
  type: PenpotShapeType;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  rotation: number;
  selrect: PenpotSelRect;
  points: [
    PenpotPoint,
    PenpotPoint,
    PenpotPoint,
    PenpotPoint,
  ];
  transform: PenpotTransform;
  transformInverse: PenpotTransform;
  parentId: Uuid;
  frameId: Uuid;
  flipX: boolean | null;
  flipY: boolean | null;
  proportion: number;
  proportionLock: boolean;
  opacity?: number;
  fills: PenpotFill[];
  strokes: PenpotStroke[];
  pageId: Uuid;
  // Container types (frame, group, bool)
  shapes?: Uuid[];
  // Path/bool content
  content?: string | Record<string, unknown>;
  // Text content
  growType?: string;
  // Bool type
  boolType?: string;
  // Frame-specific
  hideFillOnExport?: boolean;
  showContent?: boolean;
  hideInViewer?: boolean;
  // Border radius (rect/frame)
  r1?: number;
  r2?: number;
  r3?: number;
  r4?: number;
  // Layout (frame)
  layout?: string;
  layoutGap?: Record<string, number>;
  layoutPadding?: Record<string, number>;
  layoutFlexDir?: string;
  layoutAlignItems?: string;
  layoutJustifyContent?: string;
  layoutAlignContent?: string;
  layoutWrapType?: string;
  layoutItemHSizing?: string;
  layoutItemVSizing?: string;
  layoutGapType?: string;
  layoutPaddingType?: string;
  // Constraints
  constraintsH?: string;
  constraintsV?: string;
  // Component references
  componentId?: Uuid;
  componentFile?: Uuid;
  componentRoot?: boolean;
  shapeRef?: Uuid;
  mainInstance?: boolean;
  // Image metadata
  metadata?: {
    name: string;
    width: number;
    height: number;
    mtype: string;
    id: Uuid;
  };
  // Touched flags
  touched?: string[];
  // Blocked/hidden
  blocked?: boolean;
  hidden?: boolean;
  locked?: boolean;
  // Blend mode
  blendMode?: string;
  // Shadow
  shadow?: Record<string, unknown>[];
  // Blur
  blur?: Record<string, unknown>;
};

/** A Penpot page. */
type PenpotPage = {
  id: Uuid;
  name: string;
  background: string;
  index: number;
};

/** A Penpot media object. */
type PenpotMedia = {
  id: Uuid;
  name: string;
  width: number;
  height: number;
  mtype: string;
  mediaId: Uuid;
  thumbnailId?: Uuid;
  isLocal: boolean;
  createdAt: string;
};

/** Penpot manifest entry for a file. */
type PenpotManifestFile = {
  id: Uuid;
  name: string;
  features: string[];
};

/** The full Penpot export manifest. */
type PenpotManifest = {
  type: 'penpot/export-files';
  version: number;
  generatedBy: string;
  referer: string;
  files: PenpotManifestFile[];
  relations: [
    Uuid,
    Uuid,
  ][];
};

/** A Penpot storage object metadata entry. */
type PenpotStorageObject = {
  id: Uuid;
  size: number;
  contentType: string;
  bucket: string;
  hash?: string;
};

/** A Penpot file-level metadata object. */
type PenpotFile = {
  id: Uuid;
  name: string;
  revn: number;
  vern: number;
  createdAt: string;
  modifiedAt: string;
  isShared: boolean;
  hasMediaTrimmed: boolean;
  version: number;
  features: string[];
  options?: Record<string, unknown>;
  migrations?: string[];
};

/** A converted Penpot document ready for ZIP serialization. */
type PenpotDocument = {
  manifest: PenpotManifest;
  file: PenpotFile;
  pages: Map<Uuid, PenpotPage>;
  shapes: Map<Uuid, PenpotShape>;
  media: Map<Uuid, PenpotMedia>;
  storageObjects: Map<Uuid, {
    meta: PenpotStorageObject;
    data: Uint8Array;
  }>;
  components: Map<Uuid, Record<string, unknown>>;
  colors: Map<Uuid, Record<string, unknown>>;
  typographies: Map<Uuid, Record<string, unknown>>;
  tokens: Record<string, unknown> | null;
  thumbnails: {
    path: string;
    data: Record<string, unknown>;
  }[];
};

/** Options for the converter. */
type ConvertOptions = {
  /** File name override (defaults to Figma meta.fileName). */
  fileName?: string;
  /** Generator string for manifest. */
  generatedBy?: string;
};

// endregion

// region Constants

/** SVG-shaped identity matrix used as the default transform and as the reset value when normalising shape positions into x/y. */
const IDENTITY_TRANSFORM: PenpotTransform = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

/** Penpot feature flags required for the importer to accept files produced by this converter; older clients without these are not the intended consumers. */
const DEFAULT_FEATURES = [
  'fdata/path-data',
  'design-tokens/v1',
  'variants/v1',
  'layout/grid',
  'components/v2',
  'fdata/shape-data-type',
];

/** Penpot binfile schema version stamped onto every produced `PenpotFile`. */
const PENPOT_FILE_VERSION = 67;

/** All-zero UUID Penpot uses as the implicit root-frame id on every page. */
const ZERO_UUID: Uuid = '00000000-0000-0000-0000-000000000000';

/** Lookup that maps each Figma `NodeType` to its Penpot shape equivalent (or `null` when the node has no Penpot counterpart and should be skipped). */
const FIGMA_NODE_TYPE_MAP: Record<string, PenpotShapeType | null> = {
  // Structural nodes (no direct Penpot shape)
  'NodeType.DOCUMENT': null,
  'NodeType.NONE': null,
  'NodeType.NODE': null,
  // Deck-specific structural nodes (skip; slides become pages)
  'NodeType.SLIDE_GRID': null,
  'NodeType.SLIDE_ROW': null,
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
  'NodeType.VARIABLE': null,
  'NodeType.VARIABLE_SET': null,
};

// endregion

// region UUID generation

/** Monotonic counter feeding the deterministic UUID fallback when `crypto.randomUUID` is unavailable. */
let uuidCounter = 0;

/** Generate a unique UUID v4. */
function nextUuid(): Uuid {
  uuidCounter += 1;
  // Use crypto.randomUUID when available, fallback to counter-based
  try {
    return crypto.randomUUID();
  }
  catch {
    /** Snapshot of the counter so each section of the fallback UUID derives from the same value. */
    const c = uuidCounter;
    /** Format `n` as zero-padded hex of width `w`; shared by every UUID segment below. */
    function h(
      n: number,
      w: number,
    ) {
      return (n >>> 0).toString(16,).padStart(
        w,
        '0',
      );
    }
    /** First 8-hex segment of the synthetic UUID (low 32 bits of the counter). */
    const a = h(
      c & 0xFF_FF_FF_FF,
      8,
    );
    /** Second 4-hex segment (bits 32-47 of the counter). */
    const b = h(
      (c >> 32) & 0xFF_FF,
      4,
    );
    return `${a}-${b}-4${
      h(
        c & 0xF_FF,
        3,
      )
        .slice(-3,)
    }-8${
      h(
        c & 0xF_FF,
        3,
      )
        .slice(-3,)
    }-${
      h(
        c & 0xFF_FF,
        4,
      )
    }${
      h(
        (c >> 4) & 0xFF_FF,
        4,
      )
    }${
      h(
        (c >> 8) & 0xFF_FF,
        4,
      )
    }`
      .slice(
        0,
        36,
      );
  }
}

/** Generate a stable UUID from Figma GUID (sessionID + localID). */
function guidToUuid(
  sessionId: unknown,
  localId: unknown,
): Uuid {
  /** Figma session id coerced to a number so it can be bit-shifted; defaults to 0 when missing or wrong-typed. */
  const sid = (typeof sessionId) === 'number' ? sessionId : 0;
  /** Figma local id coerced to a number for bit-shifting; defaults to 0 when missing or wrong-typed. */
  const lid = (typeof localId) === 'number' ? localId : 0;
  /** Format `n` as zero-padded hex of width `w`; shared by every UUID segment below so the encoding is uniform. */
  function h(
    n: number,
    w: number,
  ) {
    return (n >>> 0).toString(16,).padStart(
      w,
      '0',
    );
  }
  /** First 8-hex segment: the full session id, so files from the same session cluster together. */
  const a = h(
    sid,
    8,
  );
  /** Second 4-hex segment: high bits of the local id, distinguishing nodes within a session. */
  const b = h(
    (lid >>> 16) & 0xFF_FF,
    4,
  );
  /** Third segment: literal `'4'` (UUID v4 marker) plus 3 hex digits derived from the local id. */
  const c = `4${
    h(
      (lid >>> 4) & 0xF_FF,
      3,
    )
  }`;
  /** Variant nibble forced into the 8-B range so the result is a well-formed v4 UUID. */
  const yNibble = ((lid & 0xF) | 0x8).toString(16,);
  /** Fourth segment: variant nibble plus 3 hex digits sourced from the session id. */
  const d = `${yNibble}${
    h(
      (sid >>> 16) & 0xF_FF,
      3,
    )
  }`;
  /** Final 12-hex segment: composite of remaining low bits of both ids so the full GUID is encoded losslessly. */
  const e = `${
    h(
      sid & 0xFF_FF,
      4,
    )
  }${
    h(
      (lid >>> 8) & 0xFF,
      2,
    )
  }${
    h(
      lid & 0xFF,
      2,
    )
  }${
    h(
      (sid >>> 8) & 0xFF,
      2,
    )
  }${
    h(
      (sid >>> 24) & 0xFF,
      2,
    )
  }`;
  return `${a}-${b}-${c}-${d}-${e}`.slice(
    0,
    36,
  );
}

// endregion

// region Color conversion

/**
 * Convert Figma Color struct {r, g, b, a} (0-1 float) to hex string.
 *
 * Figma stores colors as 0-1 floats; Penpot uses "#RRGGBB" hex strings.
 */
function figmaColorToHex(color: Record<string, unknown>,): string {
  /** Red channel rounded to 0-255 integer so it can be hex-encoded. */
  const r = Math.round(((typeof color.r) === 'number' ? color.r : 0) * 255,);
  /** Green channel rounded to 0-255 integer so it can be hex-encoded. */
  const g = Math.round(((typeof color.g) === 'number' ? color.g : 0) * 255,);
  /** Blue channel rounded to 0-255 integer so it can be hex-encoded. */
  const b = Math.round(((typeof color.b) === 'number' ? color.b : 0) * 255,);
  return `#${
    r.toString(16,).padStart(
      2,
      '0',
    )
  }${
    g.toString(16,).padStart(
      2,
      '0',
    )
  }${
    b.toString(16,).padStart(
      2,
      '0',
    )
  }`
    .toUpperCase();
}

/**
 * Convert Figma Color with alpha to Penpot fill.
 *
 * Penpot separates color and opacity: `fillColor` is hex, `fillOpacity` is 0-1.
 */
function figmaColorToFill(color: Record<string, unknown>,): PenpotFill {
  return {
    fillColor: figmaColorToHex(color,),
    fillOpacity: (typeof color.a) === 'number' ? color.a : 1,
  };
}

// endregion

// region Figma paint -> Penpot fill/stroke

/** Figma PaintType to Penpot fill. */
function figmaPaintToFill(paint: Record<string, unknown>,): PenpotFill | null {
  /** Paint type string normalised across the enum-style `type` and the schema-style `__type` keys Figma emits. */
  const paintType = String(paint.type ?? paint.__type ?? '',);
  if ((paintType === 'PaintType.SOLID') || paintType.includes('SOLID',)) {
    /** Optional color struct; guarded so missing-color paints fall through to `null`. */
    const color = paint.color as Record<string, unknown> | undefined;
    if (!color)
      return null;
    /** Solid fill assembled from the color; opacity may be overridden by the paint's own `opacity` field below. */
    const fill = figmaColorToFill(color,);
    if ((typeof paint.opacity) === 'number')
      fill.fillOpacity = paint.opacity;
    return fill;
  }
  // Gradient and image fills need more complex handling
  // For now, skip non-solid fills
  return null;
}

/** Figma PaintType to Penpot stroke. */
function figmaPaintToStroke(
  paint: Record<string, unknown>,
  strokeWeight: number,
  strokeAlign: string,
): PenpotStroke | null {
  /** Paint type string normalised across the enum-style `type` and the schema-style `__type` keys, same as the fill path. */
  const paintType = String(paint.type ?? paint.__type ?? '',);
  if ((paintType === 'PaintType.SOLID') || paintType.includes('SOLID',)) {
    /** Optional color struct; guarded so missing-color paints fall through to `null`. */
    const color = paint.color as Record<string, unknown> | undefined;
    if (!color)
      return null;
    return {
      strokeStyle: 'solid',
      strokeAlignment: strokeAlign === 'OUTSIDE'
        ? 'outer'
        : (strokeAlign === 'INSIDE'
          ? 'inner'
          : 'center'),
      strokeWidth: strokeWeight,
      strokeColor: figmaColorToHex(color,),
      strokeOpacity: (typeof paint.opacity) === 'number' ? paint.opacity : 1,
    };
  }
  return null;
}

// endregion

// region Selrect/points computation

/** Compute Penpot selrect and points from x/y/width/height. */
function computeSelRect(
  x: number,
  y: number,
  width: number,
  height: number,
): {
  selrect: PenpotSelRect;
  points: [
    PenpotPoint,
    PenpotPoint,
    PenpotPoint,
    PenpotPoint,
  ];
} {
  /** Right edge of the bounding rect, derived once and reused for both selrect and the corner points. */
  const x2 = x + width;
  /** Bottom edge of the bounding rect, derived once and reused for both selrect and the corner points. */
  const y2 = y + height;
  return {
    selrect: {
      x,
      y,
      width,
      height,
      x1: x,
      y1: y,
      x2,
      y2,
    },
    points: [
      {
        x,
        y,
      },
      {
        x: x2,
        y,
      },
      {
        x: x2,
        y: y2,
      },
      {
        x,
        y: y2,
      },
    ],
  };
}

// endregion

// region Transform conversion

/** Convert Figma Matrix struct to Penpot transform. */
function figmaTransformToPenpot(
  transform: Record<string, unknown> | undefined | null,
): PenpotTransform {
  if (!transform)
    return { ...IDENTITY_TRANSFORM, };
  // Figma Matrix: {m00, m01, m02, m10, m11, m12} = {a, b, c, d, tx, ty}
  // Penpot: {a, b, c, d, e, f} = SVG matrix format
  // | a c e |   | m00 m01 m02 |   | a c tx |
  // | b d f | = | m10 m11 m12 | = | b d ty |
  // | 0 0 1 |   | 0   0   1   |   | 0 0 1  |
  return {
    a: (typeof transform.m00) === 'number' ? transform.m00 : 1,
    b: (typeof transform.m10) === 'number' ? transform.m10 : 0,
    c: (typeof transform.m01) === 'number' ? transform.m01 : 0,
    d: (typeof transform.m11) === 'number' ? transform.m11 : 1,
    e: (typeof transform.m02) === 'number' ? transform.m02 : 0,
    f: (typeof transform.m12) === 'number' ? transform.m12 : 0,
  };
}

// endregion

// region ParentIndex parsing

/**
 * Parse Figma ParentIndex struct to extract position string.
 *
 * Figma uses position strings like "!", "#", etc. to indicate
 * the insertion position among siblings. Penpot uses a `shapes`
 * array on parent shapes to define child ordering.
 */
function parseParentIndex(parentIndex: Record<string, unknown> | undefined | null,): {
  parentGuid: {
    sessionId: number;
    localId: number;
  };
  position: string;
} | null {
  if (!parentIndex)
    return null;
  /** Optional parent-GUID struct; guarded so malformed parentIndex entries return `null`. */
  const guid = parentIndex.guid as Record<string, unknown> | undefined;
  if (!guid)
    return null;
  return {
    parentGuid: {
      sessionId: (typeof guid.sessionID) === 'number' ? guid.sessionID : 0,
      localId: (typeof guid.localID) === 'number' ? guid.localID : 0,
    },
    position: (typeof parentIndex.position) === 'string' ? parentIndex.position : '',
  };
}

// endregion

// region Main conversion

/**
 * Convert a parsed Figma file to a Penpot document.
 *
 * @param figmaFile - Fully decoded Figma file from `parseFigmaFile`
 *
 * @param options - Conversion options
 *
 * @returns Penpot document ready for ZIP serialization
 */
function convertFigmaToPenpot(
  figmaFile: FigmaFile,
  options: ConvertOptions = {},
): PenpotDocument {
  /** Penpot file UUID assigned up-front so manifest, file metadata, and entry paths can all reference it. */
  const fileId = nextUuid();
  /** Display name for the converted file; caller override beats Figma's `meta.fileName`, with a generic fallback for both. */
  const fileName = options.fileName ?? figmaFile.meta.fileName ?? 'Untitled';
  /** ISO timestamp stamped on both `createdAt` and `modifiedAt` so the file looks freshly minted to Penpot. */
  const now = new Date().toISOString();

  /** Cross-pass index from composite `"sessionID:localID"` keys to stable Penpot UUIDs, built first so later passes can resolve parents and children consistently. */
  const figmaGuidToUuid = new Map<string, Uuid>();
  /** Raw NodeChange entries lifted out of the Figma document; iterated repeatedly below to build the tree. */
  const nodeChanges = (figmaFile.document?.nodeChanges ?? []) as Record<string,
    unknown>[];

  // First pass: assign UUIDs to all nodes
  for (const nc of nodeChanges) {
    /** Per-node GUID struct guarded before reading session/local ids. */
    const guid = nc.guid as Record<string, unknown> | undefined;
    if (guid) {
      /** Numeric session id with 0-fallback so missing/wrong-typed values stay deterministic. */
      const sid = (typeof guid.sessionID) === 'number' ? guid.sessionID : 0;
      /** Numeric local id with 0-fallback so missing/wrong-typed values stay deterministic. */
      const lid = (typeof guid.localID) === 'number' ? guid.localID : 0;
      /** Composite key matching the format used by `childrenByParent` and `nodeByGuid`. */
      const key = `${sid}:${lid}`;
      figmaGuidToUuid.set(
        key,
        guidToUuid(
          sid,
          lid,
        ),
      );
    }
  }

  /** Page metadata accumulator; populated as we walk each Figma canvas or slide that becomes a Penpot page. */
  const pages = new Map<Uuid, PenpotPage>();
  /** Every shape generated across pages, keyed by Penpot UUID; written through the recursion in `convertNode`. */
  const shapes = new Map<Uuid, PenpotShape>();
  /** Media records (images, etc.) placeholder; populated once image decoding is implemented. */
  const media = new Map<Uuid, PenpotMedia>();
  /** Storage objects placeholder paired with their raw bytes; populated alongside `media`. */
  const storageObjects = new Map<Uuid, {
    meta: PenpotStorageObject;
    data: Uint8Array;
  }>();
  /** Component library placeholder; emitted into `files/<id>/components/` if Figma components are converted later. */
  const components = new Map<Uuid, Record<string, unknown>>();
  /** Shared color library placeholder; emitted into `files/<id>/colors/` if Figma styles are converted later. */
  const colors = new Map<Uuid, Record<string, unknown>>();
  /** Typography library placeholder; emitted into `files/<id>/typographies/` if Figma text styles are converted later. */
  const typographies = new Map<Uuid, Record<string, unknown>>();
  /** Thumbnail records emitted at fixed archive paths; populated when thumbnail generation is implemented. */
  const thumbnails: {
    path: string;
    data: Record<string, unknown>;
  }[] = [];

  /** Random-access index from GUID composite key to the original NodeChange; used by `convertNode` to look up parents and children quickly. */
  const nodeByGuid = new Map<string, Record<string, unknown>>();
  /** Reverse index from parent GUID key to its child GUID keys, building the parent->children tree the recursion needs. */
  const childrenByParent = new Map<string, string[]>();
  /** Tracks which pages have been materialised so the missing-page fallback below can detect an empty conversion. */
  const pageRootIds: Uuid[] = [];

  for (const nc of nodeChanges) {
    /** Per-node GUID struct guarded before reading session/local ids. */
    const guid = nc.guid as Record<string, unknown> | undefined;
    if (!guid)
      continue;
    /** Numeric session id with 0-fallback. */
    const sid = (typeof guid.sessionID) === 'number' ? guid.sessionID : 0;
    /** Numeric local id with 0-fallback. */
    const lid = (typeof guid.localID) === 'number' ? guid.localID : 0;
    /** Composite key consumed by both `nodeByGuid` and `childrenByParent`. */
    const key = `${sid}:${lid}`;
    nodeByGuid.set(
      key,
      nc,
    );

    /** Parent reference parsed from `parentIndex`; null when the node is unparented or malformed. */
    const parentIndex = parseParentIndex(
      nc.parentIndex as Record<string, unknown> | undefined | null,
    );
    if (parentIndex) {
      /** Composite key matching the parent in the `childrenByParent` map. */
      const parentKey =
        `${parentIndex.parentGuid.sessionId}:${parentIndex.parentGuid.localId}`;
      /** Existing child list for this parent, or a fresh array when first observed. */
      const children = childrenByParent.get(parentKey,) ?? [];
      children.push(key,);
      childrenByParent.set(
        parentKey,
        children,
      );
    }
  }

  /**
   * Distinguishes Figma `.deck` files, where slides map to pages, from `.fig`/`.jam` where canvases map to pages.
   *
   * The two branches below diverge only on which `NodeType` they accept as a page source.
   */
  const isDeck = figmaFile.fileType === 'deck';

  /** Candidate Figma nodes that will each become a Penpot page; populated by either the deck or fig/jam branch below. */
  const pageSourceNodes: {
    key: string;
    nc: Record<string, unknown>;
  }[] = [];
  if (isDeck) {
    for (const nc of nodeChanges) {
      /** Figma node type string used to filter for slides. */
      const nodeType = String(nc.type ?? '',);
      if (nodeType === 'NodeType.SLIDE') {
        /** GUID struct used to build the composite key matching `nodeByGuid`. */
        const guid = nc.guid as Record<string, unknown>;
        /** Numeric session id with 0-fallback. */
        const sid = (typeof guid.sessionID) === 'number' ? guid.sessionID : 0;
        /** Numeric local id with 0-fallback. */
        const lid = (typeof guid.localID) === 'number' ? guid.localID : 0;
        pageSourceNodes.push({
          key: `${sid}:${lid}`,
          nc,
        },);
      }
    }
  }
  else {
    for (const nc of nodeChanges) {
      /** Figma node type string used to filter for canvases. */
      const nodeType = String(nc.type ?? '',);
      if (nodeType === 'NodeType.CANVAS') {
        /** Canvas name lower-cased for the "Internal Only" heuristic below. */
        const name = String(nc.name ?? '',);
        /** Best-effort flag identifying Figma's hidden internal canvas so we don't emit it as a page. */
        const internalOnly = (nc.internalOnly === true) || (nc.editInfo != null);
        if (internalOnly && name.toLowerCase().includes('internal',))
          continue;

        /** GUID struct used to build the composite key matching `nodeByGuid`. */
        const guid = nc.guid as Record<string, unknown>;
        /** Numeric session id with 0-fallback. */
        const sid = (typeof guid.sessionID) === 'number' ? guid.sessionID : 0;
        /** Numeric local id with 0-fallback. */
        const lid = (typeof guid.localID) === 'number' ? guid.localID : 0;
        pageSourceNodes.push({
          key: `${sid}:${lid}`,
          nc,
        },);
      }
    }
  }

  /** Running 0-based index stamped onto each page so Penpot preserves the source order. */
  let pageIndex = 0;
  for (const {
    key: sourceKey,
    nc,
  } of pageSourceNodes) {
    /** Fresh UUID for this Penpot page; used in entry paths and as a back-reference on every shape. */
    const pageId = nextUuid();
    /** Penpot's well-known root-frame UUID; every page has exactly one root frame at this id. */
    const rootFrameId = ZERO_UUID;

    /** Page name, falling back to "Page N" when the Figma canvas/slide has no name. */
    const pageName = (typeof nc.name) === 'string' ? nc.name : `Page ${pageIndex + 1}`;
    /** Optional canvas-background struct used to colour the page; falls back to a neutral preset below. */
    const bgColor = nc.backgroundColor as Record<string, unknown> | undefined;
    pages.set(
      pageId,
      {
        id: pageId,
        name: pageName,
        background: bgColor
          ? figmaColorToHex(bgColor,)
          : (isDeck ? '#FFFFFF' : '#F5F5F5'),
        index: pageIndex,
      },
    );

    /** Implicit root frame Penpot requires on every page; child shapes attach to it via `parentId`/`frameId`. */
    const rootShape: PenpotShape = {
      id: rootFrameId,
      name: 'Root Frame',
      type: 'frame',
      x: 0,
      y: 0,
      width: 0.01,
      height: 0.01,
      rotation: 0,
      selrect: {
        x: 0,
        y: 0,
        width: 0.01,
        height: 0.01,
        x1: 0,
        y1: 0,
        x2: 0.01,
        y2: 0.01,
      },
      points: [
        {
          x: 0,
          y: 0,
        },
        {
          x: 0.01,
          y: 0,
        },
        {
          x: 0.01,
          y: 0.01,
        },
        {
          x: 0,
          y: 0.01,
        },
      ],
      transform: { ...IDENTITY_TRANSFORM, },
      transformInverse: { ...IDENTITY_TRANSFORM, },
      parentId: rootFrameId,
      frameId: rootFrameId,
      flipX: null,
      flipY: null,
      proportion: 1,
      proportionLock: false,
      fills: [{
        fillColor: '#FFFFFF',
        fillOpacity: 1,
      },],
      strokes: [],
      pageId,
      hideFillOnExport: false,
      shapes: [],
    };
    shapes.set(
      rootFrameId,
      rootShape,
    );

    /**
     * Direct GUID keys of this page-source node's children.
     *
     * For fig/jam the source is the CANVAS; for deck it is the SLIDE — in both cases children attach directly to the page's root frame.
     */
    const childKeys = childrenByParent.get(sourceKey,) ?? [];
    /** Penpot UUIDs collected from each child recursion, used to populate `rootShape.shapes` below. */
    const childUuids: Uuid[] = [];

    for (const childKey of childKeys) {
      /** Result UUID from converting one child subtree; may be null when the child has no Penpot equivalent. */
      const childUuid = convertNode(
        childKey,
        nodeByGuid,
        childrenByParent,
        figmaGuidToUuid,
        rootFrameId,
        rootFrameId,
        pageId,
        shapes,
        media,
        figmaFile.images,
      );
      if (childUuid)
        childUuids.push(childUuid,);
    }

    rootShape.shapes = childUuids;
    pageRootIds.push(pageId,);
    pageIndex += 1;
  }

  // If no canvas nodes found, create a single default page
  if (pages.size === 0) {
    /** Fresh UUID for the fallback page Penpot needs even when the Figma file produced no pages. */
    const pageId = nextUuid();
    /** Penpot's well-known root-frame UUID, same as the regular branch. */
    const rootFrameId = ZERO_UUID;
    pages.set(
      pageId,
      {
        id: pageId,
        name: 'Page 1',
        background: '#FFFFFF',
        index: 0,
      },
    );
    /** Implicit root frame for the fallback page; mirrors the regular branch so downstream code can treat both uniformly. */
    const rootShape: PenpotShape = {
      id: rootFrameId,
      name: 'Root Frame',
      type: 'frame',
      x: 0,
      y: 0,
      width: 0.01,
      height: 0.01,
      rotation: 0,
      selrect: {
        x: 0,
        y: 0,
        width: 0.01,
        height: 0.01,
        x1: 0,
        y1: 0,
        x2: 0.01,
        y2: 0.01,
      },
      points: [
        {
          x: 0,
          y: 0,
        },
        {
          x: 0.01,
          y: 0,
        },
        {
          x: 0.01,
          y: 0.01,
        },
        {
          x: 0,
          y: 0.01,
        },
      ],
      transform: { ...IDENTITY_TRANSFORM, },
      transformInverse: { ...IDENTITY_TRANSFORM, },
      parentId: rootFrameId,
      frameId: rootFrameId,
      flipX: null,
      flipY: null,
      proportion: 1,
      proportionLock: false,
      fills: [{
        fillColor: '#FFFFFF',
        fillOpacity: 1,
      },],
      strokes: [],
      pageId,
      hideFillOnExport: false,
      shapes: [],
    };
    shapes.set(
      rootFrameId,
      rootShape,
    );
    pageRootIds.push(pageId,);
  }

  /** File-level metadata Penpot expects at `files/<fileId>.json`; aggregates id, name, revision, features, and timestamps. */
  const file: PenpotFile = {
    id: fileId,
    name: fileName,
    revn: 1,
    vern: 0,
    createdAt: now,
    modifiedAt: now,
    isShared: false,
    hasMediaTrimmed: false,
    version: PENPOT_FILE_VERSION,
    features: [...DEFAULT_FEATURES,],
    options: {
      componentsV2: true,
      baseFontSize: '16px',
    },
  };

  /** Top-level archive manifest emitted at `manifest.json`; references the file by id and declares the feature set Penpot must support. */
  const manifest: PenpotManifest = {
    type: 'penpot/export-files',
    version: 1,
    generatedBy: options.generatedBy ?? 'figma-to-penpot/0.1.0',
    referer: 'penpot',
    files: [{
      id: fileId,
      name: fileName,
      features: [...DEFAULT_FEATURES,],
    },],
    relations: [],
  };

  return {
    manifest,
    file,
    pages,
    shapes,
    media,
    storageObjects,
    components,
    colors,
    typographies,
    tokens: null,
    thumbnails,
  };
}

// endregion

// region Node conversion

/**
 * Convert a single Figma NodeChange to a Penpot shape and recurse into children.
 *
 * @returns The Penpot UUID for this shape, or null if skipped
 */
function convertNode(
  nodeKey: string,
  nodeByGuid: Map<string, Record<string, unknown>>,
  childrenByParent: Map<string, string[]>,
  guidToUuidMap: Map<string, Uuid>,
  parentUuid: Uuid,
  frameUuid: Uuid,
  pageId: Uuid,
  shapes: Map<Uuid, PenpotShape>,
  media: Map<Uuid, PenpotMedia>,
  figmaImages: Map<string, Uint8Array>,
): Uuid | null {
  /** NodeChange entry for this key; null result means the GUID was never indexed and the node is skippable. */
  const nc = nodeByGuid.get(nodeKey,);
  if (!nc)
    return null;

  /** Figma node type string used to look up the Penpot equivalent. */
  const nodeType = String(nc.type ?? '',);
  /** Penpot shape type or `null` when this Figma node type has no Penpot equivalent (DOCUMENT, NONE, etc.). */
  const penpotType = FIGMA_NODE_TYPE_MAP[nodeType];

  if ((penpotType === null) || (penpotType === undefined))
    return null;

  /** Stable UUID for this shape; reuses the cross-pass GUID map so parents and children share consistent ids. */
  const shapeUuid = guidToUuidMap.get(nodeKey,) ?? nextUuid();

  /** SVG-shaped transform extracted from Figma's matrix struct; its `e`/`f` doubles as the shape's x/y. */
  const transform = figmaTransformToPenpot(
    nc.transform as Record<string, unknown> | undefined,
  );
  /** Optional size struct from Figma; guarded so missing-size nodes default to zero dimensions. */
  const size = nc.size as Record<string, unknown> | undefined;
  /** X position lifted out of the transform's translation component. */
  const x = (typeof transform.e) === 'number' ? transform.e : 0;
  /** Y position lifted out of the transform's translation component. */
  const y = (typeof transform.f) === 'number' ? transform.f : 0;
  /** Width pulled from the optional size struct, 0 when missing. */
  const width = size && ((typeof size.x) === 'number') ? size.x : 0;
  /** Height pulled from the optional size struct, 0 when missing. */
  const height = size && ((typeof size.y) === 'number') ? size.y : 0;

  /** Branch flag: true only when the node has a measurable bounding rect; paths/vectors without bounds skip the rect-based branch below. */
  const hasGeometry = (width > 0) && (height > 0);
  /** Geometry-aware x; collapsed to 0 for non-measurable shapes so selrect math stays valid. */
  const effectiveX = hasGeometry ? x : 0;
  /** Geometry-aware y; collapsed to 0 for non-measurable shapes. */
  const effectiveY = hasGeometry ? y : 0;
  /** Geometry-aware width; collapsed to 0 for non-measurable shapes. */
  const effectiveW = hasGeometry ? width : 0;
  /** Geometry-aware height; collapsed to 0 for non-measurable shapes. */
  const effectiveH = hasGeometry ? height : 0;

  /** Selrect plus its 4 corner points, computed from geometry or zeroed when the shape has none. */
  const {
    selrect,
    points,
  } = hasGeometry
    ? computeSelRect(
      effectiveX,
      effectiveY,
      effectiveW,
      effectiveH,
    )
    : {
      selrect: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
      points: [
        {
          x: 0,
          y: 0,
        },
        {
          x: 0,
          y: 0,
        },
        {
          x: 0,
          y: 0,
        },
        {
          x: 0,
          y: 0,
        },
      ] as [
        PenpotPoint,
        PenpotPoint,
        PenpotPoint,
        PenpotPoint,
      ],
    };

  /** Raw Figma paints for the fill list; iterated below to build Penpot fills, skipping anything non-solid. */
  const fillPaints = (nc.fillPaints ?? []) as Record<string, unknown>[];
  /** Penpot fill list accumulated from `fillPaints`. */
  const fills: PenpotFill[] = [];
  for (const paint of fillPaints) {
    /** Solid fill candidate; null means the paint type is unsupported (gradient, image) and is dropped. */
    const fill = figmaPaintToFill(paint,);
    if (fill)
      fills.push(fill,);
  }

  /** Raw Figma paints for the stroke list. */
  const strokePaints = (nc.strokePaints ?? []) as Record<string, unknown>[];
  /** Numeric stroke weight with 0-fallback so the stroke is degenerate but still encodable. */
  const strokeWeight = (typeof nc.strokeWeight) === 'number' ? nc.strokeWeight : 0;
  /** Figma stroke alignment enum ("INSIDE", "OUTSIDE", "CENTER") translated below; defaults to "CENTER". */
  const strokeAlign = String(nc.strokeAlign ?? 'CENTER',);
  /** Penpot stroke list accumulated from `strokePaints`. */
  const strokes: PenpotStroke[] = [];
  for (const paint of strokePaints) {
    /** Solid stroke candidate; null means the paint type is unsupported and is dropped. */
    const stroke = figmaPaintToStroke(
      paint,
      strokeWeight,
      strokeAlign,
    );
    if (stroke)
      strokes.push(stroke,);
  }

  /** Parent reference parsed from the Figma node, or null when unparented. */
  const parentIndex = parseParentIndex(
    nc.parentIndex as Record<string, unknown> | undefined | null,
  );
  /** Parent UUID actually used by this shape; starts at the recursion's `parentUuid` and is overridden when a real parent resolves through the GUID map. */
  let effectiveParentUuid = parentUuid;
  if (parentIndex) {
    /** Composite key matching the parent entry in `guidToUuidMap`. */
    const parentKey =
      `${parentIndex.parentGuid.sessionId}:${parentIndex.parentGuid.localId}`;
    effectiveParentUuid = guidToUuidMap.get(parentKey,) ?? parentUuid;
  }

  /** Frame ancestor UUID: this shape's own id when it is a frame, otherwise the enclosing frame from the recursion. */
  const effectiveFrameUuid = penpotType === 'frame' ? shapeUuid : frameUuid;

  /** Penpot shape record being assembled; mutated below to add type-specific fields before being stored in `shapes`. */
  const shape: PenpotShape = {
    id: shapeUuid,
    name: (typeof nc.name) === 'string' ? nc.name : 'Unnamed',
    type: penpotType,
    x: hasGeometry ? effectiveX : null,
    y: hasGeometry ? effectiveY : null,
    width: hasGeometry ? effectiveW : null,
    height: hasGeometry ? effectiveH : null,
    rotation: 0,
    selrect,
    points,
    transform: { ...IDENTITY_TRANSFORM, }, // Reset transform since position is in x/y
    transformInverse: { ...IDENTITY_TRANSFORM, },
    parentId: effectiveParentUuid,
    frameId: effectiveFrameUuid,
    flipX: null,
    flipY: null,
    proportion: 1,
    proportionLock: false,
    fills,
    strokes,
    pageId,
  };

  // Opacity
  if (((typeof nc.opacity) === 'number') && (nc.opacity !== 1))
    shape.opacity = nc.opacity;

  // Visible/hidden
  if (nc.visible === false)
    shape.hidden = true;

  // Type-specific fields
  if (penpotType === 'frame') {
    shape.hideFillOnExport = false;
    shape.showContent = true;
    shape.shapes = [];

    // Border radius
    if (((typeof nc.cornerRadius) === 'number') && (nc.cornerRadius > 0)) {
      shape.r1 = nc.cornerRadius;
      shape.r2 = nc.cornerRadius;
      shape.r3 = nc.cornerRadius;
      shape.r4 = nc.cornerRadius;
    }

    /** Canvas-background colour used as the frame's fill when the Figma node has no explicit fills of its own. */
    const bgColor = nc.backgroundColor as Record<string, unknown> | undefined;
    if (bgColor && (fills.length === 0))
      shape.fills = [figmaColorToFill(bgColor,),];
  }

  if (penpotType === 'group')
    shape.shapes = [];

  if (penpotType === 'bool') {
    shape.shapes = [];
    shape.boolType = 'union';
    /** Boolean operation geometry from Figma; its first path is taken as the shape's content. */
    const fillGeometry = (nc.fillGeometry ?? []) as Record<string, unknown>[];
    if ((fillGeometry.length > 0) && ((typeof fillGeometry[0]!.path) === 'string'))
      shape.content = fillGeometry[0]!.path;
  }

  if (penpotType === 'rect') {
    if (((typeof nc.cornerRadius) === 'number') && (nc.cornerRadius > 0)) {
      shape.r1 = nc.cornerRadius;
      shape.r2 = nc.cornerRadius;
      shape.r3 = nc.cornerRadius;
      shape.r4 = nc.cornerRadius;
    }
  }

  if (penpotType === 'path') {
    shape.growType = 'fixed';
    /** Path geometry from Figma; preferred source for the SVG-style `content` string. */
    const fillGeometry = (nc.fillGeometry ?? []) as Record<string, unknown>[];
    /** Stroke-only geometry used as a fallback when fillGeometry is absent (open paths, lines). */
    const strokeGeometry = (nc.strokeGeometry ?? []) as Record<string, unknown>[];
    if ((fillGeometry.length > 0) && ((typeof fillGeometry[0]!.path) === 'string'))
      shape.content = fillGeometry[0]!.path;
    else if ((strokeGeometry.length > 0)
      && ((typeof strokeGeometry[0]!.path) === 'string'))
    {
      shape.content = strokeGeometry[0]!.path;
    }
  }

  if (penpotType === 'text') {
    shape.growType = 'auto-width';
    shape.content = convertTextContent(nc,);
  }

  /** Direct GUID keys of this node's children, looked up from the prepass index. */
  const childKeys = childrenByParent.get(nodeKey,) ?? [];
  /** Penpot UUIDs collected from each child recursion to populate `shape.shapes` for container types. */
  const childUuids: Uuid[] = [];
  for (const childKey of childKeys) {
    /** Result UUID from converting one child; null when the child has no Penpot equivalent. */
    const childUuid = convertNode(
      childKey,
      nodeByGuid,
      childrenByParent,
      guidToUuidMap,
      shapeUuid,
      effectiveFrameUuid,
      pageId,
      shapes,
      media,
      figmaImages,
    );
    if (childUuid)
      childUuids.push(childUuid,);
  }

  if ((penpotType === 'frame') || (penpotType === 'group') || (penpotType === 'bool'))
    shape.shapes = childUuids;

  shapes.set(
    shapeUuid,
    shape,
  );
  return shapeUuid;
}

// endregion

// region Text conversion

/** Convert Figma text node data to Penpot text content tree. */
function convertTextContent(nc: Record<string, unknown>,): Record<string, unknown> {
  /** Numeric font size with a 16px fallback for nodes whose Figma data is incomplete. */
  const fontSize = (typeof nc.fontSize) === 'number' ? nc.fontSize : 16;
  /** Font family string with a sans-serif fallback so Penpot can resolve a real font. */
  const fontFamily = (typeof nc.fontName) === 'string' ? nc.fontName : 'Source Sans 3';
  /** Font weight stringified to match Penpot's text-attribute shape; defaults to "400" (regular). */
  const fontWeight = (typeof nc.fontWeight) === 'number' ? String(nc.fontWeight,) : '400';
  /** Raw character payload from the Figma text node; empty string when absent so the output stays well-formed. */
  const textContent = (typeof nc.characters) === 'string' ? nc.characters : '';
  /** Penpot font id corresponding to the chosen family; matches Penpot's bundled "sourcesanspro" entry. */
  const fontId = 'sourcesanspro';
  /** Variant id mirrors the weight string so each weight resolves to the right Penpot variant. */
  const fontVariantId = fontWeight;

  /** Text fills assembled from the node's paint list; defaulted to opaque black when none survive conversion. */
  const fills: PenpotFill[] = [];
  /** Raw paint list to convert into text fills. */
  const fillPaints = (nc.fillPaints ?? []) as Record<string, unknown>[];
  for (const paint of fillPaints) {
    /** Solid fill candidate; null means the paint type is unsupported. */
    const fill = figmaPaintToFill(paint,);
    if (fill)
      fills.push(fill,);
  }
  if (fills.length === 0) {
    fills.push({
      fillColor: '#000000',
      fillOpacity: 1,
    },);
  }

  /** Paragraph-level attribute block shared across the text run; defaults match Penpot's "plain" paragraph. */
  const paragraphAttrs = {
    lineHeight: '1.2',
    fontStyle: 'normal',
    textTransform: 'none',
    textAlign: 'left',
    fontId,
    fontSize: String(fontSize,),
    fontWeight,
    textDirection: 'ltr',
    type: 'paragraph',
    fontVariantId,
    textDecoration: 'none',
    letterSpacing: '0',
    fills,
    fontFamily,
  };

  return {
    type: 'root',
    children: [{
      type: 'paragraph-set',
      children: [{
        ...paragraphAttrs,
        children: [{
          text: textContent,
        },],
      },],
    },],
  };
}

// endregion

// region ZIP serialization

/**
 * Serialize a PenpotDocument to a ZIP buffer.
 *
 * Produces a valid .penpot file (binfile-v3 format) that can be
 * imported into Penpot.
 *
 * @param doc - Converted Penpot document
 *
 * @returns ZIP file as Uint8Array
 */
async function serializePenpotZip(doc: PenpotDocument,): Promise<Uint8Array> {
  /** ZipWriter that accumulates every JSON and binary entry; `build()` at the end produces the final `.penpot` archive bytes. */
  const zip = new ZipWriter();

  // manifest.json
  zip.add(
    'manifest.json',
    JSON.stringify(
      doc.manifest,
      null,
      2,
    ),
  );

  /** File UUID hoisted once so it can be spliced into every entry path below. */
  const fileId = doc.file.id;
  zip.add(
    `files/${fileId}.json`,
    JSON.stringify(
      doc.file,
      null,
      2,
    ),
  );

  // Pages
  for (const [, page,] of doc.pages) {
    /** Directory prefix for every entry belonging to this page (page JSON plus each shape JSON). */
    const pageDir = `files/${fileId}/pages/${page.id}`;
    zip.add(
      `${pageDir}.json`,
      JSON.stringify(
        page,
        null,
        2,
      ),
    );

    /** Well-known UUID for the root frame so the lookup below works for every page. */
    const rootFrameId = ZERO_UUID;
    /** Root-frame shape for this page; falsy when no shapes were ever registered. */
    const rootShape = doc.shapes.get(rootFrameId,);
    if (rootShape && (rootShape.pageId === page.id)) {
      /** Serialised root frame; written under the page directory before the page's other shapes. */
      const shapeJson = JSON.stringify(
        rootShape,
        null,
        2,
      );
      zip.add(
        `${pageDir}/${rootFrameId}.json`,
        shapeJson,
      );
    }

    // Shapes for this page
    for (const [shapeId, shape,] of doc.shapes) {
      if ((shape.pageId === page.id) && (shapeId !== rootFrameId)) {
        zip.add(
          `${pageDir}/${shapeId}.json`,
          JSON.stringify(
            shape,
            null,
            2,
          ),
        );
      }
    }
  }

  // Media objects
  for (const [mediaId, mediaObj,] of doc.media) {
    zip.add(
      `files/${fileId}/media/${mediaId}.json`,
      JSON
        .stringify(
          mediaObj,
          null,
          2,
        ),
    );
  }

  // Storage objects
  for (const [objectId, {
    meta,
    data,
  },] of doc.storageObjects) {
    zip.add(
      `objects/${objectId}.json`,
      JSON.stringify(
        meta,
        null,
        2,
      ),
    );
    /** Filename extension chosen from the object's MIME type so the binary entry has a recognisable name. */
    const ext = mtypeToExtension(meta.contentType,);
    zip.add(
      `objects/${objectId}${ext}`,
      data,
    );
  }

  // Components
  for (const [compId, compData,] of doc.components) {
    zip.add(
      `files/${fileId}/components/${compId}.json`,
      JSON
        .stringify(
          compData,
          null,
          2,
        ),
    );
  }

  // Colors
  for (const [colorId, colorData,] of doc.colors) {
    zip.add(
      `files/${fileId}/colors/${colorId}.json`,
      JSON
        .stringify(
          colorData,
          null,
          2,
        ),
    );
  }

  // Typographies
  for (const [typoId, typoData,] of doc.typographies) {
    zip.add(
      `files/${fileId}/typographies/${typoId}.json`,
      JSON
        .stringify(
          typoData,
          null,
          2,
        ),
    );
  }

  // Tokens
  if (doc.tokens) {
    zip.add(
      `files/${fileId}/tokens.json`,
      JSON.stringify(
        doc.tokens,
        null,
        2,
      ),
    );
  }

  // Thumbnails
  for (const thumb of doc.thumbnails) {
    zip.add(
      thumb.path,
      JSON.stringify(
        thumb.data,
        null,
        2,
      ),
    );
  }

  return zip.build();
}

/** Map MIME type to file extension. */
function mtypeToExtension(mtype: string,): string {
  /** Static MIME-type to extension lookup; entries cover the formats Penpot stores in `objects/`. */
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'font/woff': '.woff',
    'font/woff2': '.woff2',
    'font/ttf': '.ttf',
    'font/otf': '.otf',
  };
  return map[mtype] ?? '.bin';
}

// endregion

// region Top-level API

/**
 * Convert a parsed Figma file to a Penpot export file.
 *
 * Takes an already-decoded FigmaFile (from `parseFigmaFile`),
 * converts the node tree to Penpot's JSON model, and writes a .penpot ZIP.
 *
 * @param figmaFile - Decoded Figma file from `parseFigmaFile`
 *
 * @param outputPath - Path to write the .penpot file, or null to return buffer
 *
 * @param options - Conversion options
 *
 * @returns ZIP buffer
 */
async function figmaToPenpot(
  figmaFile: FigmaFile,
  outputPath: string | null = null,
  options: ConvertOptions = {},
): Promise<Uint8Array> {
  /** Intermediate Penpot document model assembled before serialization; held so the same data could be inspected by callers in future. */
  const doc = convertFigmaToPenpot(
    figmaFile,
    options,
  );
  /** Final ZIP buffer returned to the caller and optionally written to disk below. */
  const zipBuffer = await serializePenpotZip(doc,);

  if (outputPath) {
    /** Lazy `node:fs/promises` import so the converter still works in non-Node environments when no output path is given. */
    const { writeFile, } = await import('node:fs/promises');
    await writeFile(
      outputPath,
      zipBuffer,
    );
  }

  return zipBuffer;
}

// endregion

// region Exports

export {
  convertFigmaToPenpot,
  type ConvertOptions,
  figmaColorToHex,
  figmaToPenpot,
  type PenpotDocument,
  type PenpotFile,
  type PenpotFill,
  type PenpotManifest,
  type PenpotMedia,
  type PenpotPage,
  type PenpotSelRect,
  type PenpotShape,
  type PenpotShapeType,
  type PenpotStorageObject,
  type PenpotStroke,
  type PenpotTransform,
  serializePenpotZip,
};

// endregion
