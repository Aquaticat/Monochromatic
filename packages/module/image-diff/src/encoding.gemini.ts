// oxlint-disable prefer-destructuring -- utility module with array access patterns
import type { ImageInput } from './types.ts';
import type { GeminiInlineData } from './types.gemini-api.ts';
import {
  bufferToBase64,
  inferFormat,
  isImageBase64,
  isImageBuffer,
  isImagePath,
  isImageUrl,
  parseDataUri,
} from './encoding.ts';
import { l, tagged } from './log.ts';
import { readFile } from 'node:fs/promises';

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
