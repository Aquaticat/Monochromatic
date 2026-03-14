// oxlint-disable prefer-destructuring, no-unnecessary-template-expression, no-magic-numbers -- utility module with array access patterns and MIME type detection
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import type {
  GeminiInlineData,
  ImageBase64,
  ImageBuffer,
  ImageFormat,
  ImageInput,
  ImagePath,
  ImageUrl,
  VoyageContentItem,
} from './types.ts';
import { l, tagged } from './log.ts';

/**
 * Extension-to-format mapping for inferring image format from file paths.
 */
const EXTENSION_FORMAT_MAP: Record<string, ImageFormat> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
  '.gif': 'gif',
};

/**
 * Type guard for {@link ImageBuffer} inputs.
 *
 * @param input - image input to test
 *
 * @returns whether the input contains a `buffer` property
 *
 * @example
 * ```ts
 * if (isImageBuffer(input)) {
 *   console.log(input.buffer.byteLength);
 * }
 * ```
 */
export function isImageBuffer(input: ImageInput): input is ImageBuffer {
  return 'buffer' in input;
}

/**
 * Type guard for {@link ImagePath} inputs.
 *
 * @param input - image input to test
 *
 * @returns whether the input contains a `path` property
 *
 * @example
 * ```ts
 * if (isImagePath(input)) {
 *   console.log(input.path);
 * }
 * ```
 */
export function isImagePath(input: ImageInput): input is ImagePath {
  return 'path' in input;
}

/**
 * Type guard for {@link ImageUrl} inputs.
 *
 * @param input - image input to test
 *
 * @returns whether the input contains a `url` property
 *
 * @example
 * ```ts
 * if (isImageUrl(input)) {
 *   console.log(input.url);
 * }
 * ```
 */
export function isImageUrl(input: ImageInput): input is ImageUrl {
  return 'url' in input;
}

/**
 * Type guard for {@link ImageBase64} inputs.
 *
 * @param input - image input to test
 *
 * @returns whether the input contains a `base64` property
 *
 * @example
 * ```ts
 * if (isImageBase64(input)) {
 *   console.log(input.base64.slice(0, 30));
 * }
 * ```
 */
export function isImageBase64(input: ImageInput): input is ImageBase64 {
  return 'base64' in input;
}

/**
 * Infer the {@link ImageFormat} from a file extension.
 *
 * @param filePath - path whose extension determines the format
 *
 * @returns inferred format
 *
 * @throws when the extension is not a recognized image format
 *
 * @example
 * ```ts
 * const fmt = inferFormat('/tmp/photo.png'); // 'png'
 * ```
 */
export function inferFormat(filePath: string): ImageFormat {
  const rl = tagged({ tag: inferFormat.name, l });
  const ext = extname(filePath).toLowerCase();
  const format = EXTENSION_FORMAT_MAP[ext];
  if (format === undefined) {
    throw new Error(`Unsupported image extension "${ext}" for path "${filePath}". Supported: ${Object.keys(EXTENSION_FORMAT_MAP).join(', ')}`);
  }
  rl.debug(`inferred format "${format}" from extension "${ext}"`);
  return format;
}

/**
 * Convert an {@link ArrayBuffer} to a raw base64 string (no data URI prefix).
 *
 * @param buffer - raw image bytes
 *
 * @returns base64-encoded string
 *
 * @example
 * ```ts
 * const b64 = bufferToBase64(bytes);
 * ```
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

/**
 * Convert an {@link ArrayBuffer} to a base64-encoded data URI string.
 *
 * @param buffer - raw image bytes
 *
 * @param format - image format for the media type prefix
 *
 * @returns data URI like `data:image/png;base64,...`
 *
 * @example
 * ```ts
 * const uri = bufferToDataUri(bytes, 'png');
 * // 'data:image/png;base64,iVBOR...'
 * ```
 */
export function bufferToDataUri(buffer: ArrayBuffer, format: ImageFormat): string {
  const rl = tagged({ tag: bufferToDataUri.name, l });
  const base64 = bufferToBase64(buffer);
  rl.debug(`encoded ${String(new Uint8Array(buffer).length)} bytes as base64 data URI`);
  return `data:image/${format};base64,${base64}`;
}

/**
 * Parse a data URI string into its raw base64 data and MIME type.
 *
 * @param dataUri - full data URI (e.g. `data:image/png;base64,iVBOR...`)
 *
 * @returns parsed mime type and raw base64 data
 *
 * @throws when the data URI format is not recognized
 *
 * @example
 * ```ts
 * const { mimeType, data } = parseDataUri('data:image/png;base64,iVBOR...');
 * // mimeType === 'image/png', data === 'iVBOR...'
 * ```
 */
export function parseDataUri(dataUri: string): { mimeType: string; data: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(`Invalid data URI format: expected "data:<mime>;base64,<data>", got "${dataUri.slice(0, 50)}..."`);
  }
  return { mimeType: match[1], data: match[2] };
}

/**
 * Normalize any {@link ImageInput} variant into a {@link VoyageContentItem}
 * suitable for the Voyage AI multimodal embeddings API.
 *
 * - {@link ImageUrl} maps to `image_url` content type
 * - {@link ImageBase64} maps to `image_base64` content type
 * - {@link ImageBuffer} is base64-encoded and maps to `image_base64`
 * - {@link ImagePath} is read from disk, base64-encoded, and maps to `image_base64`
 *
 * @param input - image in any supported format
 *
 * @returns content item ready for the API request
 *
 * @example
 * ```ts
 * const item = await toVoyageContentItem({ path: 'photo.png' });
 * // { type: 'image_base64', image_base64: 'data:image/png;base64,...' }
 * ```
 */
export async function toVoyageContentItem(input: ImageInput): Promise<VoyageContentItem> {
  const rl = tagged({ tag: toVoyageContentItem.name, l });

  if (isImageUrl(input)) {
    rl.debug(`using URL input: ${input.url}`);
    return { type: 'image_url', image_url: input.url };
  }

  if (isImageBase64(input)) {
    rl.debug('using pre-encoded base64 input');
    return { type: 'image_base64', image_base64: input.base64 };
  }

  if (isImageBuffer(input)) {
    rl.debug(`encoding buffer (${String(input.buffer.byteLength)} bytes, format: ${input.format})`);
    const dataUri = bufferToDataUri(input.buffer, input.format);
    return { type: 'image_base64', image_base64: dataUri };
  }

  if (isImagePath(input)) {
    rl.debug(`reading file: ${input.path}`);
    const format = inferFormat(input.path);
    const fileBuffer = await readFile(input.path);
    const dataUri = bufferToDataUri(fileBuffer.buffer, format);
    return { type: 'image_base64', image_base64: dataUri };
  }

  throw new Error('Unrecognized ImageInput variant: expected one of buffer, path, url, or base64');
}

/**
 * Normalize any {@link ImageInput} variant into a {@link GeminiInlineData}
 * suitable for the Gemini embedContent API.
 *
 * Gemini requires raw base64 data (no data URI prefix) and an explicit MIME type.
 * URL inputs are fetched and converted to inline data.
 *
 * @param input - image in any supported format
 *
 * @returns inline data ready for the Gemini API request
 *
 * @example
 * ```ts
 * const item = await toGeminiInlineData({ path: 'photo.png' });
 * // { mime_type: 'image/png', data: 'iVBOR...' }
 * ```
 */
export async function toGeminiInlineData(input: ImageInput): Promise<GeminiInlineData> {
  const rl = tagged({ tag: toGeminiInlineData.name, l });

  if (isImageUrl(input)) {
    rl.debug(`fetching URL for Gemini inline data: ${input.url}`);
    const response = await fetch(input.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image URL "${input.url}": ${String(response.status)}`);
    }
    const contentType = response.headers.get('content-type') ?? 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const data = bufferToBase64(arrayBuffer);
    return { mime_type: contentType, data };
  }

  if (isImageBase64(input)) {
    rl.debug('parsing data URI for Gemini inline data');
    const { mimeType, data } = parseDataUri(input.base64);
    return { mime_type: mimeType, data };
  }

  if (isImageBuffer(input)) {
    rl.debug(`encoding buffer for Gemini (${String(input.buffer.byteLength)} bytes, format: ${input.format})`);
    const data = bufferToBase64(input.buffer);
    return { mime_type: `image/${input.format}`, data };
  }

  if (isImagePath(input)) {
    rl.debug(`reading file for Gemini: ${input.path}`);
    const format = inferFormat(input.path);
    const fileBuffer = await readFile(input.path);
    const data = bufferToBase64(fileBuffer.buffer);
    return { mime_type: `image/${format}`, data };
  }

  throw new Error('Unrecognized ImageInput variant: expected one of buffer, path, url, or base64');
}

/**
 * Convert any {@link ImageInput} variant into a URI string suitable for
 * OpenAI-compatible vision APIs (regular URL or base64 data URI).
 *
 * - {@link ImageUrl} passes through as-is
 * - {@link ImageBase64} passes through as-is (already a data URI)
 * - {@link ImageBuffer} is base64-encoded into a data URI
 * - {@link ImagePath} is read from disk and base64-encoded into a data URI
 *
 * @param input - image in any supported format
 *
 * @returns URL or data URI string
 *
 * @example
 * ```ts
 * const uri = await toImageUri({ path: 'photo.png' });
 * // 'data:image/png;base64,iVBOR...'
 * ```
 */
export async function toImageUri(input: ImageInput): Promise<string> {
  const rl = tagged({ tag: toImageUri.name, l });

  if (isImageUrl(input)) {
    rl.debug(`passing through URL: ${input.url}`);
    return input.url;
  }

  if (isImageBase64(input)) {
    rl.debug('passing through base64 data URI');
    return input.base64;
  }

  if (isImageBuffer(input)) {
    rl.debug(`encoding buffer as data URI (${String(input.buffer.byteLength)} bytes, format: ${input.format})`);
    return bufferToDataUri(input.buffer, input.format);
  }

  if (isImagePath(input)) {
    rl.debug(`reading file as data URI: ${input.path}`);
    const format = inferFormat(input.path);
    const fileBuffer = await readFile(input.path);
    return bufferToDataUri(fileBuffer.buffer, format);
  }

  throw new Error('Unrecognized ImageInput variant: expected one of buffer, path, url, or base64');
}
