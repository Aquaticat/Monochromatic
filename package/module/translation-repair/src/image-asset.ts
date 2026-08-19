//region Image asset
// TURNING A PICTURE ON DISK INTO SOMETHING A CALL CAN CARRY, and refusing the
// ones that will not fit.
//
// The wire shape already exists: `ContentPart` in
// `@monochromatic-dev/module-llm-type` carries `image_url` with a data URI, so
// nothing here invents a protocol. What this decides is the media type and
// whether the picture is small enough to send at all.
//
// MEASURED OVER THE 284 ASSETS IN THE PINNED CORPUS: median 71 KiB, mean 154
// KiB, largest 1312 KiB. Base64 inflates by a third, so the largest would arrive
// as roughly 1.75 MiB of prompt, which does not fit the context of either model
// that reads images. The pictures the known transcripts describe are smaller,
// the largest being a 613 KiB letter, about 817 KiB encoded.
//
// REFUSING IS THE HONEST FAILURE, and this deliberately does not downscale to
// make a picture fit. `sharp` is in this workspace and downscaling is therefore
// available, but a shrunk photograph of handwriting is exactly the input that
// produces a confident wrong reading, which is the failure the whole reading
// rule exists to avoid. A refused picture falls back to protecting the block,
// which is where every transcript already stands.

/**
 * Media type per file extension, for the extensions the corpus uses.
 *
 * TWO ENTRIES BECAUSE THE CORPUS HAS TWO. Of 380 references, 376 are `.webp`
 * and 4 are `.jpg`. An extension not listed is refused rather than guessed at,
 * since sending a picture under the wrong media type asks a model to decode
 * something it was not given.
 */
const MEDIA_TYPES: Readonly<Record<string, string>> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// THE OLD CEILING WAS DERIVED AND IT MEASURED THE WRONG THING. It took half a
// model's context, converted tokens to characters at three each, and compared
// that against the picture's base64 length. Every step is defensible for TEXT
// and none of it describes an image: a vision model tokenizes by resolution, in
// tiles, and base64 length is an artefact of the compressor that can vary
// tenfold between two pictures of identical dimensions.
//
// MEASURED 2026-08-19, which is how it was caught. `gqt/photo1.webp` is 1274028
// bytes, more than four times the 294912 that derivation allowed for
// Qwen3.6-27B, and more than double that model's entire context once converted
// the way the derivation converted it. The provider accepted it and returned
// 2631 characters. Every asset in the corpus, up to the largest at 1344454
// bytes, is accepted at its natural size. So 45 of 191 pictures were refused
// here and never offered to any reader.
//
// A CEILING IS NOW THE CALLER'S TO SET, and its job is to stop a pathological
// upload rather than to predict a provider. Where the provider genuinely
// refuses, it says so, and that refusal costs one reading because
// `readImagePair` contains it.

/**
 * What encoding one asset produced.
 *
 * @example
 * ```ts
 * const encoded: EncodedAsset = { kind: 'usable', dataUri: 'data:image/webp;base64,…', };
 * ```
 */
export type EncodedAsset = {
  readonly kind: 'usable';

  /**
   * Data URI a content part carries.
   */
  readonly dataUri: string;
} | {
  readonly kind: 'refused';

  /**
   * Why it cannot be sent, so a finding names the reason rather than the
   * absence.
   */
  readonly reason: 'unknown-media-type' | 'too-large-for-model';
};

/**
 * Extension of a file name, lowercased, empty when it has none.
 *
 * @param assetName - file name
 *
 * @returns Its extension without the dot
 *
 * @example
 * ```ts
 * const extension = extensionOf({ assetName: 'intro.webp', },);
 * ```
 */
export function extensionOf({ assetName, }: { readonly assetName: string; },): string {
  /**
   * Where the extension begins, absent when the name carries no dot.
   */
  const dot = assetName.lastIndexOf('.',);
  if (dot === (-1))
    return '';
  return assetName.slice(dot + 1,)
    .toLowerCase();
}

/**
 * Encodes one picture for sending, or says why it cannot be sent.
 *
 * @param bytes - picture as read from disk
 *
 * @param assetName - its file name, which carries the media type
 *
 * @param maxBytes - most bytes this picture may occupy, which the CALLER
 * decides. Guessing what a provider accepts is not this function's job, and the
 * note above records what happened when it was
 *
 * @returns Data URI, or the reason it was refused
 *
 * @example
 * ```ts
 * const encoded = encodeImageAsset({ bytes, assetName, maxBytes, },);
 * ```
 */
export function encodeImageAsset(
  {
    bytes,
    assetName,
    maxBytes,
  }: {
    readonly bytes: Uint8Array;
    readonly assetName: string;
    readonly maxBytes: number;
  },
): EncodedAsset {
  /**
   * Media type this file name declares.
   */
  const mediaType = MEDIA_TYPES[extensionOf({ assetName, },)];
  if (mediaType === undefined) {
    return {
      kind: 'refused',
      reason: 'unknown-media-type',
    };
  }

  if (bytes.length > maxBytes) {
    return {
      kind: 'refused',
      reason: 'too-large-for-model',
    };
  }

  return {
    kind: 'usable',
    dataUri: `data:${mediaType};base64,${Buffer.from(bytes,)
      .toString('base64',)}`,
  };
}

//endregion Image asset
