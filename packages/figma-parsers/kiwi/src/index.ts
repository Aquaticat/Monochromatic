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

/**
 * Kiwi primitive type names, indexed by their inverted type code.
 */
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

/**
 * Kiwi primitive type name union.
 */
type KiwiPrimitiveName = (typeof KIWI_PRIMITIVES)[number];

/**
 * Kind of type definition in a Kiwi schema.
 */
type KiwiDefinitionKind = 'ENUM' | 'STRUCT' | 'MESSAGE';

/**
 * An enum definition in the Kiwi schema.
 */
type KiwiEnumField = {
  name: string;
  type: never;
  isArray: boolean;
  value: number;
};

/**
 * A field within a struct or message definition.
 */
type KiwiStructField = {
  name: string;
  type: number;
  isArray: boolean;
  value: number;
};

/**
 * An enum definition.
 */
type KiwiEnum = {
  kind: 'ENUM';
  name: string;
  fields: KiwiEnumField[];
};

/**
 * A struct or message definition.
 */
type KiwiStruct = {
  kind: 'STRUCT' | 'MESSAGE';
  name: string;
  fields: KiwiStructField[];
};

/**
 * A type definition in the Kiwi schema.
 */
type KiwiDefinition = KiwiEnum | KiwiStruct;

/**
 * A fully parsed Kiwi schema.
 */
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
  /**
   * Underlying buffer; held by reference so callers can subarray it cheaply between reads.
   */
  data: Uint8Array;
  /**
   * Current byte cursor; advanced by every read method, queried by `eof`/`remaining`.
   */
  pos: number;

  /**
   * Construct a reader over an existing buffer.
   *
   * @param data - Buffer to read from
   *
   * @param pos - Initial byte cursor; defaults to 0
   */
  constructor(
    data: Uint8Array,
    pos = 0,
  ) {
    this.data = data;
    this.pos = pos;
  }

  /**
   * Whether the reader has consumed all bytes.
   */
  get eof(): boolean {
    return this.pos
      >= this
      .data
      .length;
  }

  /**
   * Number of remaining bytes.
   */
  get remaining(): number {
    return this.data
      .length
      - this
      .pos;
  }

  /**
   * Read a LEB128 unsigned varint (VarUint in Kiwi).
   *
   * Each byte contributes 7 bits of payload; the MSB signals
   * continuation.
   */
  readVarUint(): number {
    /**
     * Accumulator that OR-merges each 7-bit chunk into its final position.
     */
    let result = 0;
    /**
     * Bit offset for the next chunk; grows by 7 per byte until the MSB clears.
     */
    let shift = 0;
    while (this.pos
      < this
      .data
      .length) {
      /**
       * Current LEB128 byte; low 7 bits are payload, high bit signals continuation.
       */
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
    /**
     * Raw zigzag-encoded unsigned value, decoded below by inspecting the sign bit.
     */
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
    /**
     * Probe of the first byte; 0x00 is the special-cased single-byte encoding for 0.0.
     */
    const first = this.data[this.pos]!;
    if (first === 0) {
      this.pos += 1;
      return 0;
    }

    // Read 4 bytes as little-endian uint32
    /**
     * Low-order byte of the 4-byte float payload.
     */
    const b0 = this.data[this.pos]!;
    /**
     * Second byte of the 4-byte float payload.
     */
    const b1 = this.data[this.pos
      + 1]!;
    /**
     * Third byte of the 4-byte float payload.
     */
    const b2 = this.data[this.pos
      + 2]!;
    /**
     * High-order byte of the 4-byte float payload.
     */
    const b3 = this.data[this.pos
      + 3]!;
    this.pos += 4;

    // Rotate bits: move exponent from first byte back to correct position
    /**
     * Little-endian uint32 reassembly of the 4 payload bytes before bit rotation.
     */
    const rawBits = b0 | (b1 << 8)
      | (b2 << 16)
      | (b3 << 24);
    /**
     * Rotation result restoring the IEEE 754 float32 layout that Kiwi pre-rotates on encode.
     */
    const bits = ((rawBits << 23) | (rawBits >>> 9)) >>> 0;

    // Reinterpret as float32
    /**
     * Scratch view used to bitcast the uint32 into a float32 via setUint32/getFloat32.
     */
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
    /**
     * Scan cursor seeking the next 0x00 terminator; left pointing AT the null when the loop exits.
     */
    let end = this.pos;
    while ((end
      < this
      .data
      .length) && (this.data[end]
        !== 0))
      end += 1;
    /**
     * UTF-8 decode of the bytes between the original cursor and the terminator.
     */
    const s = new TextDecoder('utf-8',).decode(this.data
      .subarray(
      this.pos,
      end,
    ),);
    this.pos = end + 1;
    return s;
  }

  /**
   * Read a single byte.
   */
  readByte(): number {
    return this.data[this.pos++]!;
  }

  /**
   * Read a little-endian uint32.
   */
  readUint32LE(): number {
    /**
     * View aliased over the current 4-byte window so getUint32 can pull a little-endian value.
     */
    const view = new DataView(
      this.data
        .buffer,
      this.data
        .byteOffset
        + this
        .pos,
      4,
    );
    this.pos += 4;
    return view.getUint32(
      0,
      true,
    );
  }

  /**
   * Read a fixed number of raw bytes.
   */
  readBytes(count: number,): Uint8Array {
    /**
     * Subarray view onto the next `count` bytes; shares the parent buffer to avoid a copy.
     */
    const result = this.data
      .subarray(
      this.pos,
      this.pos
        + count,
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
    /**
     * Primitive table index; Kiwi stores negative codes as `~index` so the bit-flip recovers it.
     */
    const primIdx = ~typeCode;
    return primIdx < KIWI_PRIMITIVES
      .length
      ? KIWI_PRIMITIVES[primIdx]!
      : `prim[${primIdx}]`;
  }
  if (typeCode
    < schema
    .definitions
    .length)
    return schema.definitions[typeCode]!
      .name;
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
  /**
   * Cursor over the schema bytes; every read below advances it.
   */
  const reader = new BinaryReader(data,);

  /**
   * Number of definitions encoded at the head of the schema.
   */
  const definitionCount = reader.readVarUint();
  /**
   * Accumulator for every parsed definition in source order.
   */
  const definitions: KiwiDefinition[] = [];
  /**
   * Name to enum lookup so callers can resolve enum decoders without scanning `definitions`.
   */
  const enumByName = new Map<string, KiwiEnum>();
  /**
   * Name to struct/message lookup matching `enumByName` for non-enum kinds.
   */
  const structByName = new Map<string, KiwiStruct>();

  for (let i = 0; i < definitionCount; i++) {
    /**
     * Definition name read from the schema; reused for the lookup map keys.
     */
    const name = reader.readString();
    /**
     * Raw kind byte (0=ENUM, 1=STRUCT, 2=MESSAGE) before mapping to a string.
     */
    const kindByte = reader.readByte();
    /**
     * Number of fields this definition declares.
     */
    const fieldCount = reader.readVarUint();

    /**
     * Mapping table from `kindByte` index to the canonical kind string.
     */
    const kindNames: KiwiDefinitionKind[] = [
      'ENUM',
      'STRUCT',
      'MESSAGE',
    ];
    /**
     * Resolved kind string; absent indicates an unsupported byte and we throw.
     */
    const kind = kindNames[kindByte];
    if (!kind) {
      throw new Error(
        `Unknown Kiwi definition kind ${kindByte} for "${name}" at offset ${reader.pos}`,
      );
    }

    if (kind === 'ENUM') {
      /**
       * Field accumulator for the enum branch; populated by the inner loop.
       */
      const fields: KiwiEnumField[] = [];
      for (let j = 0; j < fieldCount; j++) {
        /**
         * Enum field label; paired with its numeric value below.
         */
        const fieldName = reader.readString();
        // Enum fields have type=null; in Figma's schema this is varint(0)
        reader.readVarInt(); // type (unused for enums)
        reader.readByte(); // isArray (unused for enums)
        /**
         * Numeric value associated with `fieldName`.
         */
        const value = reader.readVarUint();
        fields.push({
          name: fieldName,
          type: null as never,
          isArray: false,
          value,
        },);
      }
      /**
       * Completed enum definition pushed into the global definition list and lookup map.
       */
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
      /**
       * Field accumulator for the struct/message branch; populated by the inner loop.
       */
      const fields: KiwiStructField[] = [];
      for (let j = 0; j < fieldCount; j++) {
        /**
         * Struct field label.
         */
        const fieldName = reader.readString();
        /**
         * Zigzag-decoded field type code; negative selects a primitive, otherwise a definition index.
         */
        const fieldType = reader.readVarInt();
        /**
         * Whether this field is repeated; bit 0 of the byte after the type code carries the flag.
         */
        const isArray = (reader.readByte()
          & 1) === 1;
        /**
         * Tag value for the field (used as the wire tag for message fields).
         */
        const value = reader.readVarUint();
        fields.push({
          name: fieldName,
          type: fieldType,
          isArray,
          value,
        },);
      }
      /**
       * Completed struct/message definition; the cast keeps the narrowed kind discriminant.
       */
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
    /**
     * Primitive table index recovered from the encoded negative type code.
     */
    const primIdx = ~typeCode;
    switch (primIdx) {
      case 0: // bool
        return reader.readByte()
          !== 0;
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
  if (typeCode
    >= schema
    .definitions
    .length)
    return null;
  /**
   * Schema definition referenced by `typeCode`; dispatched on its kind below.
   */
  const def = schema.definitions[typeCode]!;

  if (def.kind
    === 'ENUM') {
    /**
     * Numeric enum value read from the wire; matched against `def.fields` to recover the name.
     */
    const value = reader.readVarUint();
    /**
     * Matching enum field; absent indicates a value the schema does not name, so we fall back to a stringified form.
     */
    const enumField = def.fields
      .find(f => f.value
        === value);
    return enumField ? `${def.name}.${enumField.name}` : `${def.name}(${value})`;
  }

  if (def.kind
    === 'STRUCT') {
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
  /**
   * Output object carrying the type tag plus each decoded field by name.
   */
  const result: Record<string, unknown> = { __type: def.name, };

  for (const field of def.fields) {
    if (reader.eof) {
      result[field.name] = null;
      continue;
    }

    if (field.isArray) {
      /**
       * Repeated-field length prefix on the wire.
       */
      const count = reader.readVarUint();
      /**
       * Decoded array elements accumulated before assignment to `result`.
       */
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
  /**
   * Output object carrying the message type tag plus each present field.
   */
  const result: Record<string, unknown> = { __type: def.name, };

  // Build tag -> field lookup
  /**
   * Tag to field index for O(1) dispatch on each wire tag below.
   */
  const fieldByTag = new Map<number, KiwiStructField>();
  for (const field of def.fields) {
    fieldByTag.set(
      field.value,
      field,
    );
  }

  while (!reader.eof) {
    /**
     * Next wire tag; 0 terminates the message body.
     */
    const tag = reader.readVarUint();
    if (tag === 0)
      break;

    /**
     * Field metadata for `tag`; absent indicates an unknown tag we cannot skip.
     */
    const field = fieldByTag.get(tag,);
    if (field) {
      if (field.isArray) {
        /**
         * Repeated-field length prefix for the current message field.
         */
        const count = reader.readVarUint();
        /**
         * Decoded array elements before assignment to `result`.
         */
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
  if (documentData.length
    === 0)
    return null;

  /**
   * Cursor over the document bytes consumed by `decodeMessage`.
   */
  const reader = new BinaryReader(documentData,);
  /**
   * Top-level Message definition; required to decode the document root.
   */
  const messageDef = schema.structByName
    .get('Message',);
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

/**
 * Set of valid magic byte strings.
 */
const VALID_MAGICS = new Set<string>(Object.values(CANVAS_FIG_MAGIC,),);

/**
 * Byte offset where the deflate-compressed schema starts in canvas.fig.
 */
const CANVAS_HEADER_SIZE = 16;

// endregion

// region File format types

/**
 * The type of Figma file, determined by the canvas.fig magic bytes.
 */
type FigmaFileType = 'fig' | 'deck' | 'jam';

/**
 * Metadata extracted from meta.json inside the ZIP archive.
 */
type FigmaMeta = {
  backgroundColor: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  thumbnailSize: {
    width: number;
    height: number;
  };
  renderCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fileName: string;
  exportedAt: string;
  developerRelatedLinks: unknown[];
};

/**
 * A fully decoded Figma file with all its components.
 */
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
  if (data.length
    < CANVAS_HEADER_SIZE) {
    throw new Error(
      `canvas.fig header too short: ${data.length} bytes (need ${CANVAS_HEADER_SIZE})`,
    );
  }

  // Find null terminator within first 10 bytes
  /**
   * Cursor seeking the 0x00 terminator inside the 10-byte magic window.
   */
  let magicLen = 0;
  while ((magicLen < 10) && (data[magicLen]
    !== 0))
    magicLen++;
  /**
   * ASCII-decoded magic string used to discriminate fig/deck/jam payloads.
   */
  const magic = new TextDecoder('ascii',).decode(data.subarray(
    0,
    magicLen,
  ),);

  if (!VALID_MAGICS.has(magic,))
    throw new Error(`Unknown canvas.fig magic: "${magic}"`,);

  /**
   * File-type discriminant derived from the validated magic string.
   */
  const fileType: FigmaFileType = magic === CANVAS_FIG_MAGIC
    .fig
    ? 'fig'
    : (magic === CANVAS_FIG_MAGIC
      .deck
      ? 'deck'
      : 'jam');

  /**
   * Bytes past the magic terminator up to the end of the header; surfaced for completeness even though Figma writes zeros.
   */
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
  /**
   * File-type discriminant pulled from the header; the rest of the body is type-agnostic.
   */
  const { fileType, } = parseCanvasHeader(canvasData,);

  // Search for zstd frame magic in the raw data
  /**
   * Zstandard frame magic bytes; scanned for to locate the document section.
   */
  const zstdMagic = new Uint8Array([
    0x28,
    0xB5,
    0x2F,
    0xFD,
  ],);
  /**
   * Byte offset where the zstd frame begins; -1 indicates no zstd payload was found.
   */
  let zstdOffset = -1;
  for (let i = CANVAS_HEADER_SIZE; i < (canvasData.length
    - 4); i++) {
    if (
      (canvasData[i]
        === zstdMagic[0])
      && (canvasData[i + 1]
        === zstdMagic[1])
        && (canvasData[i + 2]
          === zstdMagic[2])
        && (canvasData[i + 3]
          === zstdMagic[3])
    ) {
      zstdOffset = i;
      break;
    }
  }

  // Decompress the schema (deflate stream between header and zstd data)
  /**
   * Node `zlib.inflateRawSync` resolved via dynamic import to keep this file ESM-friendly.
   */
  const { inflateRawSync, } = await import('node:zlib');
  /**
   * Slice covering the deflate stream between the header and the zstd size prefix.
   */
  const compressedAfterHeader = canvasData.subarray(
    CANVAS_HEADER_SIZE,
    zstdOffset >= 0 ? zstdOffset - 4 : undefined,
  );

  // Use streaming inflate to handle the deflate stream boundary correctly
  // inflateRawSync may fail if there's trailing non-deflate data
  /**
   * Decompressed schema bytes; assigned by whichever inflate path succeeds.
   */
  let schemaBytes: Uint8Array;
  try {
    schemaBytes = new Uint8Array(
      inflateRawSync(Buffer.from(compressedAfterHeader,),),
    );
  }
  catch {
    // If inflateRawSync fails, try with a streaming approach
    /**
     * Streaming-mode constructor used when the one-shot inflate trips on trailing bytes.
     */
    const { createInflateRaw, } = await import('node:zlib');
    /**
     * Live streaming inflate that tolerates an unexpected stream end.
     */
    const inflater = createInflateRaw();
    /**
     * Accumulator for decompressed chunks; concatenated at the end into `schemaBytes`.
     */
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
          if (err.message
            .includes('unexpected end',))
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
  /**
   * Decompressed document bytes; populated only when a zstd payload was located.
   */
  let documentBytes: Uint8Array;
  if (zstdOffset >= 0) {
    /**
     * Offset of the 4-byte little-endian zstd size prefix preceding the frame.
     */
    const sizePrefixOffset = zstdOffset - 4;
    /**
     * Declared compressed size; used to bound the slice rather than running to EOF.
     */
    const zstdSize = new DataView(
      canvasData.buffer,
      canvasData
        .byteOffset
        + sizePrefixOffset,
      4,
    )
      .getUint32(
        0,
        true,
      );
    /**
     * Zstd-compressed document slice handed off to the decompressor.
     */
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
    /**
     * Native-binding zstd decoder; available only when the optional dep is installed.
     */
    const { decompress, } = await import('@bokuwatch/zstd' as string);
    return new Uint8Array(
      decompress(Buffer.from(data,),),
    );
  }
  catch {
    // Fall through to CLI
  }

  // Fallback: use zstd CLI
  /**
   * Cross-platform child-process spawner; used to invoke the system `zstd` CLI.
   */
  const { default: spawn, } = await import('nano-spawn');
  /**
   * Sync fs helpers; CLI fallback needs temp file shuttling, not streaming I/O.
   */
  const {
    writeFileSync,
    readFileSync,
    unlinkSync,
  } = await import('node:fs');
  /**
   * Path joiner used to build temp file paths under the OS temp directory.
   */
  const { join, } = await import('node:path');
  /**
   * Resolved OS temp directory; nested in a `.then` because `tmpdir()` is not exported as a default.
   */
  const tmpDir = await import('node:os').then(m => m.tmpdir());
  /**
   * Unique-enough suffix for the temp filenames to avoid collisions between concurrent calls.
   */
  const id = Date.now();
  /**
   * Temp path for the compressed input passed to the CLI.
   */
  const tmpIn = join(
    tmpDir,
    `figma-kiwi-${id}.zst`,
  );
  /**
   * Temp path receiving the decompressed output of the CLI.
   */
  const tmpOut = join(
    tmpDir,
    `figma-kiwi-${id}.bin`,
  );

  try {
    writeFileSync(
      tmpIn,
      data,
    );
    await spawn(
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
  /**
   * Decoded JSON tree from meta.json; field shapes follow Figma's snake_case export schema.
   */
  const json = JSON.parse(new TextDecoder('utf-8',).decode(jsonBytes,),);
  /**
   * Convenience alias for the nested `client_meta` block; defaults to `{}` so destructuring is safe.
   */
  const cm = json.client_meta
    ?? {};
  return {
    backgroundColor: {
      r: cm.background_color
        ?.r
        ?? 1,
      g: cm.background_color
        ?.g
        ?? 1,
      b: cm.background_color
        ?.b
        ?? 1,
      a: cm.background_color
        ?.a
        ?? 1,
    },
    thumbnailSize: {
      width: cm.thumbnail_size
        ?.width
        ?? 0,
      height: cm.thumbnail_size
        ?.height
        ?? 0,
    },
    renderCoordinates: {
      x: cm.render_coordinates
        ?.x
        ?? 0,
      y: cm.render_coordinates
        ?.y
        ?? 0,
      width: cm.render_coordinates
        ?.width
        ?? 0,
      height: cm.render_coordinates
        ?.height
        ?? 0,
    },
    fileName: json.file_name
      ?? '',
    exportedAt: json.exported_at
      ?? '',
    developerRelatedLinks: json.developer_related_links
      ?? [],
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
  /**
   * Output map keyed by ZIP entry name with the decompressed payload.
   */
  const entries = new Map<string, Uint8Array>();
  /**
   * View aliased over the ZIP bytes so getUint16/32 can read structured fields.
   */
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

  // Find end of central directory record
  /**
   * EOCD record offset located by scanning backwards for its 4-byte signature.
   */
  let eocdOffset = -1;
  for (let i = buffer.length
    - 22; i >= 0; i--) {
    if (view.getUint32(
      i,
      true,
    )
      === 0x06_05_4B_50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === (-1))
    throw new Error('Cannot find ZIP end of central directory',);

  /**
   * Absolute byte offset of the central directory pulled from the EOCD record.
   */
  const centralDirOffset = view.getUint32(
    eocdOffset + 16,
    true,
  );
  /**
   * Number of central directory entries pulled from the EOCD record.
   */
  const centralDirEntries = view.getUint16(
    eocdOffset + 10,
    true,
  );

  /**
   * Walking cursor through the central directory; advanced by each entry's variable-length record.
   */
  let offset = centralDirOffset;
  for (let i = 0; i < centralDirEntries; i++) {
    /**
     * Central-directory entry signature; mismatched bytes mean a corrupted ZIP.
     */
    const sig = view.getUint32(
      offset,
      true,
    );
    if (sig !== 0x02_01_4B_50)
      throw new Error(`Invalid central directory entry signature at offset ${offset}`,);

    /**
     * ZIP compression method (0=stored, 8=deflate).
     */
    const compressionMethod = view.getUint16(
      offset + 10,
      true,
    );
    /**
     * Compressed size used to slice the file payload.
     */
    const compressedSize = view.getUint32(
      offset + 20,
      true,
    );
    /**
     * Declared uncompressed size; checked against the actual length after inflate.
     */
    const uncompressedSize = view.getUint32(
      offset + 24,
      true,
    );
    /**
     * Length of the variable-length entry name field.
     */
    const fileNameLength = view.getUint16(
      offset + 28,
      true,
    );
    /**
     * Length of the variable-length extra field; only consumed to advance the cursor.
     */
    const extraLength = view.getUint16(
      offset + 30,
      true,
    );
    /**
     * Length of the variable-length comment field; only consumed to advance the cursor.
     */
    const commentLength = view.getUint16(
      offset + 32,
      true,
    );
    /**
     * Absolute offset of the per-entry local file header.
     */
    const localHeaderOffset = view.getUint32(
      offset + 42,
      true,
    );

    /**
     * ASCII-decoded entry name; Figma exports stick to ASCII so a UTF-8 decoder is not needed.
     */
    const fileName = new TextDecoder('ascii',).decode(
      buffer.subarray(
        offset + 46,
        offset + 46
          + fileNameLength,
      ),
    );

    // Parse local file header
    /**
     * Local file header signature; verified before reading variable-length fields.
     */
    const localSig = view.getUint32(
      localHeaderOffset,
      true,
    );
    if (localSig !== 0x04_03_4B_50)
      throw new Error(`Invalid local file header at offset ${localHeaderOffset}`,);

    /**
     * Local-header copy of the entry name length; the central directory copy can differ in malformed ZIPs.
     */
    const localFileNameLen = view.getUint16(
      localHeaderOffset + 26,
      true,
    );
    /**
     * Local-header copy of the extra-field length.
     */
    const localExtraLen = view.getUint16(
      localHeaderOffset + 28,
      true,
    );
    /**
     * Absolute offset where the entry's compressed bytes begin.
     */
    const dataOffset = localHeaderOffset + 30
      + localFileNameLen
      + localExtraLen;
    /**
     * Slice of compressed bytes handed to either passthrough or inflate.
     */
    const compressedData = buffer.subarray(
      dataOffset,
      dataOffset + compressedSize,
    );

    /**
     * Decompressed payload assigned by whichever compression branch is selected.
     */
    let content: Uint8Array;
    if (compressionMethod === 0)
      content = new Uint8Array(compressedData,);
    else if (compressionMethod === 8) {
      /**
       * Node zlib raw inflate resolved per-entry; only needed for deflate-compressed entries.
       */
      const { inflateRawSync, } = await import('node:zlib');
      content = new Uint8Array(
        inflateRawSync(Buffer.from(compressedData,),),
      );
    }
    else {
      throw new Error(
        `Unsupported ZIP compression method ${compressionMethod} for "${fileName}"`,
      );
    }

    if (content.length
      !== uncompressedSize) {
      throw new Error(
        `Size mismatch for "${fileName}": expected ${uncompressedSize}, got ${content.length}`,
      );
    }

    entries.set(
      fileName,
      content,
    );
    offset += 46 + fileNameLength
      + extraLength
      + commentLength;
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
  /**
   * Whole-file buffer; populated from disk or passed-through depending on the input shape.
   */
  let rawBuffer: Uint8Array;
  if ((typeof filePathOrBuffer) === 'string') {
    /**
     * Promise-based `readFile` resolved lazily so a Uint8Array input avoids the fs import.
     */
    const { readFile, } = await import('node:fs/promises');
    rawBuffer = new Uint8Array(await readFile(filePathOrBuffer,),);
  }
  else {
    rawBuffer = filePathOrBuffer;
  }

  /**
   * Map of ZIP entry name to decompressed bytes covering every file in the archive.
   */
  const zipEntries = await extractZipEntries(rawBuffer,);

  /**
   * canvas.fig entry; required, so a missing key is a hard error.
   */
  const canvasFig = zipEntries.get('canvas.fig',);
  if (!canvasFig)
    throw new Error('Missing canvas.fig in Figma export file',);

  /**
   * meta.json entry; required, so a missing key is a hard error.
   */
  const metaJson = zipEntries.get('meta.json',);
  if (!metaJson)
    throw new Error('Missing meta.json in Figma export file',);

  /**
   * Thumbnail PNG bytes; missing thumbnails default to an empty buffer rather than an error.
   */
  const thumbnail = zipEntries.get('thumbnail.png',)
    ?? new Uint8Array(0,);

  /**
   * Image map keyed by SHA-1 filename with the `images/` prefix stripped.
   */
  const images = new Map<string, Uint8Array>();
  for (const [name, data,] of zipEntries) {
    if (name.startsWith('images/',)) {
      images.set(
        name.slice('images/'.length,),
        data,
      );
    }
  }

  /**
   * File type and decompressed schema/document slices extracted from canvas.fig.
   */
  const {
    fileType,
    schemaBytes,
    documentBytes,
  } = await parseCanvasFig(canvasFig,);
  /**
   * Parsed schema used to drive the document decoder.
   */
  const schema = parseKiwiSchema(schemaBytes,);
  /**
   * Parsed metadata returned in the FigmaFile result.
   */
  const meta = parseMetaJson(metaJson,);
  /**
   * Decoded document tree; null when the file ships without a document section.
   */
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
