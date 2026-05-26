/**
 * SVG parsing utilities for extracting glyph cells and path data from
 * the Aquaticat master glyph strip SVG exported from Figma.
 */

import {
  ABSENT,
  type Maybe,
} from './maybe.ts';

//region Types: data extracted from the master SVG

/** Raw path data extracted from a single SVG `<path>` element. */
export type CellPath = {
  /** SVG path `d` attribute string. */
  readonly d: string;
  /** Whether this path uses stroke rather than fill. */
  readonly isStroked: boolean;
  /** Stroke width when `isStroked` is true, otherwise 0. */
  readonly strokeWidth: number;
};

/** One glyph cell from the horizontal strip. */
export type Cell = {
  /** Absolute X offset of this cell in the master SVG. */
  xOffset: number;
  /** All path elements belonging to this cell. */
  paths: CellPath[];
};

//endregion Types

/**
 * Extracts an XML attribute value by name from a raw attribute string.
 *
 * @param attrs - raw XML attribute string to search
 *
 * @param name - attribute name to extract
 *
 * @returns attribute value, or {@link ABSENT} if not found
 *
 * @example
 * ```ts
 * attr({ attrs: 'fill="red" stroke="black"', name: 'fill' }); // 'red'
 * ```
 */
function attr({
  attrs,
  name,
}: {
  readonly attrs: string;
  readonly name: string;
},): Maybe<string> {
  /** Literal token to locate; the value starts immediately after this prefix. */
  const needle = `${name}="`;
  /** Index of the first occurrence of `name="`; -1 when the attribute is absent. */
  const start = attrs.indexOf(needle,);
  if (start === (-1))
    return ABSENT;
  /** First char of the value, just past the `"` opener. */
  const valueStart = start + needle
    .length;
  /** Closing-quote position bounded by value start; -1 when the SVG is malformed. */
  const valueEnd = attrs.indexOf(
    '"',
    valueStart,
  );
  if (valueEnd === (-1))
    return ABSENT;
  return attrs.slice(
    valueStart,
    valueEnd,
  );
}

/**
 * Parse the master glyph strip SVG and return one {@link Cell} per glyph position.
 * Cells are delimited by `<rect>` elements; all `<path>` elements between two
 * consecutive rects belong to the preceding cell.
 *
 * @param svgContent - full SVG file content
 *
 * @returns array of cells in strip order (left to right)
 *
 * @example
 * ```ts
 * const cells = parseSvg(svgContent);
 * cells[0].xOffset; // X position of first glyph cell
 * ```
 */
export function parseSvg(svgContent: string,): Cell[] {
  /** Accumulator of parsed cells, filled in strip order as `<rect>` tags are encountered. */
  const cells: Cell[] = [];
  /* oxlint-disable no-restricted-syntax/no-regex -- SVG element tokenizer scoped to two literal tag names; lazy `([^>]*?)` is bounded by the next `/>` and the input is a Figma-exported master strip (bounded size). Linear: every char is visited at most twice across the alternation. */
  /** Matches a self-closing `<rect ... />` or `<path ... />` tag and captures its tag name and attributes. */
  const elementRegex = /<(rect|path)\s+([^>]*?)\/>/gu;
  /* oxlint-enable no-restricted-syntax/no-regex */

  for (let match = elementRegex.exec(svgContent,); match !== null;
    match = elementRegex.exec(svgContent,))
  {
    /** Captured `tag` and `attrs` from the current match; index 0 is the whole match. */
    const [, tag, attrs,] = match;
    if (attrs === undefined)
      continue;

    if (tag === 'rect') {
      /** Raw `transform` attribute value, expected to be `translate(<x>)` for cell rects. */
      const transform = attr({
        attrs,
        name: 'transform',
      },);
      /* oxlint-disable no-restricted-syntax/no-regex -- canonical SVG `translate(N)` shape parser; the input is one attribute value bounded by the SVG element tokenizer above. No nested quantifiers; `\d+(?:\.\d+)?` is linear in the number's digit count. */
      /** Matches the `translate(N)` transform shape; capture group 1 is the numeric X offset. */
      const translateRegex = /translate\((\d+(?:\.\d+)?)\)/u;
      /* oxlint-enable no-restricted-syntax/no-regex */
      /** Captured numeric argument of the `translate(...)` transform; null when the attribute is absent or does not match. */
      const translateMatch = transform === ABSENT
        ? null
        : translateRegex.exec(transform,);
      /** Parsed X offset of this cell rect; falls back to 0 when no translate is present. */
      const xOffset = translateMatch !== null
        ? Number(translateMatch[1]
          ?? '0',)
        : 0;
      cells.push({
        xOffset,
        paths: [],
      },);
      continue;
    }

    // tag === "path"
    /** Raw SVG path `d` attribute string for the current `<path>` element. */
    const d = attr({
      attrs,
      name: 'd',
    },);
    if (d === ABSENT)
      continue;

    /** Raw `stroke` attribute value used to discriminate stroked paths from filled ones. */
    const strokeAttr = attr({
      attrs,
      name: 'stroke',
    },);
    /** True when the path has a stroke but no fill, indicating it must be expanded into an outline. */
    const isStroked = (strokeAttr !== ABSENT) && (attr({
      attrs,
      name: 'fill',
    },)
      === ABSENT);
    /** Raw `stroke-width` attribute string; parsed only when the path is actually stroked. */
    const strokeWidthStr = attr({
      attrs,
      name: 'stroke-width',
    },);
    /** Numeric stroke width in SVG units; 0 for filled paths so downstream code skips expansion. */
    const strokeWidth = isStroked && (strokeWidthStr !== ABSENT)
      ? Number(strokeWidthStr,)
      : 0;

    /** Most recently pushed cell, which owns every `<path>` until the next `<rect>` appears. */
    const currentCell = cells.at(-1,);
    if (currentCell !== undefined) {
      currentCell.paths
        .push({
        d,
        isStroked,
        strokeWidth,
      },);
    }
  }

  return cells;
}

//region SVG path tokenization

/** Parsed absolute SVG path command (M/L/H/V/Z only). */
export type SVGPathCommand =
  | {
    readonly type: 'M';
    readonly x: number;
    readonly y: number;
  }
  | {
    readonly type: 'L';
    readonly x: number;
    readonly y: number;
  }
  | {
    readonly type: 'H';
    readonly x: number;
  }
  | {
    readonly type: 'V';
    readonly y: number;
  }
  | { readonly type: 'Z'; };

/**
 * Tokenize an SVG path `d` attribute into absolute commands.
 * Only handles M, L, H, V, Z (the commands used in the Aquaticat glyph SVG).
 *
 * @param d - SVG path data string
 *
 * @returns ordered list of path commands
 *
 * @example
 * ```ts
 * const commands = parseSvgPathD('M0 0 L10 10 Z');
 * // [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 10, y: 10 }, { type: 'Z' }]
 * ```
 */
export function parseSvgPathD(d: string,): SVGPathCommand[] {
  /** Accumulator of parsed commands, returned to the caller in path order. */
  const commands: SVGPathCommand[] = [];
  /* oxlint-disable no-restricted-syntax/no-regex -- SVG path tokenizer; the alternation either matches one command letter or one signed decimal in linear time, and the input is a bounded `d=` attribute value (Aquaticat master strip). No backtracking risk on either branch. */
  /** Matches either a command letter (M/L/H/V/Z) or a signed decimal number. */
  const tokenRegex = /([MLHVZ])|(-?\d+(?:\.\d+)?)/gu;
  /* oxlint-enable no-restricted-syntax/no-regex */

  /**
   * Last command letter seen, which determines how subsequent number tokens are consumed.
   *
   * Declared as `let` because the regex loop reassigns it whenever a new command
   * letter is matched; coordinate tokens between letters apply to whatever letter
   * was set most recently.
   */
  let currentCmd = '';

  for (let tok = tokenRegex.exec(d,); tok !== null; tok = tokenRegex.exec(d,)) {
    /** Captured command letter (group 1) from the current token, undefined when the token is a number. */
    const [, commandLetter,] = tok;
    if (commandLetter !== undefined) {
      currentCmd = commandLetter;
      if (currentCmd === 'Z')
        commands.push({ type: 'Z', },);
      continue;
    }

    /** Numeric value of the current number token (group 2 of `tokenRegex`). */
    const num = Number(tok[2],);

    if ((currentCmd === 'M') || (currentCmd === 'L')) {
      /** Y coordinate token paired with the just-consumed X for M/L commands. */
      const yTok = tokenRegex.exec(d,);
      if (yTok === null)
        break;
      commands.push({
        type: currentCmd,
        x: num,
        y: Number(yTok[2],),
      },);
    }
    else if (currentCmd === 'H') {
      commands.push({
        type: 'H',
        x: num,
      },);
    }
    else if (currentCmd === 'V') {
      commands.push({
        type: 'V',
        y: num,
      },);
    }
  }

  return commands;
}

//endregion SVG path tokenization
