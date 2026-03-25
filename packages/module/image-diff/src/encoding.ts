// oxlint-disable prefer-destructuring, no-unnecessary-template-expression, no-magic-numbers -- utility module with array access patterns and MIME type detection
import { extname, } from 'node:path';

import {
  l,
  tagged,
} from './log.ts';
import type {
  ImageBase64,
  ImageBuffer,
  ImageFormat,
  ImageInput,
  ImagePath,
  ImageUrl,
} from './types.ts';

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
export function isImageBuffer(input: ImageInput,): input is ImageBuffer {
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
export function isImagePath(input: ImageInput,): input is ImagePath {
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
export function isImageUrl(input: ImageInput,): input is ImageUrl {
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
export function isImageBase64(input: ImageInput,): input is ImageBase64 {
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
export function inferFormat(filePath: string,): ImageFormat {
  const rl = tagged({
    tag: inferFormat.name,
    l,
  },);
  const ext = extname(filePath,).toLowerCase();
  const format = EXTENSION_FORMAT_MAP[ext];
  if (format === undefined) {
    throw new Error(
      `Unsupported image extension "${ext}" for path "${filePath}". Supported: ${
        Object
          .keys(EXTENSION_FORMAT_MAP,)
          .join(', ',)
      }`,
    );
  }
  rl.debug(`inferred format "${format}" from extension "${ext}"`,);
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
export function bufferToBase64(buffer: ArrayBuffer,): string {
  const bytes = new Uint8Array(buffer,);
  let binary = '';
  for (const byte of bytes)
    binary += String.fromCodePoint(byte,);
  return btoa(binary,);
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
export function bufferToDataUri(
  buffer: ArrayBuffer,
  format: ImageFormat,
): string {
  const rl = tagged({
    tag: bufferToDataUri.name,
    l,
  },);
  const base64 = bufferToBase64(buffer,);
  rl.debug(
    `encoded ${String(new Uint8Array(buffer,).length,)} bytes as base64 data URI`,
  );
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
export function parseDataUri(dataUri: string,): {
  mimeType: string;
  data: string
} {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/,);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(
      `Invalid data URI format: expected "data:<mime>;base64,<data>", got "${
        dataUri.slice(
          0,
          50,
        )
      }..."`,
    );
  }
  return {
    mimeType: match[1],
    data: match[2],
  };
}
