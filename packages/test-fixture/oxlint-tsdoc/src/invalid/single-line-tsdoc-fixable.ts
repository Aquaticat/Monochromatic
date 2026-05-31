// Fixture: single-line TSDoc blocks fixable by tsdoc/multiline-blocks.

/** Description only. */
function singleLineDescription(): void {}

/** @returns value */
function singleLineTag(): number {
  return 1;
}

/**
 * Holds nested fixable TSDoc.
 */
function containsIndented(): void {
  /** Inner description. */
  const value = true;
  if (!value)
    return;
}

/**
 * Shape with fixable property doc.
 */
type PropertyFixture = {
  /** Property description. */
  readonly value: string;
};

/** */
const emptyDoc = true;

export {};
