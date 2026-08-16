/**
 * Virtual filesystem the native TypeScript process reads current sources through.
 *
 * @module
 */

import { normalizeSemanticFileName, } from './semantic-file-name.ts';

/* oxlint-disable no-restricted-syntax/no-nullish-union -- TypeScript FileSystem callbacks require undefined fallback sentinels. */
/**
 * Overlay file text or TypeScript's real-filesystem delegation sentinel.
 */
type OverlayFileTextOrRealFileSystemFallback = string | undefined;

/**
 * Positive overlay presence or TypeScript's real-filesystem delegation sentinel.
 */
type OverlayPresenceOrRealFileSystemFallback = true | undefined;

/**
 * TypeScript filesystem callbacks answering from kept overlay text.
 */
export type SemanticOverlayFileSystem = {
  readonly readFile: (fileName: string,) => OverlayFileTextOrRealFileSystemFallback;
  readonly fileExists: (fileName: string,) => OverlayPresenceOrRealFileSystemFallback;
};

/**
 * Builds filesystem callbacks answering from overlay text, delegating everything else.
 *
 * Callbacks read through the live map rather than a copy, so text kept after this call is text the
 * native process can still read. Paths arrive spelled however TypeScript spells them, so each is
 * put into bridge source identity before lookup.
 *
 * @param overlays - Live overlay text keyed by normalized source path.
 *
 * @returns callbacks for `readFile` and `fileExists` over overlay text.
 *
 * @example
 * ```ts
 * new API({ cwd: process.cwd(), fs: overlayFileSystem({ overlays }) });
 * ```
 */
export function overlayFileSystem({
  overlays,
}: {
  readonly overlays: ReadonlyMap<string, string>;
},): SemanticOverlayFileSystem {
  return {
    /**
     * Reads virtual current-file content or delegates to TypeScript real filesystem.
     *
     * @param fileName - Path requested by native TypeScript process.
     *
     * @returns overlay content or undefined for real-filesystem fallback.
     */
    readFile: function readFileFromOverlayOrDelegate(
      fileName: string,
    ): OverlayFileTextOrRealFileSystemFallback {
      return overlays.get(normalizeSemanticFileName(fileName,),);
    },
    /**
     * Reports positive overlay presence or delegates unknown paths to real filesystem.
     *
     * @param fileName - Path requested by native TypeScript process.
     *
     * @returns true for overlay file or delegation sentinel for every other path.
     */
    fileExists: function reportOverlayPresenceOrDelegate(
      fileName: string,
    ): OverlayPresenceOrRealFileSystemFallback {
      return overlays.has(normalizeSemanticFileName(fileName,),) ? true : undefined;
    },
  };
}
/* oxlint-enable no-restricted-syntax/no-nullish-union */
