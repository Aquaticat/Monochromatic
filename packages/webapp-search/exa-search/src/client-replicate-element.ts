/**
 * Clones `templateElement` the specified number of times and replaces all children of
 * `parentElement` with the clones.
 *
 * Inlined from the deprecated `@monochromatic-dev/module-es` DOM utility because the
 * original module has a broken import (`function.thunk.ts` was removed).
 *
 * @param templateElement - Element to clone as the repeating template
 *
 * @param parentElement - Container whose children are replaced with clones
 *
 * @param targetCount - Number of clones to produce; 0 removes all children
 */
export function replicateElementAsContentOf(
  templateElement: Element,
  parentElement: Element,
  targetCount: number,
): void {
  const clones = Array.from(
    { length: targetCount, },
    function cloneTemplate() {
      return templateElement.cloneNode(true,);
    },
  );

  parentElement.replaceChildren(...clones,);
}
