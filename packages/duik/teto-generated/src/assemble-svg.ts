/**
 * SVG extraction and assembly for potrace output.
 *
 * Parses raw potrace SVG output and builds final positioned, colored SVG
 * documents with viewBox transforms applied.
 *
 * @module
 */
import {
  SCALE,
  VIEWBOX,
  X_OFFSET,
} from './config.ts';

/**
 * Parsed potrace SVG content with group transform and path data.
 */
export type PotraceContent = {
  readonly groupTransform: string;
  readonly paths: readonly string[];
};

/**
 * Extract all `<path>` elements from a potrace SVG string.
 *
 * Potrace outputs SVG with a transform on the root `<g>` element
 * that flips the y-axis. This function preserves that transform
 * by extracting the full `<g>` content.
 *
 * @param svg - Raw potrace SVG string
 *
 * @returns Object with extracted group transform and path data strings
 */
export function extractPotraceContent(svg: string,): PotraceContent {
  // Potrace wraps paths in: <g transform="..." fill="..." stroke="...">
  // The transform attribute may be followed by other attributes before the closing >
  const groupMatch = svg.match(/<g\s+transform="([^"]+)"/,);
  const groupTransform = groupMatch !== null && groupMatch[1] !== undefined
    ? groupMatch[1]
    : '';

  // Extract all path d attributes
  const pathRegex = /<path\s+d="([^"]+)"/g;
  const paths: string[] = [];
  let match = pathRegex.exec(svg,);
  while (match !== null) {
    if (match[1] !== undefined)
      paths.push(match[1],);
    match = pathRegex.exec(svg,);
  }

  return { groupTransform, paths, };
}

/**
 * Build a final part SVG with the viewBox transform applied.
 *
 * @param groupTransform - Potrace's y-flip transform
 *
 * @param paths - SVG path d-attribute strings
 *
 * @param fill - Fill color hex string
 *
 * @param name - Part name for the comment
 *
 * @returns Complete SVG document string
 */
export function buildPartSvg({
  groupTransform,
  paths,
  fill,
  name,
}: {
  readonly groupTransform: string;
  readonly paths: readonly string[];
  readonly fill: string;
  readonly name: string;
},): string {
  const pathElements = paths
    .map(function wrapPath(d,) {
      return `      <path d="${d}" fill="${fill}"/>`;
    },)
    .join('\n',);

  // The outer transform maps from crop-pixel-space to the 800x1200 viewBox:
  //   1. Apply potrace's y-flip (from its groupTransform)
  //   2. Scale uniformly by SCALE factor
  //   3. Translate to center horizontally
  //
  // Combined: translate(X_OFFSET, 0) scale(SCALE) [potrace transform]
  const TRANSLATE_PRECISION = 2;
  const SCALE_PRECISION = 4;
  const outerTransform = `translate(${X_OFFSET.toFixed(TRANSLATE_PRECISION,)}, 0) scale(${
    SCALE.toFixed(SCALE_PRECISION,)
  })`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}">`,
    `  <!-- ${name} - auto-generated from reference image -->`,
    `  <g transform="${outerTransform}">`,
    `    <g transform="${groupTransform}">`,
    pathElements,
    '    </g>',
    '  </g>',
    '</svg>',
    '',
  ]
    .join('\n',);
}
