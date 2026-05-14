// oxlint-disable prefer-destructuring -- utility module with array access patterns
import { readFile, } from 'node:fs/promises';
import {
  bufferToDataUri,
  inferFormat,
  isImageBase64,
  isImageBuffer,
  isImagePath,
  isImageUrl,
} from './encoding.ts';
import {
  l,
  tagged,
} from './log.ts';
import type { ImageInput, } from './types.ts';
import type { VoyageContentItem, } from './types.voyage-api.ts';

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
export async function toVoyageContentItem(
  input: ImageInput,
): Promise<VoyageContentItem> {
  const rl = tagged({
    tag: toVoyageContentItem.name,
    l,
  },);

  if (isImageUrl(input,)) {
    rl.debug(`using URL input: ${input.url}`,);
    return {
      type: 'image_url',
      image_url: input.url,
    };
  }

  if (isImageBase64(input,)) {
    rl.debug('using pre-encoded base64 input',);
    return {
      type: 'image_base64',
      image_base64: input.base64,
    };
  }

  if (isImageBuffer(input,)) {
    rl.debug(
      `encoding buffer (${
        String(input
          .buffer
          .byteLength,)
      } bytes, format: ${input.format})`,
    );
    const dataUri = bufferToDataUri({
      buffer: input.buffer,
      format: input.format,
    },);
    return {
      type: 'image_base64',
      image_base64: dataUri,
    };
  }

  if (isImagePath(input,)) {
    rl.debug(`reading file: ${input.path}`,);
    const format = inferFormat(input.path,);
    const fileBuffer = await readFile(input.path,);
    const dataUri = bufferToDataUri({
      buffer: fileBuffer.buffer,
      format,
    },);
    return {
      type: 'image_base64',
      image_base64: dataUri,
    };
  }

  throw new Error(
    'Unrecognized ImageInput variant: expected one of buffer, path, url, or base64',
  );
}
