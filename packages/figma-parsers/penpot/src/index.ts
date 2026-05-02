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
    data: Uint8Array
  }>;
  components: Map<Uuid, Record<string, unknown>>;
  colors: Map<Uuid, Record<string, unknown>>;
  typographies: Map<Uuid, Record<string, unknown>>;
  tokens: Record<string, unknown> | null;
  thumbnails: {
    path: string;
    data: Record<string, unknown>
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

const IDENTITY_TRANSFORM: PenpotTransform = {
  a: 1.0,
  b: 0.0,
  c: 0.0,
  d: 1.0,
  e: 0.0,
  f: 0.0,
};

const DEFAULT_FEATURES = [
  'fdata/path-data',
  'design-tokens/v1',
  'variants/v1',
  'layout/grid',
  'components/v2',
  'fdata/shape-data-type',
];

const PENPOT_FILE_VERSION = 67;

const ZERO_UUID: Uuid = '00000000-0000-0000-0000-000000000000';

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

let uuidCounter = 0;

/** Generate a unique UUID v4. */
function nextUuid(): Uuid {
  uuidCounter += 1;
  // Use crypto.randomUUID when available, fallback to counter-based
  try {
    return crypto.randomUUID();
  }
  catch {
    // Fallback: counter-based pseudo-UUID
    const c = uuidCounter;
    function h(
      n: number,
      w: number,
    ) {
      return (n >>> 0).toString(16,).padStart(
        w,
        '0',
      );
    }
    const a = h(
      c & 0xFFFFFFFF,
      8,
    );
    const b = h(
      (c >> 32) & 0xff_ff,
      4,
    );
    return `${a}-${b}-4${
      h(
        c & 0xFFF,
        3,
      )
        .slice(-3,)
    }-8${
      h(
        c & 0xFFF,
        3,
      )
        .slice(-3,)
    }-${
      h(
        c & 0xFFFF,
        4,
      )
    }${
      h(
        (c >> 4) & 0xFFFF,
        4,
      )
    }${
      h(
        (c >> 8) & 0xFFFF,
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
  const sid = typeof sessionId === 'number' ? sessionId : 0;
  const lid = typeof localId === 'number' ? localId : 0;
  // Deterministic UUID v4 from Figma GUID
  function h(
    n: number,
    w: number,
  ) {
    return (n >>> 0).toString(16,).padStart(
      w,
      '0',
    );
  }
  const a = h(
    sid,
    8,
  );
  const b = h(
    (lid >>> 16) & 0xff_ff,
    4,
  );
  const c = `4${
    h(
      (lid >>> 4) & 0xf_ff,
      3,
    )
  }`;
  const yNibble = ((lid & 0xF) | 0x8).toString(16,);
  const d = `${yNibble}${
    h(
      (sid >>> 16) & 0xFFF,
      3,
    )
  }`;
  const e = `${
    h(
      sid & 0xFFFF,
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
  const r = Math.round((typeof color.r === 'number' ? color.r : 0) * 255,);
  const g = Math.round((typeof color.g === 'number' ? color.g : 0) * 255,);
  const b = Math.round((typeof color.b === 'number' ? color.b : 0) * 255,);
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
    fillOpacity: typeof color.a === 'number' ? color.a : 1,
  };
}

// endregion

// region Figma paint -> Penpot fill/stroke

/** Figma PaintType to Penpot fill. */
function figmaPaintToFill(paint: Record<string, unknown>,): PenpotFill | null {
  // paint.type is the enum value like "PaintType.SOLID"
  // paint.__type is just the schema type name "Paint"
  const paintType = String(paint.type ?? paint.__type ?? '',);
  if (paintType === 'PaintType.SOLID' || paintType.includes('SOLID',)) {
    const color = paint.color as Record<string, unknown> | undefined;
    if (!color)
      return null;
    const fill = figmaColorToFill(color,);
    if (typeof paint.opacity === 'number')
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
  const paintType = String(paint.type ?? paint.__type ?? '',);
  if (paintType === 'PaintType.SOLID' || paintType.includes('SOLID',)) {
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
      strokeOpacity: typeof paint.opacity === 'number' ? paint.opacity : 1,
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
  const x2 = x + width;
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
    a: typeof transform.m00 === 'number' ? transform.m00 : 1,
    b: typeof transform.m10 === 'number' ? transform.m10 : 0,
    c: typeof transform.m01 === 'number' ? transform.m01 : 0,
    d: typeof transform.m11 === 'number' ? transform.m11 : 1,
    e: typeof transform.m02 === 'number' ? transform.m02 : 0,
    f: typeof transform.m12 === 'number' ? transform.m12 : 0,
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
  const guid = parentIndex.guid as Record<string, unknown> | undefined;
  if (!guid)
    return null;
  return {
    parentGuid: {
      sessionId: typeof guid.sessionID === 'number' ? guid.sessionID : 0,
      localId: typeof guid.localID === 'number' ? guid.localID : 0,
    },
    position: typeof parentIndex.position === 'string' ? parentIndex.position : '',
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
  const fileId = nextUuid();
  const fileName = options.fileName ?? figmaFile.meta.fileName ?? 'Untitled';
  const now = new Date().toISOString();

  // Build a map from Figma GUID -> UUID
  const figmaGuidToUuid = new Map<string, Uuid>();
  const nodeChanges = (figmaFile.document?.nodeChanges ?? []) as Record<string,
    unknown>[];

  // First pass: assign UUIDs to all nodes
  for (const nc of nodeChanges) {
    const guid = nc.guid as Record<string, unknown> | undefined;
    if (guid) {
      const sid = typeof guid.sessionID === 'number' ? guid.sessionID : 0;
      const lid = typeof guid.localID === 'number' ? guid.localID : 0;
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

  // Create the root frame for each page
  const pages = new Map<Uuid, PenpotPage>();
  const shapes = new Map<Uuid, PenpotShape>();
  const media = new Map<Uuid, PenpotMedia>();
  const storageObjects = new Map<Uuid, {
    meta: PenpotStorageObject;
    data: Uint8Array;
  }>();
  const components = new Map<Uuid, Record<string, unknown>>();
  const colors = new Map<Uuid, Record<string, unknown>>();
  const typographies = new Map<Uuid, Record<string, unknown>>();
  const thumbnails: {
    path: string;
    data: Record<string, unknown>;
  }[] = [];

  // Group nodes by parent to build tree
  const nodeByGuid = new Map<string, Record<string, unknown>>();
  const childrenByParent = new Map<string, string[]>();
  const pageRootIds: Uuid[] = [];

  for (const nc of nodeChanges) {
    const guid = nc.guid as Record<string, unknown> | undefined;
    if (!guid)
      continue;
    const sid = typeof guid.sessionID === 'number' ? guid.sessionID : 0;
    const lid = typeof guid.localID === 'number' ? guid.localID : 0;
    const key = `${sid}:${lid}`;
    nodeByGuid.set(
      key,
      nc,
    );

    // Track parent-child relationships
    const parentIndex = parseParentIndex(
      nc.parentIndex as Record<string, unknown> | undefined | null,
    );
    if (parentIndex) {
      const parentKey =
        `${parentIndex.parentGuid.sessionId}:${parentIndex.parentGuid.localId}`;
      const children = childrenByParent.get(parentKey,) ?? [];
      children.push(key,);
      childrenByParent.set(
        parentKey,
        children,
      );
    }
  }

  // Determine page source based on file type
  // - .fig: each CANVAS node becomes a Penpot page
  // - .deck: each SLIDE node becomes a Penpot page (CANVAS is just a container)
  // - .jam: each CANVAS node becomes a Penpot page (same as .fig)
  const isDeck = figmaFile.fileType === 'deck';

  // Collect the nodes that will become pages
  const pageSourceNodes: {
    key: string;
    nc: Record<string, unknown>;
  }[] = [];
  if (isDeck) {
    // For decks, find all SLIDE nodes — each becomes a page
    for (const nc of nodeChanges) {
      const nodeType = String(nc.type ?? '',);
      if (nodeType === 'NodeType.SLIDE') {
        const guid = nc.guid as Record<string, unknown>;
        const sid = typeof guid.sessionID === 'number' ? guid.sessionID : 0;
        const lid = typeof guid.localID === 'number' ? guid.localID : 0;
        pageSourceNodes.push({
          key: `${sid}:${lid}`,
          nc,
        },);
      }
    }
  }
  else {
    // For fig/jam, find all CANVAS nodes — each becomes a page
    for (const nc of nodeChanges) {
      const nodeType = String(nc.type ?? '',);
      if (nodeType === 'NodeType.CANVAS') {
        // Skip "Internal Only Canvas" — it's a Figma internal canvas
        const name = String(nc.name ?? '',);
        const internalOnly = nc.internalOnly === true || nc.editInfo != null;
        if (internalOnly && name.toLowerCase().includes('internal',))
          continue;

        const guid = nc.guid as Record<string, unknown>;
        const sid = typeof guid.sessionID === 'number' ? guid.sessionID : 0;
        const lid = typeof guid.localID === 'number' ? guid.localID : 0;
        pageSourceNodes.push({
          key: `${sid}:${lid}`,
          nc,
        },);
      }
    }
  }

  // Create pages from the source nodes
  let pageIndex = 0;
  for (const {
    key: sourceKey,
    nc,
  } of pageSourceNodes) {
    const pageId = nextUuid();
    const rootFrameId = ZERO_UUID;

    // Create page
    const pageName = typeof nc.name === 'string' ? nc.name : `Page ${pageIndex + 1}`;
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

    // Create root frame for page
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

    // Recursively convert children of this page source
    // For fig/jam: sourceKey points to the CANVAS, children go directly into root frame
    // For deck: sourceKey points to the SLIDE, children go directly into root frame
    const childKeys = childrenByParent.get(sourceKey,) ?? [];
    const childUuids: Uuid[] = [];

    for (const childKey of childKeys) {
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
    const pageId = nextUuid();
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

  // Build file metadata
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
  const nc = nodeByGuid.get(nodeKey,);
  if (!nc)
    return null;

  const nodeType = String(nc.type ?? '',);
  const penpotType = FIGMA_NODE_TYPE_MAP[nodeType];

  // Skip nodes with no Penpot equivalent (DOCUMENT, NONE, etc.)
  if (penpotType === null || penpotType === undefined)
    return null;

  const shapeUuid = guidToUuidMap.get(nodeKey,) ?? nextUuid();

  // Extract geometry
  const transform = figmaTransformToPenpot(
    nc.transform as Record<string, unknown> | undefined,
  );
  const size = nc.size as Record<string, unknown> | undefined;
  const x = typeof transform.e === 'number' ? transform.e : 0;
  const y = typeof transform.f === 'number' ? transform.f : 0;
  const width = size && typeof size.x === 'number' ? size.x : 0;
  const height = size && typeof size.y === 'number' ? size.y : 0;

  // For path/vector nodes, use selrect from actual bounds
  const hasGeometry = width > 0 && height > 0;
  const effectiveX = hasGeometry ? x : 0;
  const effectiveY = hasGeometry ? y : 0;
  const effectiveW = hasGeometry ? width : 0;
  const effectiveH = hasGeometry ? height : 0;

  // Build selrect and points
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

  // Extract fills from fillPaints
  const fillPaints = (nc.fillPaints ?? []) as Record<string, unknown>[];
  const fills: PenpotFill[] = [];
  for (const paint of fillPaints) {
    const fill = figmaPaintToFill(paint,);
    if (fill)
      fills.push(fill,);
  }

  // Extract strokes from strokePaints
  const strokePaints = (nc.strokePaints ?? []) as Record<string, unknown>[];
  const strokeWeight = typeof nc.strokeWeight === 'number' ? nc.strokeWeight : 0;
  const strokeAlign = String(nc.strokeAlign ?? 'CENTER',);
  const strokes: PenpotStroke[] = [];
  for (const paint of strokePaints) {
    const stroke = figmaPaintToStroke(
      paint,
      strokeWeight,
      strokeAlign,
    );
    if (stroke)
      strokes.push(stroke,);
  }

  // Determine parent: find parent UUID from ParentIndex
  const parentIndex = parseParentIndex(
    nc.parentIndex as Record<string, unknown> | undefined | null,
  );
  let effectiveParentUuid = parentUuid;
  if (parentIndex) {
    const parentKey =
      `${parentIndex.parentGuid.sessionId}:${parentIndex.parentGuid.localId}`;
    effectiveParentUuid = guidToUuidMap.get(parentKey,) ?? parentUuid;
  }

  // The frame UUID is the nearest ancestor frame (or self if frame)
  const effectiveFrameUuid = penpotType === 'frame' ? shapeUuid : frameUuid;

  // Build base shape
  const shape: PenpotShape = {
    id: shapeUuid,
    name: typeof nc.name === 'string' ? nc.name : 'Unnamed',
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
  if (typeof nc.opacity === 'number' && nc.opacity !== 1)
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
    if (typeof nc.cornerRadius === 'number' && nc.cornerRadius > 0) {
      shape.r1 = nc.cornerRadius;
      shape.r2 = nc.cornerRadius;
      shape.r3 = nc.cornerRadius;
      shape.r4 = nc.cornerRadius;
    }

    // Background color (for canvas nodes)
    const bgColor = nc.backgroundColor as Record<string, unknown> | undefined;
    if (bgColor && fills.length === 0)
      shape.fills = [figmaColorToFill(bgColor,),];
  }

  if (penpotType === 'group')
    shape.shapes = [];

  if (penpotType === 'bool') {
    shape.shapes = [];
    shape.boolType = 'union';
    // Boolean operations in Figma have fillGeometry/strokeGeometry
    const fillGeometry = (nc.fillGeometry ?? []) as Record<string, unknown>[];
    if (fillGeometry.length > 0 && typeof fillGeometry[0]!.path === 'string')
      shape.content = fillGeometry[0]!.path;
  }

  if (penpotType === 'rect') {
    if (typeof nc.cornerRadius === 'number' && nc.cornerRadius > 0) {
      shape.r1 = nc.cornerRadius;
      shape.r2 = nc.cornerRadius;
      shape.r3 = nc.cornerRadius;
      shape.r4 = nc.cornerRadius;
    }
  }

  if (penpotType === 'path') {
    shape.growType = 'fixed';
    // Use fillGeometry for path data
    const fillGeometry = (nc.fillGeometry ?? []) as Record<string, unknown>[];
    const strokeGeometry = (nc.strokeGeometry ?? []) as Record<string, unknown>[];
    if (fillGeometry.length > 0 && typeof fillGeometry[0]!.path === 'string')
      shape.content = fillGeometry[0]!.path;
    else if (strokeGeometry.length > 0 && typeof strokeGeometry[0]!.path === 'string')
      shape.content = strokeGeometry[0]!.path;
  }

  if (penpotType === 'text') {
    shape.growType = 'auto-width';
    shape.content = convertTextContent(nc,);
  }

  // Recurse into children
  const childKeys = childrenByParent.get(nodeKey,) ?? [];
  const childUuids: Uuid[] = [];
  for (const childKey of childKeys) {
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

  if (penpotType === 'frame' || penpotType === 'group' || penpotType === 'bool')
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
  // Build a minimal Penpot text content tree from Figma text data
  const fontSize = typeof nc.fontSize === 'number' ? nc.fontSize : 16;
  const fontFamily = typeof nc.fontName === 'string' ? nc.fontName : 'Source Sans 3';
  const fontWeight = typeof nc.fontWeight === 'number' ? String(nc.fontWeight,) : '400';
  const textContent = typeof nc.characters === 'string' ? nc.characters : '';
  const fontId = 'sourcesanspro';
  const fontVariantId = fontWeight;

  // Build fills from the node's fills (already converted)
  const fills: PenpotFill[] = [];
  const fillPaints = (nc.fillPaints ?? []) as Record<string, unknown>[];
  for (const paint of fillPaints) {
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
  const { default: JSZip, } = await import('jszip');
  const zip = new JSZip();

  // manifest.json
  zip.file(
    'manifest.json',
    JSON.stringify(
      doc.manifest,
      null,
      2,
    ),
  );

  // File metadata
  const fileId = doc.file.id;
  zip.file(
    `files/${fileId}.json`,
    JSON.stringify(
      doc.file,
      null,
      2,
    ),
  );

  // Pages
  for (const [, page,] of doc.pages) {
    const pageDir = `files/${fileId}/pages/${page.id}`;
    zip.file(
      `${pageDir}.json`,
      JSON.stringify(
        page,
        null,
        2,
      ),
    );

    // Root frame (always UUID zero)
    const rootFrameId = ZERO_UUID;
    const rootShape = doc.shapes.get(rootFrameId,);
    if (rootShape && rootShape.pageId === page.id) {
      const shapeJson = JSON.stringify(
        rootShape,
        null,
        2,
      );
      zip.file(
        `${pageDir}/${rootFrameId}.json`,
        shapeJson,
      );
    }

    // Shapes for this page
    for (const [shapeId, shape,] of doc.shapes) {
      if (shape.pageId === page.id && shapeId !== rootFrameId) {
        zip.file(
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
    zip.file(
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
    zip.file(
      `objects/${objectId}.json`,
      JSON.stringify(
        meta,
        null,
        2,
      ),
    );
    const ext = mtypeToExtension(meta.contentType,);
    zip.file(
      `objects/${objectId}${ext}`,
      data,
    );
  }

  // Components
  for (const [compId, compData,] of doc.components) {
    zip.file(
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
    zip.file(
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
    zip.file(
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
    zip.file(
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
    zip.file(
      thumb.path,
      JSON.stringify(
        thumb.data,
        null,
        2,
      ),
    );
  }

  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', },),);
}

/** Map MIME type to file extension. */
function mtypeToExtension(mtype: string,): string {
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
  const doc = convertFigmaToPenpot(
    figmaFile,
    options,
  );
  const zipBuffer = await serializePenpotZip(doc,);

  if (outputPath) {
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
