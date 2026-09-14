/**
 Media types for objects served through a path-suffixed URL.

 GitHub renders README images through its camo proxy, which refuses any
 response whose `Content-Type` is not an image type, so an object requested as
 `/<oid>/<path>.png` must answer with `image/png`. The extension is the only
 signal available: git-lfs uploads every object as `application/octet-stream`
 and R2 keeps no per-object metadata for them.

 @module
 */

/**
 Media type for objects whose extension is unknown or absent, matching what
 git-lfs itself sends.
 */
export const OCTET_STREAM = 'application/octet-stream';

/**
 Lowercase file extensions mapped to image media types. The set matches the
 raster formats `.gitattributes` routes through git-lfs.
 */
export const IMAGE_MEDIA_TYPES: ReadonlyMap<string, string> = new Map([
  [
    'png',
    'image/png',
  ],
  [
    'jpg',
    'image/jpeg',
  ],
  [
    'jpeg',
    'image/jpeg',
  ],
  [
    'gif',
    'image/gif',
  ],
  [
    'webp',
    'image/webp',
  ],
  [
    'avif',
    'image/avif',
  ],
  [
    'heif',
    'image/heif',
  ],
  [
    'jxl',
    'image/jxl',
  ],
],);

/**
 Media type for a path suffix, decided by its final extension.

 @param path - path suffix following the oid, possibly empty

 @returns image media type for a known extension, otherwise {@link OCTET_STREAM}

 @example
 ```ts
 mediaTypeForPath('package/music-player/asset/readme/desktop.png'); // 'image/png'
 mediaTypeForPath('cover.JPG'); // 'image/jpeg'
 mediaTypeForPath(''); // 'application/octet-stream'
 mediaTypeForPath('dir.v2/name'); // 'application/octet-stream'
 ```
 */
export function mediaTypeForPath(path: string,): string {
  /**
   Position of the final path separator; extensions live after it.
   */
  const lastSlash = path.lastIndexOf('/',);
  /**
   Position of the final dot; only a dot inside the last segment counts.
   */
  const lastDot = path.lastIndexOf('.',);
  if ((lastDot === (-1)) || (lastDot < lastSlash)
    || (lastDot === (path.length
      - 1))) {
    return OCTET_STREAM;
  }
  /**
   Extension without its dot, lowercased so `.PNG` matches too.
   */
  const extension = path
    .slice(lastDot + 1,)
    .toLowerCase();
  return IMAGE_MEDIA_TYPES.get(extension,) ?? OCTET_STREAM;
}
