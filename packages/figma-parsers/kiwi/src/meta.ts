/**
 * Figma meta.json parsing.
 *
 * @example
 * ```ts
 * parseMetaJson(new TextEncoder().encode('{}')).fileName;
 * // ''
 * ```
 */

import type { FigmaMeta, } from './types.ts';

/**
 * JSON object record.
 *
 * @example
 * ```ts
 * const record: JsonRecord = {};
 * ```
 */
type JsonRecord = Readonly<Record<string, unknown>>;

/**
 * Parses meta.json bytes into Figma metadata.
 *
 * @param jsonBytes - Raw bytes of meta.json.
 *
 * @returns Parsed {@link FigmaMeta} with defaults for absent fields.
 *
 * @example
 * ```ts
 * parseMetaJson(new TextEncoder().encode('{"file_name":"demo"}')).fileName;
 * // 'demo'
 * ```
 */
export function parseMetaJson(jsonBytes: Uint8Array,): FigmaMeta {
  /**
   * Parsed meta.json root.
   */
  const json = parseJsonRecord({ jsonBytes, },);
  /**
   * Nested client metadata block.
   */
  const clientMeta = recordProperty({
    record: json,
    key: 'client_meta',
  },);
  /**
   * Background color block.
   */
  const backgroundColor = recordProperty({
    record: clientMeta,
    key: 'background_color',
  },);
  /**
   * Thumbnail size block.
   */
  const thumbnailSize = recordProperty({
    record: clientMeta,
    key: 'thumbnail_size',
  },);
  /**
   * Render coordinates block.
   */
  const renderCoordinates = recordProperty({
    record: clientMeta,
    key: 'render_coordinates',
  },);

  return {
    backgroundColor: {
      a: numberProperty({
        record: backgroundColor,
        key: 'a',
        fallback: 1,
      },),
      b: numberProperty({
        record: backgroundColor,
        key: 'b',
        fallback: 1,
      },),
      g: numberProperty({
        record: backgroundColor,
        key: 'g',
        fallback: 1,
      },),
      r: numberProperty({
        record: backgroundColor,
        key: 'r',
        fallback: 1,
      },),
    },
    developerRelatedLinks: arrayProperty({
      record: json,
      key: 'developer_related_links',
    },),
    exportedAt: stringProperty({
      record: json,
      key: 'exported_at',
    },),
    fileName: stringProperty({
      record: json,
      key: 'file_name',
    },),
    renderCoordinates: {
      height: numberProperty({
        record: renderCoordinates,
        key: 'height',
        fallback: 0,
      },),
      width: numberProperty({
        record: renderCoordinates,
        key: 'width',
        fallback: 0,
      },),
      x: numberProperty({
        record: renderCoordinates,
        key: 'x',
        fallback: 0,
      },),
      y: numberProperty({
        record: renderCoordinates,
        key: 'y',
        fallback: 0,
      },),
    },
    thumbnailSize: {
      height: numberProperty({
        record: thumbnailSize,
        key: 'height',
        fallback: 0,
      },),
      width: numberProperty({
        record: thumbnailSize,
        key: 'width',
        fallback: 0,
      },),
    },
  };
}

/**
 * Parses JSON bytes into a record.
 *
 * @param jsonBytes - JSON bytes.
 *
 * @returns Parsed record, or empty record when root is not object.
 *
 * @example
 * ```ts
 * parseJsonRecord({ jsonBytes: new TextEncoder().encode('{}') });
 * // {}
 * ```
 */
function parseJsonRecord({ jsonBytes, }: { readonly jsonBytes: Uint8Array; },): JsonRecord {
  /**
   * Parsed unknown JSON root.
   */
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8',).decode(jsonBytes,),);
  return isRecord(parsed,) ? parsed : {};
}

/**
 * Returns whether value is a non-array record.
 *
 * @param value - Candidate value.
 *
 * @returns Whether value is a record.
 *
 * @example
 * ```ts
 * isRecord({});
 * // true
 * ```
 */
function isRecord(value: unknown,): value is JsonRecord {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Reads object property as record.
 *
 * @param record - Source record.
 *
 * @param key - Property key.
 *
 * @returns Nested record, or empty record when absent.
 *
 * @example
 * ```ts
 * recordProperty({ record: { child: {} }, key: 'child' });
 * // {}
 * ```
 */
function recordProperty(
  {
    record,
    key,
  }: {
    readonly key: string;
    readonly record: JsonRecord;
  },
): JsonRecord {
  /**
   * Property value.
   */
  const value = record[key];
  return isRecord(value,) ? value : {};
}

/**
 * Reads number property with fallback.
 *
 * @param record - Source record.
 *
 * @param key - Property key.
 *
 * @param fallback - Fallback value.
 *
 * @returns Number property or fallback.
 *
 * @example
 * ```ts
 * numberProperty({ record: { x: 1 }, key: 'x', fallback: 0 });
 * // 1
 * ```
 */
function numberProperty(
  {
    record,
    key,
    fallback,
  }: {
    readonly fallback: number;
    readonly key: string;
    readonly record: JsonRecord;
  },
): number {
  /**
   * Property value.
   */
  const value = record[key];
  return (typeof value) === 'number' ? value : fallback;
}

/**
 * Reads string property with empty-string fallback.
 *
 * @param record - Source record.
 *
 * @param key - Property key.
 *
 * @returns String property or empty string.
 *
 * @example
 * ```ts
 * stringProperty({ record: { name: 'demo' }, key: 'name' });
 * // 'demo'
 * ```
 */
function stringProperty(
  {
    record,
    key,
  }: {
    readonly key: string;
    readonly record: JsonRecord;
  },
): string {
  /**
   * Property value.
   */
  const value = record[key];
  return (typeof value) === 'string' ? value : '';
}

/**
 * Reads array property with empty-array fallback.
 *
 * @param record - Source record.
 *
 * @param key - Property key.
 *
 * @returns Array property or empty array.
 *
 * @example
 * ```ts
 * arrayProperty({ record: { links: [] }, key: 'links' });
 * // []
 * ```
 */
function arrayProperty(
  {
    record,
    key,
  }: {
    readonly key: string;
    readonly record: JsonRecord;
  },
): readonly unknown[] {
  /**
   * Property value.
   */
  const value = record[key];
  return Array.isArray(value,) ? value : [];
}
