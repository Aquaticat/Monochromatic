/**
 * SVG parsing utilities for extracting glyph cells and path data from
 * the Aquaticat master glyph strip SVG exported from Figma.
 */

//region Types -- data extracted from the master SVG

/** Raw path data extracted from a single SVG `<path>` element. */
export type CellPath = {
  /** SVG path `d` attribute string. */
  d: string;
  /** Whether this path uses stroke rather than fill. */
  isStroked: boolean;
  /** Stroke width when `isStroked` is true, otherwise 0. */
  strokeWidth: number;
};

/** One glyph cell from the horizontal strip. */
export type Cell = {
  /** Absolute X offset of this cell in the master SVG. */
  xOffset: number;
  /** All path elements belonging to this cell. */
  paths: CellPath[];
};

//endregion Types

/** Extract an XML attribute value by name from a raw attribute string. */
function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}

/**
 * Parse the master glyph strip SVG and return one {@link Cell} per glyph position.
 * Cells are delimited by `<rect>` elements; all `<path>` elements between two
 * consecutive rects belong to the preceding cell.
 * @param svgContent - full SVG file content
 * @returns array of cells in strip order (left to right)
 */
export function parseSvg(svgContent: string): Cell[] {
  const cells: Cell[] = [];
  const elementRegex = /<(rect|path)\s+([^>]*?)\/>/g;

  // eslint-disable-next-line no-restricted-syntax -- regex exec loop is the idiomatic way to iterate matches
  for (let match = elementRegex.exec(svgContent); match !== null; match = elementRegex.exec(svgContent)) {
    const [, tag, attrs] = match;

    if (tag === "rect") {
      const transform = attr(attrs, "transform");
      const translateMatch = transform?.match(/translate\((\d+(?:\.\d+)?)\)/);
      const xOffset = translateMatch ? Number(translateMatch[1]) : 0;
      cells.push({ xOffset, paths: [] });
      continue;
    }

    // tag === "path"
    const d = attr(attrs, "d");
    if (d === undefined) continue;

    const strokeAttr = attr(attrs, "stroke");
    const isStroked = strokeAttr !== undefined && attr(attrs, "fill") === undefined;
    const strokeWidthStr = attr(attrs, "stroke-width");
    const strokeWidth = isStroked && strokeWidthStr !== undefined ? Number(strokeWidthStr) : 0;

    const currentCell = cells[cells.length - 1];
    if (currentCell !== undefined) {
      currentCell.paths.push({ d, isStroked, strokeWidth });
    }
  }

  return cells;
}

//region SVG path tokenization

/** Parsed absolute SVG path command (M/L/H/V/Z only). */
export type SVGPathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "H"; x: number }
  | { type: "V"; y: number }
  | { type: "Z" };

/**
 * Tokenize an SVG path `d` attribute into absolute commands.
 * Only handles M, L, H, V, Z (the commands used in the Aquaticat glyph SVG).
 * @param d - SVG path data string
 * @returns ordered list of path commands
 */
export function parseSvgPathD(d: string): SVGPathCommand[] {
  const commands: SVGPathCommand[] = [];
  const tokenRegex = /([MLHVZ])|(-?\d+(?:\.\d+)?)/g;

  // Mutable state tracking the current command letter while consuming coordinate tokens
  // -- let needed because the regex loop reassigns on each command letter encountered
  let currentCmd = "";

  // eslint-disable-next-line no-restricted-syntax -- regex exec loop
  for (let tok = tokenRegex.exec(d); tok !== null; tok = tokenRegex.exec(d)) {
    if (tok[1] !== undefined) {
      currentCmd = tok[1];
      if (currentCmd === "Z") commands.push({ type: "Z" });
      continue;
    }

    const num = Number(tok[2]);

    if (currentCmd === "M" || currentCmd === "L") {
      const yTok = tokenRegex.exec(d);
      if (yTok === null) break;
      commands.push({ type: currentCmd, x: num, y: Number(yTok[2]) });
    } else if (currentCmd === "H") {
      commands.push({ type: "H", x: num });
    } else if (currentCmd === "V") {
      commands.push({ type: "V", y: num });
    }
  }

  return commands;
}

//endregion SVG path tokenization
