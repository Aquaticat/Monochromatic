/**
 * Ambient type declaration for `subset-font`, which ships without TypeScript
 * types. Modeled on the `subset-font` README and limited to the call shape
 * used by `src/build/subset-fonts.ts`.
 */
declare module 'subset-font' {
  /** Output font format produced by `subsetFont`. */
  type SubsetFontFormat = 'sfnt' | 'truetype' | 'woff' | 'woff2';

  /** Options accepted by `subsetFont`. */
  type SubsetFontOptions = {
    readonly targetFormat?: SubsetFontFormat;
    readonly preserveNameIds?: readonly number[];
    readonly variationAxes?: Readonly<Record<string, number | {
      min?: number;
      max?: number;
      default?: number;
    }>>;
    readonly noLayoutClosure?: boolean;
  };

  /**
   * Subsets a font to the glyphs required by `text`, returning the encoded
   * font in `options.targetFormat` (defaults to the input format).
   */
  function subsetFont(
    input: Buffer,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;

  export default subsetFont;
}
