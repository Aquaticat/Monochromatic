/**
 * Figma Kiwi binary format parser.
 *
 * Decodes Figma's exported binary files (.fig, .deck, .jam) which use
 * the Kiwi serialization format (github.com/evanw/kiwi). The file
 * structure is:
 *
 * 1. Outer container: ZIP archive containing canvas.fig, meta.json,
 *    thumbnail.png, and an images/ directory
 * 2. canvas.fig: Binary blob with header + deflate-compressed schema
 *    + zstd-compressed document data
 * 3. Schema section: Kiwi binary schema defining all enums and structs
 * 4. Document section: Kiwi-encoded data following the schema
 *
 * @module figma-kiwi
 */

// region Schema types

/** Kiwi primitive type names, indexed by their inverted type code. */
const KIWI_PRIMITIVES = [
  'bool',
  'byte',
  'int',
  'uint',
  'float',
  'string',
  'int64',
  'uint64',
] as const;

/** Kiwi primitive type name union. */
type KiwiPrimitiveName = (typeof KIWI_PRIMITIVES)[number];

/** Kind of type definition in a Kiwi schema. */
type KiwiDefinitionKind = 'ENUM' | 'STRUCT' | 'MESSAGE';

/** An enum definition in the Kiwi schema. */
type KiwiEnumField = {
  name: string;
  type: never;
  isArray: boolean;
  value: number;
};

/** A field within a struct or message definition. */
type KiwiStructField = {
  name: string;
  type: number;
  isArray: boolean;
  value: number;
};

/** An enum definition. */
type KiwiEnum = {
  kind: 'ENUM';
  name: string;
  fields: KiwiEnumField[];
};

/** A struct or message definition. */
type KiwiStruct = {
  kind: 'STRUCT' | 'MESSAGE';
  name: string;
  fields: KiwiStructField[];
};

/** A type definition in the Kiwi schema. */
type KiwiDefinition = KiwiEnum | KiwiStruct;

/** A fully parsed Kiwi schema. */
type KiwiSchema = {
  definitions: KiwiDefinition[];
  enumByName: Map<string, KiwiEnum>;
  structByName: Map<string, KiwiStruct>;
};

// endregion

// region Binary reader

/**
 * Reads varints, null-terminated strings, varfloats, and fixed-width
 * values from a Uint8Array. Tracks position and bounds for safe access.
 *
 * Follows the Kiwi binary format conventions from evanw/kiwi:
 * - VarUint: LEB128 unsigned varint
 * - VarInt: Zigzag-encoded signed varint
 * - VarFloat: Custom 1-or-4-byte float32 encoding
 * - String: Null-terminated UTF-8
 */
class BinaryReader {
  data: Uint8Array;
  pos: number;

  constructor(
    data: Uint8Array,
    pos = 0,
  ) {
    this.data = data;
    this.pos = pos;
  }

  /** Whether the reader has consumed all bytes. */
  get eof(): boolean {
    return this.pos >= this.data.length;
  }

  /** Number of remaining bytes. */
  get remaining(): number {
    return this.data.length - this.pos;
  }

  /**
   * Read a LEB128 unsigned varint (VarUint in Kiwi).
   *
   * Each byte contributes 7 bits of payload; the MSB signals
   * continuation.
   */
  readVarUint(): number {
    let result = 0;
    let shift = 0;
    while (this.pos < this.data.length) {
      const byte = this.data[this.pos]!;
      this.pos += 1;
      result |= (byte & 0x7F) << shift;
      shift += 7;
      if ((byte & 0x80) === 0)
        break;
    }
    return result >>> 0;
  }

  /**
   * Read a zigzag-encoded signed varint (VarInt in Kiwi).
   *
   * Maps unsigned varint to signed: even values map to positive,
   * odd values map to negative.
   */
  readVarInt(): number {
    const raw = this.readVarUint();
    if (raw & 1)
      return ~(raw >>> 1);
    return raw >>> 1;
  }

  /**
   * Read a Kiwi VarFloat.
   *
   * Custom encoding that stores 0.0 in a single byte and all other
   * float32 values in 4 bytes with a bit rotation that moves the
   * exponent to the first byte.
   *
   * - If first byte is 0x00: value is 0.0 (1 byte consumed)
   * - Otherwise: 4 bytes, little-endian. Rotate bits:
   *   `bits = (bits << 23) | (bits >>> 9)`, then reinterpret as
   *   IEEE 754 float32.
   */
  readVarFloat(): number {
    const first = this.data[this.pos]!;
    if (first === 0) {
      this.pos += 1;
      return 0;
    }

    // Read 4 bytes as little-endian uint32
    const b0 = this.data[this.pos]!;
    const b1 = this.data[this.pos + 1]!;
    const b2 = this.data[this.pos + 2]!;
    const b3 = this.data[this.pos + 3]!;
    this.pos += 4;

    // Rotate bits: move exponent from first byte back to correct position
    const rawBits = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    const bits = ((rawBits << 23) | (rawBits >>> 9)) >>> 0;

    // Reinterpret as float32
    const view = new DataView(new ArrayBuffer(4,),);
    view.setUint32(
      0,
      bits,
      true,
    );
    return view.getFloat32(
      0,
      true,
    );
  }

  /**
   * Read a null-terminated UTF-8 string.
   *
   * Scans forward until a 0x00 byte is found. The null byte is
   * consumed but not included in the result.
   */
  readString(): string {
    let end = this.pos;
    while (end < this.data.length && this.data[end] !== 0)
      end += 1;
    const s = new TextDecoder('utf-8',).decode(this.data.subarray(
      this.pos,
      end,
    ),);
    this.pos = end + 1;
    return s;
  }

  /** Read a single byte. */
  readByte(): number {
    return this.data[this.pos++]!;
  }

  /** Read a little-endian uint32. */
  readUint32LE(): number {
    const view = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.pos,
      4,
    );
    this.pos += 4;
    return view.getUint32(
      0,
      true,
    );
  }

  /** Read a fixed number of raw bytes. */
  readBytes(count: number,): Uint8Array {
    const result = this.data.subarray(
      this.pos,
      this.pos + count,
    );
    this.pos += count;
    return result;
  }
}

// endregion

// region Schema parser

/**
 * Resolve a type code from the schema to a human-readable name.
 *
 * Negative type codes reference primitives via `~typeCode` index.
 * Non-negative type codes reference schema definitions by index.
 *
 * @param typeCode - Type varint from a field definition
 *
 * @param schema - Parsed schema for resolving references
 *
 * @returns Human-readable type name
 */
function resolveTypeName(
  typeCode: number,
  schema: KiwiSchema,
): string {
  if (typeCode < 0) {
    const primIdx = ~typeCode;
    return primIdx < KIWI_PRIMITIVES.length
      ? KIWI_PRIMITIVES[primIdx]!
      : `prim[${primIdx}]`;
  }
  if (typeCode < schema.definitions.length)
    return schema.definitions[typeCode]!.name;
  return `ref[${typeCode}]`;
}

/**
 * Parse a Kiwi binary schema from raw decompressed bytes.
 *
 * The schema format (matching stock Kiwi from evanw/kiwi):
 *
 * ```
 * definitionCount (varuint)
 * for each definition:
 *   name\0
 *   kind (byte: 0=ENUM, 1=STRUCT, 2=MESSAGE)
 *   fieldCount (varuint)
 *   for each field:
 *     fieldName\0
 *     type (varint, zigzag: negative=primitive, non-negative=def index)
 *     isArray (byte, bit 0)
 *     value (varuint: tag for struct/message fields, enum value for enums)
 * ```
 *
 * @param data - Raw decompressed schema bytes
 *
 * @returns Parsed schema with all definitions
 */
function parseKiwiSchema(data: Uint8Array,): KiwiSchema {
  const reader = new BinaryReader(data,);

  const definitionCount = reader.readVarUint();
  const definitions: KiwiDefinition[] = [];
  const enumByName = new Map<string, KiwiEnum>();
  const structByName = new Map<string, KiwiStruct>();

  for (let i = 0; i < definitionCount; i++) {
    const name = reader.readString();
    const kindByte = reader.readByte();
    const fieldCount = reader.readVarUint();

    const kindNames: KiwiDefinitionKind[] = [
      'ENUM',
      'STRUCT',
      'MESSAGE',
    ];
    const kind = kindNames[kindByte];
    if (!kind) {
      throw new Error(
        `Unknown Kiwi definition kind ${kindByte} for "${name}" at offset ${reader.pos}`,
      );
    }

    if (kind === 'ENUM') {
      const fields: KiwiEnumField[] = [];
      for (let j = 0; j < fieldCount; j++) {
        const fieldName = reader.readString();
        // Enum fields have type=null; in Figma's schema this is varint(0)
        reader.readVarInt(); // type (unused for enums)
        reader.readByte(); // isArray (unused for enums)
        const value = reader.readVarUint();
        fields.push({
          name: fieldName,
          type: null as never,
          isArray: false,
          value,
        },);
      }
      const def: KiwiEnum = {
        kind: 'ENUM',
        name,
        fields,
      };
      definitions.push(def,);
      enumByName.set(
        name,
        def,
      );
    }
    else {
      const fields: KiwiStructField[] = [];
      for (let j = 0; j < fieldCount; j++) {
        const fieldName = reader.readString();
        const fieldType = reader.readVarInt();
        const isArray = (reader.readByte() & 1) === 1;
        const value = reader.readVarUint();
        fields.push({
          name: fieldName,
          type: fieldType,
          isArray,
          value,
        },);
      }
      const def: KiwiStruct = {
        kind: kind as 'STRUCT' | 'MESSAGE',
        name,
        fields,
      };
      definitions.push(def,);
      structByName.set(
        name,
        def,
      );
    }
  }

  return {
    definitions,
    enumByName,
    structByName,
  };
}

// endregion

// region Document decoder

/**
 * Decoded Kiwi value types.
 *
 * Primitives decode to their JS equivalents. Enums decode to
 * `"EnumName.VALUE"` strings. Structs and messages decode to
 * plain objects with `__type` metadata.
 */
type KiwiDecodedValue =
  | boolean
  | number
  | string
  | Uint8Array
  | KiwiDecodedValue[]
  | Record<string, unknown>
  | null;

/**
 * Decode a single value from a binary reader given its type code.
 *
 * @param reader - Binary reader positioned at the value
 *
 * @param schema - Parsed schema for resolving type references
 *
 * @param typeCode - Type varint from the field definition
 *
 * @param depth - Recursion depth limit
 *
 * @returns Decoded JavaScript value
 */
function decodeValue(
  reader: BinaryReader,
  schema: KiwiSchema,
  typeCode: number,
  depth: number,
): KiwiDecodedValue {
  if (depth > 20)
    return null;

  // Primitive type
  if (typeCode < 0) {
    const primIdx = ~typeCode;
    switch (primIdx) {
      case 0: // bool
        return reader.readByte() !== 0;
      case 1: // byte
        return reader.readByte();
      case 2: // int (zigzag varint)
        return reader.readVarInt();
      case 3: // uint
        return reader.readVarUint();
      case 4: // float (varfloat)
        return reader.readVarFloat();
      case 5: // string
        return reader.readString();
      case 6: // int64
        return reader.readVarInt();
      case 7: // uint64
        return reader.readVarUint();
      default:
        return null;
    }
  }

  // Schema definition reference
  if (typeCode >= schema.definitions.length)
    return null;
  const def = schema.definitions[typeCode]!;

  if (def.kind === 'ENUM') {
    const value = reader.readVarUint();
    const enumField = def.fields.find(f => f.value === value);
    return enumField ? `${def.name}.${enumField.name}` : `${def.name}(${value})`;
  }

  if (def.kind === 'STRUCT') {
    return decodeStruct(
      reader,
      schema,
      def,
      depth + 1,
    );
  }

  // MESSAGE
  return decodeMessage(
    reader,
    schema,
    def,
    depth + 1,
  );
}

/**
 * Decode a Kiwi STRUCT from a binary reader.
 *
 * Structs have all fields present in order without tags or
 * terminators. Each field value is read sequentially.
 *
 * @param reader - Binary reader positioned at the struct start
 *
 * @param schema - Parsed schema
 *
 * @param def - Struct definition
 *
 * @param depth - Recursion depth
 *
 * @returns Decoded struct as a plain object
 */
function decodeStruct(
  reader: BinaryReader,
  schema: KiwiSchema,
  def: KiwiStruct,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = { __type: def.name, };

  for (const field of def.fields) {
    if (reader.eof) {
      result[field.name] = null;
      continue;
    }

    if (field.isArray) {
      const count = reader.readVarUint();
      const items: KiwiDecodedValue[] = [];
      for (let i = 0; i < count; i++) {
        items.push(decodeValue(
          reader,
          schema,
          field.type,
          depth,
        ),);
      }
      result[field.name] = items;
    }
    else {
      result[field.name] = decodeValue(
        reader,
        schema,
        field.type,
        depth,
      );
    }
  }

  return result;
}

/**
 * Decode a Kiwi MESSAGE from a binary reader.
 *
 * Messages have optional tagged fields. Each field is prefixed by
 * its tag (varuint). A tag of 0 terminates the message. Only present
 * fields are encoded; absent fields default to their type's zero value.
 *
 * @param reader - Binary reader positioned at the message start
 *
 * @param schema - Parsed schema
 *
 * @param def - Message definition
 *
 * @param depth - Recursion depth
 *
 * @returns Decoded message as a plain object
 */
function decodeMessage(
  reader: BinaryReader,
  schema: KiwiSchema,
  def: KiwiStruct,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = { __type: def.name, };

  // Build tag -> field lookup
  const fieldByTag = new Map<number, KiwiStructField>();
  for (const field of def.fields) {
    fieldByTag.set(
      field.value,
      field,
    );
  }

  while (!reader.eof) {
    const tag = reader.readVarUint();
    if (tag === 0)
      break;

    const field = fieldByTag.get(tag,);
    if (field) {
      if (field.isArray) {
        const count = reader.readVarUint();
        const items: KiwiDecodedValue[] = [];
        for (let i = 0; i < count; i++) {
          items.push(decodeValue(
            reader,
            schema,
            field.type,
            depth,
          ),);
        }
        result[field.name] = items;
      }
      else {
        result[field.name] = decodeValue(
          reader,
          schema,
          field.type,
          depth,
        );
      }
    }
    else {
      // Unknown tag: cannot skip without knowing the type.
      // Since we have the full schema, this should not happen.
      break;
    }
  }

  return result;
}

/**
 * Decode the document data section of a Figma file.
 *
 * The document data is a Kiwi-encoded Message struct containing
 * node changes that represent the complete scene graph.
 *
 * @param documentData - Raw decompressed document bytes
 *
 * @param schema - Parsed Kiwi schema
 *
 * @returns Decoded document as a plain object
 */
function decodeDocument(
  documentData: Uint8Array,
  schema: KiwiSchema,
): Record<string, unknown> | null {
  if (documentData.length === 0)
    return null;

  const reader = new BinaryReader(documentData,);
  const messageDef = schema.structByName.get('Message',);
  if (!messageDef)
    throw new Error('Message definition not found in schema',);

  return decodeMessage(
    reader,
    schema,
    messageDef,
    0,
  );
}

// endregion

// region File format constants

/**
 * Magic bytes at the start of canvas.fig for each Figma file type.
 */
const CANVAS_FIG_MAGIC = {
  fig: 'fig-kiwie',
  deck: 'fig-decke',
  jam: 'fig-jam.e',
} as const;

/** Set of valid magic byte strings. */
const VALID_MAGICS = new Set<string>(Object.values(CANVAS_FIG_MAGIC,),);

/** Byte offset where the deflate-compressed schema starts in canvas.fig. */
const CANVAS_HEADER_SIZE = 16;

// endregion

// region File format types

/** The type of Figma file, determined by the canvas.fig magic bytes. */
type FigmaFileType = 'fig' | 'deck' | 'jam';

/** Metadata extracted from meta.json inside the ZIP archive. */
type FigmaMeta = {
  backgroundColor: {
    r: number;
    g: number;
    b: number;
    a: number
  };
  thumbnailSize: {
    width: number;
    height: number
  };
  renderCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number
  };
  fileName: string;
  exportedAt: string;
  developerRelatedLinks: unknown[];
};

/** A fully decoded Figma file with all its components. */
type FigmaFile = {
  fileType: FigmaFileType;
  meta: FigmaMeta;
  thumbnail: Uint8Array;
  schema: KiwiSchema;
  document: Record<string, unknown> | null;
  images: Map<string, Uint8Array>;
};

// endregion

// region Canvas.fig header parsing

/**
 * Parse the 16-byte header of a canvas.fig binary blob.
 *
 * Layout:
 *   bytes 0-9:   null-terminated magic string
 *   bytes 10-15: reserved (zeros in known files)
 *
 * @param data - Raw canvas.fig bytes (at least 16)
 *
 * @returns File type and reserved bytes
 */
function parseCanvasHeader(
  data: Uint8Array,
): {
  fileType: FigmaFileType;
  reserved: Uint8Array;
} {
  if (data.length < CANVAS_HEADER_SIZE) {
    throw new Error(
      `canvas.fig header too short: ${data.length} bytes (need ${CANVAS_HEADER_SIZE})`,
    );
  }

  // Find null terminator within first 10 bytes
  let magicLen = 0;
  while (magicLen < 10 && data[magicLen] !== 0)
    magicLen++;
  const magic = new TextDecoder('ascii',).decode(data.subarray(
    0,
    magicLen,
  ),);

  if (!VALID_MAGICS.has(magic,))
    throw new Error(`Unknown canvas.fig magic: "${magic}"`,);

  const fileType: FigmaFileType = magic === CANVAS_FIG_MAGIC.fig
    ? 'fig'
    : (magic === CANVAS_FIG_MAGIC.deck
      ? 'deck'
      : 'jam');

  const reserved = data.subarray(
    magicLen + 1,
    CANVAS_HEADER_SIZE,
  );
  return {
    fileType,
    reserved,
  };
}

// endregion

// region Canvas.fig full parsing

/**
 * Parse a canvas.fig binary blob into schema and document data.
 *
 * The binary layout is:
 *   1. 16-byte header (magic + reserved)
 *   2. Raw deflate stream containing the Kiwi schema
 *   3. After the deflate stream: a 4-byte LE uint32 size prefix
 *      followed by a zstd-compressed stream containing document data
 *
 * @param canvasData - Raw bytes of canvas.fig
 *
 * @returns Parsed file type, schema bytes, and document bytes
 */
async function parseCanvasFig(canvasData: Uint8Array,): Promise<{
  fileType: FigmaFileType;
  schemaBytes: Uint8Array;
  documentBytes: Uint8Array;
}> {
  const { fileType, } = parseCanvasHeader(canvasData,);

  // Search for zstd frame magic in the raw data
  const zstdMagic = new Uint8Array([
    0x28,
    0xB5,
    0x2F,
    0xFD,
  ],);
  let zstdOffset = -1;
  for (let i = CANVAS_HEADER_SIZE; i < canvasData.length - 4; i++) {
    if (
      canvasData[i] === zstdMagic[0]
      && canvasData[i + 1] === zstdMagic[1]
      && canvasData[i + 2] === zstdMagic[2]
      && canvasData[i + 3] === zstdMagic[3]
    ) {
      zstdOffset = i;
      break;
    }
  }

  // Decompress the schema (deflate stream between header and zstd data)
  const { inflateRawSync, } = await import('node:zlib');
  const compressedAfterHeader = canvasData.subarray(
    CANVAS_HEADER_SIZE,
    zstdOffset >= 0 ? zstdOffset - 4 : undefined,
  );

  // Use streaming inflate to handle the deflate stream boundary correctly
  // inflateRawSync may fail if there's trailing non-deflate data
  let schemaBytes: Uint8Array;
  try {
    schemaBytes = new Uint8Array(inflateRawSync(Buffer.from(compressedAfterHeader,),),);
  }
  catch {
    // If inflateRawSync fails, try with a streaming approach
    const { createInflateRaw, } = await import('node:zlib');
    const inflater = createInflateRaw();
    const chunks: Buffer[] = [];
    await new Promise<void>((
      resolve,
      reject,
    ) => {
      inflater.on(
        'data',
        (chunk: Buffer,) => chunks.push(chunk,),
      );
      inflater.on(
        'end',
        resolve,
      );
      inflater.on(
        'error',
        (err: Error,) => {
          if (err.message.includes('unexpected end',))
            resolve();
          else
            reject(err,);
        },
      );
      inflater.write(Buffer.from(compressedAfterHeader,),);
      inflater.end();
    },);
    schemaBytes = new Uint8Array(Buffer.concat(chunks,),);
  }

  // Decompress the document data (zstd)
  let documentBytes: Uint8Array;
  if (zstdOffset >= 0) {
    const sizePrefixOffset = zstdOffset - 4;
    const zstdSize = new DataView(
      canvasData.buffer,
      canvasData
        .byteOffset + sizePrefixOffset,
      4,
    )
      .getUint32(
        0,
        true,
      );
    const zstdData = canvasData.subarray(
      zstdOffset,
      zstdOffset + zstdSize,
    );
    documentBytes = await decompressZstd(zstdData,);
  }
  else {
    documentBytes = new Uint8Array(0,);
  }

  return {
    fileType,
    schemaBytes,
    documentBytes,
  };
}

/**
 * Decompress zstd-compressed data.
 *
 * Tries the @bokuwatch/zstd module first, then falls back to
 * spawning the `zstd` CLI tool.
 *
 * @param data - Zstd-compressed bytes
 *
 * @returns Decompressed bytes
 */
async function decompressZstd(data: Uint8Array,): Promise<Uint8Array> {
  // Try native zstd module
  try {
    const { decompress, } = await import('@bokuwatch/zstd' as string);
    return new Uint8Array(decompress(Buffer.from(data,),),);
  }
  catch {
    // Fall through to CLI
  }

  // Fallback: use zstd CLI
  const { execFile, } = await import('node:child_process');
  const { promisify, } = await import('node:util');
  const execFileAsync = promisify(execFile,);
  const {
    writeFileSync,
    readFileSync,
    unlinkSync,
  } = await import('node:fs');
  const { join, } = await import('node:path');
  const tmpDir = await import('node:os').then(m => m.tmpdir());
  const id = Date.now();
  const tmpIn = join(
    tmpDir,
    `figma-kiwi-${id}.zst`,
  );
  const tmpOut = join(
    tmpDir,
    `figma-kiwi-${id}.bin`,
  );

  try {
    writeFileSync(
      tmpIn,
      data,
    );
    await execFileAsync(
      'zstd',
      [
        '-d',
        tmpIn,
        '-o',
        tmpOut,
        '-f',
      ],
    );
    return new Uint8Array(readFileSync(tmpOut,),);
  }
  finally {
    try {
      unlinkSync(tmpIn,);
    }
    catch { /* ignore */ }
    try {
      unlinkSync(tmpOut,);
    }
    catch { /* ignore */ }
  }
}

// endregion

// region Meta.json parsing

/**
 * Parse the meta.json content from a Figma export ZIP.
 *
 * @param jsonBytes - Raw bytes of meta.json
 *
 * @returns Parsed metadata
 */
function parseMetaJson(jsonBytes: Uint8Array,): FigmaMeta {
  const json = JSON.parse(new TextDecoder('utf-8',).decode(jsonBytes,),);
  const cm = json.client_meta ?? {};
  return {
    backgroundColor: {
      r: cm.background_color?.r ?? 1,
      g: cm.background_color?.g ?? 1,
      b: cm.background_color?.b ?? 1,
      a: cm.background_color?.a ?? 1,
    },
    thumbnailSize: {
      width: cm.thumbnail_size?.width ?? 0,
      height: cm.thumbnail_size?.height ?? 0,
    },
    renderCoordinates: {
      x: cm.render_coordinates?.x ?? 0,
      y: cm.render_coordinates?.y ?? 0,
      width: cm.render_coordinates?.width ?? 0,
      height: cm.render_coordinates?.height ?? 0,
    },
    fileName: json.file_name ?? '',
    exportedAt: json.exported_at ?? '',
    developerRelatedLinks: json.developer_related_links ?? [],
  };
}

// endregion

// region ZIP extraction

/**
 * Extract entries from a ZIP buffer.
 *
 * Minimal ZIP parser that handles the stored (no compression)
 * and deflated entries found in Figma export files.
 *
 * @param buffer - Raw ZIP file content
 *
 * @returns Map from entry name to decompressed content
 */
async function extractZipEntries(buffer: Uint8Array,): Promise<Map<string, Uint8Array>> {
  const entries = new Map<string, Uint8Array>();
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

  // Find end of central directory record
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (view.getUint32(
      i,
      true,
    ) === 0x06_05_4B_50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1)
    throw new Error('Cannot find ZIP end of central directory',);

  const centralDirOffset = view.getUint32(
    eocdOffset + 16,
    true,
  );
  const centralDirEntries = view.getUint16(
    eocdOffset + 10,
    true,
  );

  let offset = centralDirOffset;
  for (let i = 0; i < centralDirEntries; i++) {
    const sig = view.getUint32(
      offset,
      true,
    );
    if (sig !== 0x02_01_4B_50)
      throw new Error(`Invalid central directory entry signature at offset ${offset}`,);

    const compressionMethod = view.getUint16(
      offset + 10,
      true,
    );
    const compressedSize = view.getUint32(
      offset + 20,
      true,
    );
    const uncompressedSize = view.getUint32(
      offset + 24,
      true,
    );
    const fileNameLength = view.getUint16(
      offset + 28,
      true,
    );
    const extraLength = view.getUint16(
      offset + 30,
      true,
    );
    const commentLength = view.getUint16(
      offset + 32,
      true,
    );
    const localHeaderOffset = view.getUint32(
      offset + 42,
      true,
    );

    const fileName = new TextDecoder('ascii',).decode(
      buffer.subarray(
        offset + 46,
        offset + 46 + fileNameLength,
      ),
    );

    // Parse local file header
    const localSig = view.getUint32(
      localHeaderOffset,
      true,
    );
    if (localSig !== 0x04_03_4B_50)
      throw new Error(`Invalid local file header at offset ${localHeaderOffset}`,);

    const localFileNameLen = view.getUint16(
      localHeaderOffset + 26,
      true,
    );
    const localExtraLen = view.getUint16(
      localHeaderOffset + 28,
      true,
    );
    const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
    const compressedData = buffer.subarray(
      dataOffset,
      dataOffset + compressedSize,
    );

    let content: Uint8Array;
    if (compressionMethod === 0)
      content = new Uint8Array(compressedData,);
    else if (compressionMethod === 8) {
      const { inflateRawSync, } = await import('node:zlib');
      content = new Uint8Array(inflateRawSync(Buffer.from(compressedData,),),);
    }
    else {
      throw new Error(
        `Unsupported ZIP compression method ${compressionMethod} for "${fileName}"`,
      );
    }

    if (content.length !== uncompressedSize) {
      throw new Error(
        `Size mismatch for "${fileName}": expected ${uncompressedSize}, got ${content.length}`,
      );
    }

    entries.set(
      fileName,
      content,
    );
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

// endregion

// region Top-level file parsing

/**
 * Parse a Figma export file (.fig, .deck, or .jam).
 *
 * The file is a ZIP archive containing:
 * - canvas.fig: The main binary content (header + schema + document data)
 * - meta.json: File metadata
 * - thumbnail.png: Preview thumbnail
 * - images/: Referenced image assets (SHA-1 hash filenames)
 *
 * @param filePathOrBuffer - Path to the file or its raw content
 *
 * @returns Fully parsed Figma file with decoded schema and document
 */
async function parseFigmaFile(
  filePathOrBuffer: string | Uint8Array,
): Promise<FigmaFile> {
  let rawBuffer: Uint8Array;
  if (typeof filePathOrBuffer === 'string') {
    const { readFile, } = await import('node:fs/promises');
    rawBuffer = new Uint8Array(await readFile(filePathOrBuffer,),);
  }
  else {
    rawBuffer = filePathOrBuffer;
  }

  const zipEntries = await extractZipEntries(rawBuffer,);

  const canvasFig = zipEntries.get('canvas.fig',);
  if (!canvasFig)
    throw new Error('Missing canvas.fig in Figma export file',);

  const metaJson = zipEntries.get('meta.json',);
  if (!metaJson)
    throw new Error('Missing meta.json in Figma export file',);

  const thumbnail = zipEntries.get('thumbnail.png',) ?? new Uint8Array(0,);

  const images = new Map<string, Uint8Array>();
  for (const [name, data,] of zipEntries) {
    if (name.startsWith('images/',)) {
      images.set(
        name.slice('images/'.length,),
        data,
      );
    }
  }

  const {
    fileType,
    schemaBytes,
    documentBytes,
  } = await parseCanvasFig(canvasFig,);
  const schema = parseKiwiSchema(schemaBytes,);
  const meta = parseMetaJson(metaJson,);
  const document = decodeDocument(
    documentBytes,
    schema,
  );

  return {
    fileType,
    meta,
    thumbnail,
    schema,
    document,
    images,
  };
}

// endregion

// region Exports

export {
  BinaryReader,
  CANVAS_FIG_MAGIC,
  CANVAS_HEADER_SIZE,
  decodeDocument,
  decodeMessage,
  decodeStruct,
  decodeValue,
  decompressZstd,
  extractZipEntries,
  type FigmaFile,
  type FigmaFileType,
  type FigmaMeta,
  KIWI_PRIMITIVES,
  type KiwiDecodedValue,
  type KiwiDefinition,
  type KiwiDefinitionKind,
  type KiwiEnum,
  type KiwiEnumField,
  type KiwiPrimitiveName,
  type KiwiSchema,
  type KiwiStruct,
  type KiwiStructField,
  parseCanvasFig,
  parseCanvasHeader,
  parseFigmaFile,
  parseKiwiSchema,
  parseMetaJson,
  resolveTypeName,
};

// endregion
