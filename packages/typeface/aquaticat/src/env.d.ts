declare module 'opentype.js' {
  /* oxlint-disable no-restricted-syntax/no-class -- ambient declaration mirroring the untyped opentype.js library: it ships `new opentype.Path()`/`Glyph`/`Font` as real classes with mutable constructor-option params, so the shape is dictated by the external API, not our code */
  export class Path {
    moveTo(
      x: number,
      y: number,
    ): void;
    lineTo(
      x: number,
      y: number,
    ): void;
    close(): void;
    toPathData(decimalPlaces?: number,): string;
  }

  export class Glyph {
    constructor(options: {
      name: string;
      unicode: number;
      advanceWidth: number;
      path: Path;
    },);
    name: string;
    unicode: number;
    advanceWidth: number;
    path: Path;
  }

  export class Font {
    constructor(options: {
      familyName: string;
      styleName: string;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: Glyph[];
    },);
    download(): void;
    toArrayBuffer(): ArrayBuffer;
  }
  /* oxlint-enable no-restricted-syntax/no-class */

  export function parse(buffer: ArrayBuffer,): Font;

  /**
   * `cjs-module-lexer` can't statically detect opentype.js's named exports off its UMD bundle,
   * so `import * as opentype` leaves `opentype.Path`/`Glyph`/`Font` `undefined` at runtime.
   * A default import resolves to `module.exports` itself, where those members do exist.
   */
  const opentype: {
    Path: typeof Path;
    Glyph: typeof Glyph;
    Font: typeof Font;
    parse: typeof parse;
  };
  export default opentype;
}
