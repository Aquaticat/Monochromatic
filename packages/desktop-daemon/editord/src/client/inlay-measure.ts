/**
 * Post-layout measurement for inlay hint positioning.
 *
 * After `::before` hints are rendered, measures two things:
 * 1. The `::before` height, used to offset line numbers via `--line-num-offset`
 * 2. The actual rendered x-position of the target character, used to
 *    correct `--inlay-indent` from the initial `ch` approximation to a
 *    pixel-accurate value that accounts for line wrapping.
 */

/** Node type constant for text nodes. */
const TEXT_NODE = 3;

/**
 * Measures the rendered x-position of a character in a line div's text node.
 * Uses the Range API to find where the character actually renders,
 * which differs from `ch`-unit estimates when the line wraps.
 *
 * @param div - line div element
 *
 * @param charOffset - 0-based character offset to measure
 *
 * @returns pixel offset from the div's content box start, or null if unmeasurable
 */
function measureCharX({ div, charOffset, }: {
  div: HTMLElement;
  charOffset: number;
}): number | null {
  const textNode = div.firstChild;
  if (textNode === null || textNode.nodeType !== TEXT_NODE)
    return null;

  const nodeLength = textNode.textContent?.length ?? 0;
  if (nodeLength === 0)
    return null;

  const clamped = Math.min(charOffset, nodeLength,);
  const range = document.createRange();
  range.setStart(textNode, clamped,);
  range.setEnd(textNode, clamped,);

  const charRect = range.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const paddingInlineStart = Number.parseFloat(getComputedStyle(div,).paddingInlineStart,);

  return charRect.left - divRect.left - paddingInlineStart;
}

/**
 * Measures each annotated div's `::before` height and target character x-position.
 * Sets `--line-num-offset` so the line number aligns with the code text,
 * and corrects `--inlay-indent` from the initial `ch` approximation to a
 * pixel-measured value that follows line wrapping.
 *
 * Must be called after layout (e.g. in a follow-up requestAnimationFrame).
 *
 * @param editor - contenteditable container element
 */
export function measureInlayOffsets({ editor, }: { editor: HTMLElement }): void {
  for (const child of editor.children) {
    if (!(child instanceof HTMLElement) || child.dataset.inlay === undefined)
      continue;

    const beforeHeight = getComputedStyle(child, '::before',).height;
    if (beforeHeight !== 'auto' && beforeHeight !== '0px') {
      child.style.setProperty('--line-num-offset', beforeHeight,);
    }

    const charAttr = child.dataset.inlayChar;
    if (charAttr !== undefined) {
      const charOffset = Number(charAttr,);
      const xPx = measureCharX({ div: child, charOffset, },);
      if (xPx !== null) {
        child.style.setProperty('--inlay-indent', `${String(Math.max(0, xPx,),)}px`,);
      }
    }
  }
}
