/**
 * File kind detection by extension.
 *
 * Maps file extensions to content categories for routing
 * binary files to the appropriate viewer.
 */

import { extname, } from 'node:path';

import type { FileKind, } from '../../protocol.ts';

/**
 * Extensions treated as raster/vector images (excludes SVG which is editable text).
 */
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.avif',
],);

/**
 * Extensions treated as audio.
 */
const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.m4a',
  '.opus',
],);

/**
 * Extensions treated as video.
 */
const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mkv',
  '.avi',
  '.mov',
],);

/**
 * Determines media kind from file extension.
 *
 * @param path - file path to check
 *
 * @returns media kind if the extension matches a known media type, null for text or unknown files
 *
 * @example
 * ```ts
 * const result = getMediaKind({ path: '/home/user/project/src/main.ts', });
 * ```
 */
export function getMediaKind(
  { path, }: { readonly path: string; },
): Extract<FileKind, 'image' | 'audio' | 'video'> | null {
  /**
   * Lowercased extension so the extension sets stay case-insensitive.
   */
  const ext = extname(path,)
    .toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext,))
    return 'image';
  if (AUDIO_EXTENSIONS.has(ext,))
    return 'audio';
  if (VIDEO_EXTENSIONS.has(ext,))
    return 'video';
  return null;
}

/**
 * MIME type mapping for media file extensions.
 */
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/opus',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
};

/**
 * Returns the MIME content type for a file path.
 *
 * @param path - file path to check
 *
 * @returns MIME type string, defaults to `application/octet-stream` for unknown extensions
 *
 * @example
 * ```ts
 * const result = getContentType({ path: '/home/user/project/src/main.ts', });
 * ```
 */
export function getContentType({ path, }: { readonly path: string; },): string {
  /**
   * Lowercased extension keyed against {@link CONTENT_TYPE_MAP} below.
   */
  const ext = extname(path,)
    .toLowerCase();
  return CONTENT_TYPE_MAP[ext]
    ?? 'application/octet-stream';
}
