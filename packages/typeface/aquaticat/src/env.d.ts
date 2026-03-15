// oxlint-disable -- ambient module declaration for untyped opentype.js library
declare module "opentype.js" {
  export class Path {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
    toPathData(decimalPlaces?: number): string;
  }

  export class Glyph {
    constructor(options: {
      name: string;
      unicode: number;
      advanceWidth: number;
      path: Path;
    });
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
    });
    download(): void;
    toArrayBuffer(): ArrayBuffer;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
