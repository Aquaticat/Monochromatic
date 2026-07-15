// Fixture: structural formatting violations.
// Expected violations:
//   tsdoc(multiline-blocks): single-line with and without tag, including nested type property docs
//   tsdoc(no-multi-asterisks): double asterisk
//   tsdoc(tag-lines): missing blank line before tag
//   tsdoc(empty-tags): modifier tag with content

/** Description only. */
function singleLineWithoutTag(): void {}

/** @returns value */
function singleLineWithTag(): number {
  return 1;
}

/**
 * Shape with property-level structural issue.
 */
type SingleLinePropertyDoc = {
  /** Property description. */
  readonly value: string;
};

/**
 ** Double asterisk line.
 */
function doubleAsterisk(): void {}

/**
 * Description.
 * @returns without blank line
 */
function missingBlankBeforeTag(): number {
  return 1;
}

/**
 * @internal do not use this
 */
function modifierTagWithContent(): void {}

export {};
