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

/**
 * Base64 characters a token is taken to be worth.
 *
 * AN ESTIMATE, STATED AS ONE. Tokenizers split base64 into runs of three to
 * four characters, and the low end is used because the cost of being wrong is
 * a call refused by the provider for length, which wastes the whole slice.
 */
const CHARS_PER_TOKEN = 3;

/**
 * Fraction of a model's context a picture may occupy.
 *
 * HALF, so the prompt, the source, the archive wording and the reply all have
 * the other half. A picture filling its context leaves no room to ask about it.
 */
const CONTEXT_SHARE = 0.5;

/**
 * Bytes base64 packs into each group it emits.
 */
const BASE64_INPUT_GROUP = 3;

/**
 * Characters base64 emits per group, padding included.
 */
const BASE64_OUTPUT_GROUP = 4;

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
 * Largest encoded picture a model of this context can be sent.
 *
 * @param contextLength - model's context window in tokens
 *
 * @returns Base64 characters that fit
 *
 * @example
 * ```ts
 * const room = encodedCharsThatFit({ contextLength: 262_144, },);
 * ```
 */
export function encodedCharsThatFit({ contextLength, }: { readonly contextLength: number; },): number {
  /**
   * Tokens a picture may occupy.
   */
  const tokens = contextLength * CONTEXT_SHARE;

  /**
   * Characters those tokens are worth.
   */
  const room = tokens * CHARS_PER_TOKEN;
  return Math.floor(room,);
}

/**
 * Encodes one picture for sending, or says why it cannot be sent.
 *
 * @param bytes - picture as read from disk
 *
 * @param assetName - its file name, which carries the media type
 *
 * @param contextLength - context of the model it would be sent to
 *
 * @returns Data URI, or the reason it was refused
 *
 * @example
 * ```ts
 * const encoded = encodeImageAsset({ bytes, assetName, contextLength, },);
 * ```
 */
export function encodeImageAsset(
  {
    bytes,
    assetName,
    contextLength,
  }: {
    readonly bytes: Uint8Array;
    readonly assetName: string;
    readonly contextLength: number;
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

  /**
   * How many base64 characters the picture becomes, which is four for every
   * three bytes, rounded up to the padded quantum.
   */
  const encodedChars = Math.ceil(bytes.length / BASE64_INPUT_GROUP,) * BASE64_OUTPUT_GROUP;
  if (encodedChars > encodedCharsThatFit({ contextLength, },)) {
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
