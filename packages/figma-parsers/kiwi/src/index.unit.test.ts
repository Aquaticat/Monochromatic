import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  BinaryReader,
  decodeDocument,
  decodeMessage,
  decodeStruct,
  decodeValue,
  type KiwiSchema,
  type KiwiStruct,
  parseCanvasHeader,
  parseFigmaFile,
  parseKiwiSchema,
  parseMetaJson,
  resolveTypeName,
} from './index.ts';

// region Helpers for constructing test data

/** Encode a number as a LEB128 varuint. */
function encodeVarUint(value: number,): number[] {
  if (value === 0)
    return [0,];
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0) {
    let byte = v & 0x7F;
    v >>>= 7;
    if (v > 0)
      byte |= 0x80;
    bytes.push(byte,);
  }
  return bytes;
}

/** Encode a number as a zigzag varint. */
function encodeVarInt(value: number,): number[] {
  const raw = value < 0 ? (~value << 1) | 1 : value << 1;
  return encodeVarUint(raw >>> 0,);
}

/** Encode a null-terminated string. */
function encodeString(s: string,): number[] {
  return [...new TextEncoder().encode(s,), 0,];
}

// endregion

// region Test the minimal Kiwi schema used across tests

/**
 * Build a minimal schema with just enough definitions to test
 * the document decoder: MessageType (enum), NodePhase (enum),
 * NodeType (enum), GUID (struct), ParentIndex (struct),
 * Message (message), NodeChange (message).
 */
function buildMinimalSchemaBytes(): number[] {
  const bytes: number[] = [];
  // definitionCount = 7
  bytes.push(...encodeVarUint(7,),);

  // Def 0: MessageType (ENUM)
  bytes.push(...encodeString('MessageType',),);
  bytes.push(0,); // kind = ENUM
  bytes.push(...encodeVarUint(2,),); // 2 values
  bytes.push(...encodeString('NODE_CHANGES',),);
  bytes.push(...encodeVarInt(0,),); // type (unused, 0 in Figma)
  bytes.push(0,); // isArray
  bytes.push(...encodeVarUint(1,),); // value = 1
  bytes.push(...encodeString('JOIN_START',),);
  bytes.push(...encodeVarInt(0,),);
  bytes.push(0,);
  bytes.push(...encodeVarUint(0,),); // value = 0

  // Def 1: NodePhase (ENUM)
  bytes.push(...encodeString('NodePhase',),);
  bytes.push(0,); // ENUM
  bytes.push(...encodeVarUint(2,),);
  bytes.push(...encodeString('CREATED',),);
  bytes.push(...encodeVarInt(0,),);
  bytes.push(0,);
  bytes.push(...encodeVarUint(0,),); // value = 0
  bytes.push(...encodeString('REMOVED',),);
  bytes.push(...encodeVarInt(0,),);
  bytes.push(0,);
  bytes.push(...encodeVarUint(1,),); // value = 1

  // Def 2: NodeType (ENUM)
  bytes.push(...encodeString('NodeType',),);
  bytes.push(0,); // ENUM
  bytes.push(...encodeVarUint(3,),);
  bytes.push(...encodeString('NONE',),);
  bytes.push(...encodeVarInt(0,),);
  bytes.push(0,);
  bytes.push(...encodeVarUint(0,),);
  bytes.push(...encodeString('DOCUMENT',),);
  bytes.push(...encodeVarInt(0,),);
  bytes.push(0,);
  bytes.push(...encodeVarUint(1,),);
  bytes.push(...encodeString('CANVAS',),);
  bytes.push(...encodeVarInt(0,),);
  bytes.push(0,);
  bytes.push(...encodeVarUint(2,),);

  // Def 3: Matrix (STRUCT): 6 float fields
  bytes.push(...encodeString('Matrix',),);
  bytes.push(1,); // STRUCT
  bytes.push(...encodeVarUint(6,),);
  for (const name of ['m00', 'm01', 'm02', 'm10', 'm11', 'm12',]) {
    bytes.push(...encodeString(name,),);
    bytes.push(...encodeVarInt(-5,),); // float (type_raw = ~4 = -5)
    bytes.push(0,); // not array
    bytes.push(...encodeVarUint(0,),); // tag (unused for struct field order)
  }

  // Def 4: GUID (STRUCT): sessionID(uint), localID(uint)
  bytes.push(...encodeString('GUID',),);
  bytes.push(1,); // STRUCT
  bytes.push(...encodeVarUint(2,),);
  bytes.push(...encodeString('sessionID',),);
  bytes.push(...encodeVarInt(-4,),); // uint (type_raw = ~3 = -4)
  bytes.push(0,);
  bytes.push(...encodeVarUint(1,),); // tag = 1
  bytes.push(...encodeString('localID',),);
  bytes.push(...encodeVarInt(-4,),); // uint
  bytes.push(0,);
  bytes.push(...encodeVarUint(2,),); // tag = 2

  // Def 5: ParentIndex (STRUCT): guid(GUID ref), position(string)
  bytes.push(...encodeString('ParentIndex',),);
  bytes.push(1,); // STRUCT
  bytes.push(...encodeVarUint(2,),);
  bytes.push(...encodeString('guid',),);
  bytes.push(...encodeVarInt(4,),); // ref to def[4] = GUID
  bytes.push(0,);
  bytes.push(...encodeVarUint(1,),); // tag = 1
  bytes.push(...encodeString('position',),);
  bytes.push(...encodeVarInt(-6,),); // string (type_raw = ~5 = -6)
  bytes.push(0,);
  bytes.push(...encodeVarUint(2,),); // tag = 2

  // Def 6: NodeChange (MESSAGE): guid, phase, parentIndex, type, name, visible, opacity
  bytes.push(...encodeString('NodeChange',),);
  bytes.push(2,); // MESSAGE
  bytes.push(...encodeVarUint(7,),);
  // tag 1: guid (GUID ref)
  bytes.push(...encodeString('guid',),);
  bytes.push(...encodeVarInt(4,),); // ref to def[4] = GUID
  bytes.push(0,);
  bytes.push(...encodeVarUint(1,),); // tag = 1
  // tag 2: phase (NodePhase ref)
  bytes.push(...encodeString('phase',),);
  bytes.push(...encodeVarInt(1,),); // ref to def[1] = NodePhase
  bytes.push(0,);
  bytes.push(...encodeVarUint(2,),); // tag = 2
  // tag 3: parentIndex (ParentIndex ref)
  bytes.push(...encodeString('parentIndex',),);
  bytes.push(...encodeVarInt(5,),); // ref to def[5] = ParentIndex
  bytes.push(0,);
  bytes.push(...encodeVarUint(3,),); // tag = 3
  // tag 4: type (NodeType ref)
  bytes.push(...encodeString('type',),);
  bytes.push(...encodeVarInt(2,),); // ref to def[2] = NodeType
  bytes.push(0,);
  bytes.push(...encodeVarUint(4,),); // tag = 4
  // tag 5: name (string)
  bytes.push(...encodeString('name',),);
  bytes.push(...encodeVarInt(-6,),); // string
  bytes.push(0,);
  bytes.push(...encodeVarUint(5,),); // tag = 5
  // tag 6: visible (bool)
  bytes.push(...encodeString('visible',),);
  bytes.push(...encodeVarInt(-1,),); // bool (type_raw = ~0 = -1)
  bytes.push(0,);
  bytes.push(...encodeVarUint(6,),); // tag = 6
  // tag 8: opacity (float)
  bytes.push(...encodeString('opacity',),);
  bytes.push(...encodeVarInt(-5,),); // float
  bytes.push(0,);
  bytes.push(...encodeVarUint(8,),); // tag = 8

  return bytes;
}

/** Build a minimal Message definition as def 7. */
function buildMessageSchemaBytes(): number[] {
  // Add a Message MESSAGE type as def 7
  const bytes: number[] = [];
  // Total defs = 8
  bytes.push(...encodeVarUint(8,),);

  // Defs 0-6 same as buildMinimalSchemaBytes (MessageType, NodePhase, NodeType, Matrix, GUID, ParentIndex, NodeChange)
  // ... we'll just inline the same construction
  // For brevity, let's just build the full thing with 8 defs
  return bytes;
}

// endregion

// region Tests

await describe({
  name: '',
  children: [
    // region BinaryReader
    describe({
      name: BinaryReader.name,
      children: [
        it({
          name: 'reads single-byte varuint',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([42,],),);
            expect(reader.readVarUint(),).toBe(42,);
            expect(reader.eof,).toBe(true,);
          },
        },),
        it({
          name: 'reads multi-byte varuint',
          fn: async () => {
            // 0x80 0x01 = (0 << 7) | 1 = 128... wait
            // 0x80 = 10000000 -> lower 7 = 0000000 = 0, continue
            // 0x01 = 00000001 -> lower 7 = 0000001 = 1, stop
            // value = 0 | (1 << 7) = 128
            const reader = new BinaryReader(new Uint8Array([0x80, 0x01,],),);
            expect(reader.readVarUint(),).toBe(128,);
          },
        },),
        it({
          name: 'reads zero varuint',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([0,],),);
            expect(reader.readVarUint(),).toBe(0,);
          },
        },),
        it({
          name: 'reads positive varint (zigzag)',
          fn: async () => {
            // zigzag(0) = 0, zigzag(1) = 2, zigzag(-1) = 1
            const reader = new BinaryReader(new Uint8Array([4,],),); // varuint 4 = varint 2
            expect(reader.readVarInt(),).toBe(2,);
          },
        },),
        it({
          name: 'reads negative varint (zigzag)',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([1,],),); // varuint 1 = varint -1
            expect(reader.readVarInt(),).toBe(-1,);
          },
        },),
        it({
          name: 'reads zero varfloat',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([0,],),);
            expect(reader.readVarFloat(),).toBe(0,);
            expect(reader.eof,).toBe(true,);
          },
        },),
        it({
          name: 'reads nonzero varfloat (1.0)',
          fn: async () => {
            // float32 1.0 = bits 0x3F800000
            // VarFloat encoding: (bits >>> 23) | (bits << 9)
            // = 0x7F | 0x00000000 = 0x0000007F
            // Little-endian: 7F 00 00 00
            const reader = new BinaryReader(new Uint8Array([0x7F, 0x00, 0x00, 0x00,],),);
            const val = reader.readVarFloat();
            expect(val,).toBeCloseTo(1, 5,);
          },
        },),
        it({
          name: 'reads negative varfloat (-1.0)',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([0x7F, 0x01, 0x00, 0x00,],),);
            expect(reader.readVarFloat(),).toBeCloseTo(-1, 5,);
          },
        },),
        it({
          name: 'reads fractional varfloat (0.5)',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([0x7E, 0x00, 0x00, 0x00,],),);
            expect(reader.readVarFloat(),).toBeCloseTo(0.5, 5,);
          },
        },),
        it({
          name: 'reads small varfloat (0.125)',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([0x7C, 0x00, 0x00, 0x00,],),);
            expect(reader.readVarFloat(),).toBeCloseTo(0.125, 5,);
          },
        },),
        it({
          name: 'reads null-terminated string',
          fn: async () => {
            const encoded = new TextEncoder().encode('hello\0',);
            const reader = new BinaryReader(new Uint8Array(encoded,),);
            expect(reader.readString(),).toBe('hello',);
          },
        },),
        it({
          name: 'reads single byte',
          fn: async () => {
            const reader = new BinaryReader(new Uint8Array([0xAB,],),);
            expect(reader.readByte(),).toBe(0xAB,);
          },
        },),
      ],
    },),
    // endregion

    // region Schema parsing
    describe({
      name: parseKiwiSchema.name,
      children: [
        it({
          name: 'parses minimal schema with enum and struct',
          fn: async () => {
            const bytes = new Uint8Array(buildMinimalSchemaBytes(),);
            const schema = parseKiwiSchema(bytes,);
            expect(schema.definitions,).toHaveLength(7,);
            expect(schema.enumByName.has('MessageType',),).toBe(true,);
            expect(schema.enumByName.has('NodePhase',),).toBe(true,);
            expect(schema.enumByName.has('NodeType',),).toBe(true,);
            expect(schema.structByName.has('GUID',),).toBe(true,);
            expect(schema.structByName.has('ParentIndex',),).toBe(true,);
            expect(schema.structByName.has('NodeChange',),).toBe(true,);
          },
        },),
        it({
          name: 'parses enum values correctly',
          fn: async () => {
            const bytes = new Uint8Array(buildMinimalSchemaBytes(),);
            const schema = parseKiwiSchema(bytes,);
            const nodeType = schema.enumByName.get('NodeType',)!;
            const docField = nodeType.fields.find(f => f.name === 'DOCUMENT');
            expect(docField?.value,).toBe(1,);
            const canvasField = nodeType.fields.find(f => f.name === 'CANVAS');
            expect(canvasField?.value,).toBe(2,);
          },
        },),
        it({
          name: 'parses struct fields with correct types',
          fn: async () => {
            const bytes = new Uint8Array(buildMinimalSchemaBytes(),);
            const schema = parseKiwiSchema(bytes,);
            const guid = schema.structByName.get('GUID',)!;
            expect(guid.kind,).toBe('STRUCT',);
            expect(guid.fields,).toHaveLength(2,);
            expect(guid.fields[0]!.name,).toBe('sessionID',);
            expect(guid.fields[0]!.type,).toBe(-4,); // uint
            expect(guid.fields[1]!.name,).toBe('localID',);
          },
        },),
        it({
          name: 'parses message with tagged fields',
          fn: async () => {
            const bytes = new Uint8Array(buildMinimalSchemaBytes(),);
            const schema = parseKiwiSchema(bytes,);
            const nc = schema.structByName.get('NodeChange',)!;
            expect(nc.kind,).toBe('MESSAGE',);
            expect(nc.fields,).toHaveLength(7,);
            const guidField = nc.fields.find(f => f.name === 'guid')!;
            expect(guidField.value,).toBe(1,); // tag = 1
            expect(guidField.type,).toBe(4,); // ref to def[4] = GUID
          },
        },),
      ],
    },),
    // endregion

    // region resolveTypeName
    describe({
      name: resolveTypeName.name,
      children: [
        it({
          name: 'resolves primitive types',
          fn: async () => {
            const schema = parseKiwiSchema(new Uint8Array(buildMinimalSchemaBytes(),),);
            expect(resolveTypeName(-1, schema,),).toBe('bool',);
            expect(resolveTypeName(-4, schema,),).toBe('uint',);
            expect(resolveTypeName(-5, schema,),).toBe('float',);
            expect(resolveTypeName(-6, schema,),).toBe('string',);
          },
        },),
        it({
          name: 'resolves definition references',
          fn: async () => {
            const schema = parseKiwiSchema(new Uint8Array(buildMinimalSchemaBytes(),),);
            expect(resolveTypeName(0, schema,),).toBe('MessageType',);
            expect(resolveTypeName(4, schema,),).toBe('GUID',);
          },
        },),
      ],
    },),
    // endregion

    // region Document decoding
    describe({
      name: decodeDocument.name,
      children: [
        it({
          name: 'returns null for empty data',
          fn: async () => {
            const schema = parseKiwiSchema(new Uint8Array(buildMinimalSchemaBytes(),),);
            const result = decodeDocument(new Uint8Array(0,), schema,);
            expect(result,).toBeNull();
          },
        },),
        it({
          name: 'decodes a minimal message with NodeChange',
          fn: async () => {
            // Build a document: Message with type=NODE_CHANGES and 1 NodeChange
            // Message tag 1 (type) = 1 (NODE_CHANGES)
            // Message tag 2 (sessionID) = 0
            // Message tag 3 (ackID) = 0
            // Message tag 4 (nodeChanges) with count=1
            //   NodeChange:
            //     tag 1 (guid): GUID struct (sessionID=0, localID=0)
            //     tag 4 (type): NodeType = DOCUMENT (1)
            //     tag 5 (name): "TestNode"
            //     tag 6 (visible): true
            //     tag 0 (end of NodeChange)
            //   tag 0 (end of Message)

            // We need a schema with Message definition.
            // Let's add def 7 = Message to our schema bytes
            const schemaBytes = buildMinimalSchemaBytes();
            // Replace definition count: was 7, now 8
            // Actually, let's rebuild the full schema with Message added
            const fullSchemaBytes: number[] = [];
            fullSchemaBytes.push(...encodeVarUint(8,),); // 8 definitions

            // Defs 0-6: same as buildMinimalSchemaBytes
            // We need to reconstruct them...
            // Instead, let's just use the already-built bytes and append

            // Actually, let's construct the schema and document separately
            // For the document test, we need Message in the schema
            // Let's build a complete schema with Message
            const completeSchema: number[] = [];
            completeSchema.push(...encodeVarUint(8,),); // 8 definitions

            // Def 0: MessageType (ENUM)
            completeSchema.push(...encodeString('MessageType',),);
            completeSchema.push(0,); // ENUM
            completeSchema.push(...encodeVarUint(1,),); // 1 value
            completeSchema.push(...encodeString('NODE_CHANGES',),);
            completeSchema.push(...encodeVarInt(0,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);

            // Def 1: NodePhase (ENUM)
            completeSchema.push(...encodeString('NodePhase',),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);
            completeSchema.push(...encodeString('CREATED',),);
            completeSchema.push(...encodeVarInt(0,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(0,),);

            // Def 2: NodeType (ENUM)
            completeSchema.push(...encodeString('NodeType',),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(2,),);
            completeSchema.push(...encodeString('DOCUMENT',),);
            completeSchema.push(...encodeVarInt(0,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);
            completeSchema.push(...encodeString('CANVAS',),);
            completeSchema.push(...encodeVarInt(0,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(2,),);

            // Def 3: Matrix (STRUCT)
            completeSchema.push(...encodeString('Matrix',),);
            completeSchema.push(1,); // STRUCT
            completeSchema.push(...encodeVarUint(6,),);
            for (const n of ['m00', 'm01', 'm02', 'm10', 'm11', 'm12',]) {
              completeSchema.push(...encodeString(n,),);
              completeSchema.push(...encodeVarInt(-5,),);
              completeSchema.push(0,);
              completeSchema.push(...encodeVarUint(0,),);
            }

            // Def 4: GUID (STRUCT)
            completeSchema.push(...encodeString('GUID',),);
            completeSchema.push(1,);
            completeSchema.push(...encodeVarUint(2,),);
            completeSchema.push(...encodeString('sessionID',),);
            completeSchema.push(...encodeVarInt(-4,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);
            completeSchema.push(...encodeString('localID',),);
            completeSchema.push(...encodeVarInt(-4,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(2,),);

            // Def 5: ParentIndex (STRUCT)
            completeSchema.push(...encodeString('ParentIndex',),);
            completeSchema.push(1,);
            completeSchema.push(...encodeVarUint(2,),);
            completeSchema.push(...encodeString('guid',),);
            completeSchema.push(...encodeVarInt(4,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);
            completeSchema.push(...encodeString('position',),);
            completeSchema.push(...encodeVarInt(-6,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(2,),);

            // Def 6: NodeChange (MESSAGE)
            completeSchema.push(...encodeString('NodeChange',),);
            completeSchema.push(2,); // MESSAGE
            completeSchema.push(...encodeVarUint(3,),);
            completeSchema.push(...encodeString('guid',),);
            completeSchema.push(...encodeVarInt(4,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);
            completeSchema.push(...encodeString('type',),);
            completeSchema.push(...encodeVarInt(2,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(4,),);
            completeSchema.push(...encodeString('name',),);
            completeSchema.push(...encodeVarInt(-6,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(5,),);

            // Def 7: Message (MESSAGE)
            completeSchema.push(...encodeString('Message',),);
            completeSchema.push(2,); // MESSAGE
            completeSchema.push(...encodeVarUint(4,),);
            // tag 1: type (MessageType ref)
            completeSchema.push(...encodeString('type',),);
            completeSchema.push(...encodeVarInt(0,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(1,),);
            // tag 2: sessionID (uint)
            completeSchema.push(...encodeString('sessionID',),);
            completeSchema.push(...encodeVarInt(-4,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(2,),);
            // tag 3: ackID (uint)
            completeSchema.push(...encodeString('ackID',),);
            completeSchema.push(...encodeVarInt(-4,),);
            completeSchema.push(0,);
            completeSchema.push(...encodeVarUint(3,),);
            // tag 4: nodeChanges (repeated NodeChange)
            completeSchema.push(...encodeString('nodeChanges',),);
            completeSchema.push(...encodeVarInt(6,),);
            completeSchema.push(1,);
            completeSchema.push(...encodeVarUint(4,),);

            const schema = parseKiwiSchema(new Uint8Array(completeSchema,),);

            // Build document data
            const doc: number[] = [];
            // Message tag 1 (type) = NODE_CHANGES (1)
            doc.push(...encodeVarUint(1,),); // tag
            doc.push(...encodeVarUint(1,),); // MessageType.NODE_CHANGES = 1
            // Message tag 2 (sessionID) = 0
            doc.push(...encodeVarUint(2,),);
            doc.push(...encodeVarUint(0,),);
            // Message tag 3 (ackID) = 0
            doc.push(...encodeVarUint(3,),);
            doc.push(...encodeVarUint(0,),);
            // Message tag 4 (nodeChanges): repeated, count prefix
            doc.push(...encodeVarUint(4,),);
            doc.push(...encodeVarUint(1,),); // 1 node change
            // NodeChange message:
            //   tag 1 (guid): GUID struct = sessionID=0, localID=5
            doc.push(...encodeVarUint(1,),); // tag
            doc.push(...encodeVarUint(0,),); // sessionID
            doc.push(...encodeVarUint(5,),); // localID
            //   tag 4 (type): NodeType.DOCUMENT = 1
            doc.push(...encodeVarUint(4,),); // tag
            doc.push(...encodeVarUint(1,),); // DOCUMENT
            //   tag 5 (name): "TestNode"
            doc.push(...encodeVarUint(5,),); // tag
            doc.push(...encodeString('TestNode',),);
            //   tag 0 (end of NodeChange)
            doc.push(0,);
            // tag 0 (end of Message)
            doc.push(0,);

            const result = decodeDocument(new Uint8Array(doc,), schema,);
            expect(result,).not.toBeNull();
            expect(result!.type,).toBe('MessageType.NODE_CHANGES',);
            expect(result!.sessionID,).toBe(0,);
            expect(result!.ackID,).toBe(0,);

            const nodeChanges = result!.nodeChanges as Record<string, unknown>[];
            expect(nodeChanges,).toHaveLength(1,);
            const nc = nodeChanges[0]!;
            expect(nc.type,).toBe('NodeType.DOCUMENT',);
            expect(nc.name,).toBe('TestNode',);

            const guid = nc.guid as Record<string, unknown>;
            expect(guid.sessionID,).toBe(0,);
            expect(guid.localID,).toBe(5,);
          },
        },),
      ],
    },),
    // endregion

    // region parseCanvasHeader
    describe({
      name: parseCanvasHeader.name,
      children: [
        it({
          name: 'parses fig magic',
          fn: async () => {
            const header = new Uint8Array([
              0x66,
              0x69,
              0x67,
              0x2D,
              0x6B,
              0x69,
              0x77,
              0x69,
              0x65,
              0x00, // "fig-kiwie\0"
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00, // reserved
            ],);
            const result = parseCanvasHeader(header,);
            expect(result.fileType,).toBe('fig',);
          },
        },),
        it({
          name: 'parses deck magic',
          fn: async () => {
            const header = new Uint8Array([
              0x66,
              0x69,
              0x67,
              0x2D,
              0x64,
              0x65,
              0x63,
              0x6B,
              0x65,
              0x00, // "fig-decke\0"
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
            ],);
            const result = parseCanvasHeader(header,);
            expect(result.fileType,).toBe('deck',);
          },
        },),
        it({
          name: 'parses jam magic',
          fn: async () => {
            const header = new Uint8Array([
              0x66,
              0x69,
              0x67,
              0x2D,
              0x6A,
              0x61,
              0x6D,
              0x2E,
              0x65,
              0x00, // "fig-jam.e\0"
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
            ],);
            const result = parseCanvasHeader(header,);
            expect(result.fileType,).toBe('jam',);
          },
        },),
        it({
          name: 'throws on unknown magic',
          fn: async () => {
            const header = new Uint8Array([
              0x58,
              0x59,
              0x5A,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
              0x00,
            ],);
            expect(function callWithBadMagic() {
              parseCanvasHeader(header,);
            },)
              .toThrow('Unknown canvas.fig magic',);
          },
        },),
        it({
          name: 'throws on too-short header',
          fn: async () => {
            expect(function callWithShortData() {
              parseCanvasHeader(new Uint8Array(8,),);
            },)
              .toThrow('too short',);
          },
        },),
      ],
    },),
    // endregion

    // region parseMetaJson
    describe({
      name: parseMetaJson.name,
      children: [
        it({
          name: 'parses client_meta fields',
          fn: async () => {
            const json = JSON.stringify({
              client_meta: {
                background_color: { r: 0.5, g: 0.6, b: 0.7, a: 1, },
                thumbnail_size: { width: 800, height: 600, },
                render_coordinates: { x: 0, y: 0, width: 1_024, height: 768, },
              },
              file_name: 'test-design',
              exported_at: '2025-01-01T00:00:00Z',
              developer_related_links: [],
            },);
            const bytes = new TextEncoder().encode(json,);
            const meta = parseMetaJson(bytes,);
            expect(meta.fileName,).toBe('test-design',);
            expect(meta.backgroundColor.r,).toBeCloseTo(0.5, 5,);
            expect(meta.thumbnailSize.width,).toBe(800,);
            expect(meta.renderCoordinates.width,).toBe(1_024,);
          },
        },),
        it({
          name: 'uses defaults for missing fields',
          fn: async () => {
            const json = JSON.stringify({},);
            const bytes = new TextEncoder().encode(json,);
            const meta = parseMetaJson(bytes,);
            expect(meta.fileName,).toBe('',);
            expect(meta.exportedAt,).toBe('',);
          },
        },),
      ],
    },),
    // endregion

    // region Integration: parseFigmaFile
    describe({
      name: 'integration: parseFigmaFile',
      children: [
        it({
          name: 'parses a .fig file end-to-end',
          timeout: 30_000,
          fn: async () => {
            const path =
              '/home/user/Nextcloud/Text/Reference/Figma export/Color palette - base.fig';
            const file = await parseFigmaFile(path,);
            expect(file.fileType,).toBe('fig',);
            expect(file.schema.definitions.length,).toBeGreaterThan(0,);
            expect(file.document,).not.toBeNull();
            expect(file.document!.type,).toBe('MessageType.NODE_CHANGES',);
            const nodeChanges = file.document!.nodeChanges as Record<string, unknown>[];
            expect(nodeChanges.length,).toBeGreaterThan(0,);
            expect(nodeChanges[0]!.type,).toBe('NodeType.DOCUMENT',);
          },
        },),
        it({
          name: 'parses a .deck file end-to-end',
          timeout: 30_000,
          fn: async () => {
            const path =
              '/home/user/Nextcloud/Text/Reference/Figma export/MTM6162-040 participation 2 cover.deck';
            const file = await parseFigmaFile(path,);
            expect(file.fileType,).toBe('deck',);
            expect(file.document,).not.toBeNull();
          },
        },),
        it({
          name: 'parses a .jam file end-to-end',
          timeout: 30_000,
          fn: async () => {
            const path =
              '/home/user/Nextcloud/Text/Reference/Figma export/Todo app - Brainstorming.jam';
            const file = await parseFigmaFile(path,);
            expect(file.fileType,).toBe('jam',);
            expect(file.document,).not.toBeNull();
          },
        },),
      ],
    },),
    // endregion
  ],
},);
