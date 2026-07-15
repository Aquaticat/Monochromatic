/**
 * Kiwi schema parsing helpers.
 *
 * @example
 * ```ts
 * const schema = parseKiwiSchema(new Uint8Array([0]));
 * schema.definitions.length;
 * // 0
 * ```
 */

import {
  type BinaryReader,
  createBinaryReader,
} from './binary-reader.ts';
import {
  KIWI_PRIMITIVES,
  type KiwiDefinition,
  type KiwiEnum,
  type KiwiEnumField,
  type KiwiSchema,
  type KiwiStruct,
  type KiwiStructField,
} from './types.ts';

/**
 * Raw schema kind byte for enum definitions.
 */
const ENUM_KIND_BYTE = 0;

/**
 * Raw schema kind byte for struct definitions.
 */
const STRUCT_KIND_BYTE = 1;

/**
 * Raw schema kind byte for message definitions.
 */
const MESSAGE_KIND_BYTE = 2;

/**
 * Resolves a type code from the schema to a human-readable name.
 *
 * @param typeCode - Type code.
 *
 * @param schema - Parsed {@link KiwiSchema}.
 *
 * @returns Human-readable type name.
 *
 * @example
 * ```ts
 * resolveTypeName({ typeCode: -6, schema: parseKiwiSchema(new Uint8Array([0])) });
 * // 'string'
 * ```
 */
export function resolveTypeName(
  {
    typeCode,
    schema,
  }: {
    readonly schema: KiwiSchema;
    readonly typeCode: number;
  },
): string {
  if (typeCode < 0) {
    /**
     * Primitive table index recovered from Kiwi's inverted negative code.
     */
    const primitiveIndex = ~typeCode;
    /**
     * Primitive name, when the index is known.
     */
    const primitiveName = KIWI_PRIMITIVES[primitiveIndex];
    return primitiveName ?? `prim[${primitiveIndex}]`;
  }
  /**
   * Referenced schema definition, when present.
   */
  const definition = schema.definitions[typeCode];
  return definition === undefined ? `ref[${typeCode}]` : definition.name;
}

/**
 * Parses a Kiwi binary schema from decompressed bytes.
 *
 * @param data - Raw decompressed schema bytes.
 *
 * @returns Parsed {@link KiwiSchema} with definitions and lookup maps.
 *
 * @example
 * ```ts
 * parseKiwiSchema(new Uint8Array([0])).definitions.length;
 * // 0
 * ```
 */
export function parseKiwiSchema(data: Uint8Array,): KiwiSchema {
  /**
   * Cursor over schema bytes.
   */
  const reader = createBinaryReader({ data, },);
  /**
   * Definition count encoded at schema head.
   */
  const definitionCount = reader.readVarUint();
  /**
   * Parsed definitions in source order.
   */
  const definitions = parseDefinitions({
    reader,
    definitionCount,
  },);

  return {
    definitions,
    enumByName: new Map(definitions
      .filter(function enumDefinition(definition,): definition is KiwiEnum {
        return isKiwiEnum(definition,);
      },)
      .map(function enumEntry(definition,): readonly [
        string,
        KiwiEnum
      ] {
        return [
          definition.name,
          definition,
        ];
      },),),
    structByName: new Map(definitions
      .filter(function structDefinition(definition,): definition is KiwiStruct {
        return isKiwiStruct(definition,);
      },)
      .map(function structEntry(definition,): readonly [
        string,
        KiwiStruct
      ] {
        return [
          definition.name,
          definition,
        ];
      },),),
  };
}

/**
 * Returns whether definition is an enum.
 *
 * @param definition - Candidate {@link KiwiDefinition}.
 *
 * @returns Whether definition is a {@link KiwiEnum}.
 *
 * @example
 * ```ts
 * isKiwiEnum({ kind: 'ENUM', name: 'Kind', fields: [] });
 * // true
 * ```
 */
function isKiwiEnum(definition: KiwiDefinition,): definition is KiwiEnum {
  return definition.kind === 'ENUM';
}

/**
 * Returns whether definition is a struct or message.
 *
 * @param definition - Candidate {@link KiwiDefinition}.
 *
 * @returns Whether definition is a {@link KiwiStruct} (struct or message).
 *
 * @example
 * ```ts
 * isKiwiStruct({ kind: 'STRUCT', name: 'Point', fields: [] });
 * // true
 * ```
 */
function isKiwiStruct(definition: KiwiDefinition,): definition is KiwiStruct {
  return definition.kind !== 'ENUM';
}

/**
 * Parses all schema definitions.
 *
 * @param reader - {@link BinaryReader}.
 *
 * @param definitionCount - Definition count.
 *
 * @returns Parsed {@link KiwiDefinition} entries.
 *
 * @example
 * ```ts
 * parseDefinitions({ reader: createBinaryReader({ data: new Uint8Array([]) }), definitionCount: 0 });
 * // []
 * ```
 */
function parseDefinitions(
  {
    reader,
    definitionCount,
  }: {
    readonly definitionCount: number;
    readonly reader: BinaryReader;
  },
): readonly KiwiDefinition[] {
  /**
   * Accumulator for parsed definitions.
   */
  const definitions: KiwiDefinition[] = [];
  for (let definitionIndex = 0; definitionIndex < definitionCount; definitionIndex++) {
    definitions.push(parseDefinition({ reader, },),);
  }
  return definitions;
}

/**
 * Parses one schema definition.
 *
 * @param reader - {@link BinaryReader} positioned at a definition.
 *
 * @returns Parsed {@link KiwiDefinition}.
 *
 * @example
 * ```ts
 * parseDefinition({ reader: createBinaryReader({ data: new Uint8Array([0, 0, 0]) }) });
 * ```
 */
function parseDefinition({ reader, }: { readonly reader: BinaryReader; },): KiwiDefinition {
  /**
   * Definition name.
   */
  const name = reader.readString();
  /**
   * Raw kind byte.
   */
  const kindByte = reader.readByte();
  /**
   * Field count in definition body.
   */
  const fieldCount = reader.readVarUint();

  if (kindByte === ENUM_KIND_BYTE)
    return parseEnumDefinition({
      name,
      fieldCount,
      reader,
    },);
  if ((kindByte === STRUCT_KIND_BYTE) || (kindByte === MESSAGE_KIND_BYTE))
    return parseStructDefinition({
      name,
      fieldCount,
      reader,
      kind: kindByte === STRUCT_KIND_BYTE ? 'STRUCT' : 'MESSAGE',
    },);

  throw new Error(`Unknown Kiwi definition kind ${kindByte} for "${name}" at offset ${reader.pos}`);
}

/**
 * Parses one enum definition.
 *
 * @param name - Definition name.
 *
 * @param fieldCount - Field count.
 *
 * @param reader - {@link BinaryReader}.
 *
 * @returns Parsed {@link KiwiEnum} definition.
 *
 * @example
 * ```ts
 * parseEnumDefinition({ name: 'Kind', fieldCount: 0, reader: createBinaryReader({ data: new Uint8Array([]) }) });
 * ```
 */
function parseEnumDefinition(
  {
    name,
    fieldCount,
    reader,
  }: {
    readonly fieldCount: number;
    readonly name: string;
    readonly reader: BinaryReader;
  },
): KiwiEnum {
  /**
   * Parsed enum fields.
   */
  const fields: KiwiEnumField[] = [];
  for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex++) {
    fields.push(parseEnumField({ reader, },),);
  }
  return {
    fields,
    kind: 'ENUM',
    name,
  };
}

/**
 * Parses one enum field.
 *
 * @param reader - {@link BinaryReader} positioned at an enum field.
 *
 * @returns Parsed {@link KiwiEnumField}.
 *
 * @example
 * ```ts
 * parseEnumField({ reader: createBinaryReader({ data: new Uint8Array([0, 0, 0, 0]) }) });
 * ```
 */
function parseEnumField({ reader, }: { readonly reader: BinaryReader; },): KiwiEnumField {
  /**
   * Enum field label.
   */
  const name = reader.readString();
  reader.readVarInt();
  reader.readByte();
  return {
    isArray: false,
    name,
    value: reader.readVarUint(),
  };
}

/**
 * Parses one struct or message definition.
 *
 * @param name - Definition name.
 *
 * @param kind - Definition kind.
 *
 * @param fieldCount - Field count.
 *
 * @param reader - {@link BinaryReader}.
 *
 * @returns Parsed {@link KiwiStruct} (struct or message) definition.
 *
 * @example
 * ```ts
 * parseStructDefinition({ name: 'Point', kind: 'STRUCT', fieldCount: 0, reader: createBinaryReader({ data: new Uint8Array([]) }) });
 * ```
 */
function parseStructDefinition(
  {
    name,
    kind,
    fieldCount,
    reader,
  }: {
    readonly fieldCount: number;
    readonly kind: KiwiStruct['kind'];
    readonly name: string;
    readonly reader: BinaryReader;
  },
): KiwiStruct {
  /**
   * Parsed struct fields.
   */
  const fields: KiwiStructField[] = [];
  for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex++) {
    fields.push(parseStructField({ reader, },),);
  }
  return {
    fields,
    kind,
    name,
  };
}

/**
 * Parses one struct/message field.
 *
 * @param reader - {@link BinaryReader} positioned at a field.
 *
 * @returns Parsed {@link KiwiStructField}.
 *
 * @example
 * ```ts
 * parseStructField({ reader: createBinaryReader({ data: new Uint8Array([0, 0, 0, 0]) }) });
 * ```
 */
function parseStructField({ reader, }: { readonly reader: BinaryReader; },): KiwiStructField {
  /**
   * Struct field name.
   */
  const name = reader.readString();
  /**
   * Field type code.
   */
  const type = reader.readVarInt();
  /**
   * Repeated-field flag.
   */
  const isArray = (reader.readByte() & 1) === 1;
  return {
    isArray,
    name,
    type,
    value: reader.readVarUint(),
  };
}
