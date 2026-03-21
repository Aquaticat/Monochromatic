/**
 * Measures rendered inlay hint heights for line number alignment.
 *
 * After `::before` hints are rendered, their actual pixel heights
 * vary based on content wrapping. This module reads the computed
 * `::before` height and sets `--line-num-offset` so the absolutely
 * positioned line number aligns with the code, not the hint.
 */

/**
 * Measures each annotated div's `::before` height and sets `--line-num-offset`
 * so the line number aligns with the code, not the hint.
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
  }
}
