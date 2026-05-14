// Fixture: structural formatting violations.
// Expected violations:
//   tsdoc(multiline-blocks): single-line with tag
//   tsdoc(no-multi-asterisks): double asterisk
//   tsdoc(tag-lines): missing blank line before tag
//   tsdoc(empty-tags): modifier tag with content

/** @returns value */
function singleLineWithTag(): number {
  return 1;
}

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
