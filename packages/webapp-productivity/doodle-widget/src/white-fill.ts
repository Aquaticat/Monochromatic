/**
 * White fill detection and removal for SVG processing.
 *
 * Provides both regex-based (string) and DOM-based detection
 * of white fills in SVG markup, used by the client-side
 * background module to make large white backgrounds transparent
 * so canvas strokes show through beneath the SVG linework.
 */

/**
 * Regex matching white fill declarations in inline `style` attributes.
 *
 * Matches `fill:#fff` and `fill:#ffffff` followed by a style delimiter
 * (`;`, `"`, whitespace) or end-of-string. The lookahead prevents
 * partial matches against non-white hex colors like `#ffff00`.
 *
 * @example
 * ```ts
 * 'fill:#ffffff;stroke:#000'.match(WHITE_FILL_RE); // ['fill:#ffffff']
 * 'fill:#ffff00'.match(WHITE_FILL_RE);             // null (not white)
 * ```
 */
export const WHITE_FILL_RE = /fill:#fff(?:fff)?(?=[;"\s]|$)/gu;

/**
 * White fill attribute values recognized on SVG elements.
 *
 * Covers hex shorthand, hex full, named color, and RGB notation.
 * Values should be compared after lowercasing and whitespace removal.
 */
export const WHITE_FILL_ATTRS: ReadonlySet<string> = new Set([
  '#fff',
  '#ffffff',
  'white',
  'rgb(255,255,255)',
],);

/**
 * Checks whether an SVG element has a white fill via inline style
 * or `fill` attribute.
 *
 * @param element - SVG element to inspect
 *
 * @returns `true` when the element has a white fill
 *
 * @example
 * ```ts
 * const path = doc.querySelector('path');
 * if (hasWhiteFill(path)) clearWhiteFill(path);
 * ```
 */
export function hasWhiteFill(element: Element,): boolean {
  /** Check inline style for white fill declaration */
  const style = element.getAttribute('style',) ?? '';
  WHITE_FILL_RE.lastIndex = 0;
  if (WHITE_FILL_RE.test(style,)) {
    WHITE_FILL_RE.lastIndex = 0;
    return true;
  }

  /** Check fill attribute against known white values */
  const fill = (element.getAttribute('fill',) ?? '').toLowerCase().replaceAll(
    /\s/gu,
    '',
  );
  return WHITE_FILL_ATTRS.has(fill,);
}

/**
 * Replaces white fill on an element with `fill:none`, handling both
 * inline `style` declarations and standalone `fill` attributes.
 *
 * @param element - SVG element whose white fill to clear
 *
 * @example
 * ```ts
 * clearWhiteFill(pathElement); // fill:#ffffff -> fill:none
 * ```
 */
export function clearWhiteFill(element: Element,): void {
  /** Replace white fill in inline style */
  const style = element.getAttribute('style',);
  if (style) {
    WHITE_FILL_RE.lastIndex = 0;
    const replaced = style.replaceAll(
      WHITE_FILL_RE,
      'fill:none',
    );
    if (replaced !== style)
      element.setAttribute(
        'style',
        replaced,
      );
  }

  /** Replace white fill attribute */
  const fill = (element.getAttribute('fill',) ?? '').toLowerCase().replaceAll(
    /\s/gu,
    '',
  );
  if (WHITE_FILL_ATTRS.has(fill,))
    element.setAttribute(
      'fill',
      'none',
    );
}
