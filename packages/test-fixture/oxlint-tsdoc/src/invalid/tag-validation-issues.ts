// Fixture: tag name and type annotation violations.
// Expected violations:
//   tsdoc(check-tag-names): JSDoc-only and unknown tags
//   tsdoc(check-access): conflicting access modifiers
//   tsdoc(no-types): JSDoc-style {Type} annotations

/**
 * @type {string}
 */
const jsdocTypeTag = 'hello';

/**
 * @typedef {object} Options
 */
type JsdocTypedefTag = { debug: boolean; };

/**
 * @return value
 */
function jsdocReturnTag(): number {
  return 1;
}

/**
 * @foobar unknown
 */
function unknownTag(): void {}

/**
 * Confusing access.
 *
 * @public
 * @internal
 */
function conflictingAccess(): void {}

/**
 * @param {string} name - with type
 */
function jsdocTypeAnnotation(name: string,): void {}

/**
 * @returns {number} the result
 */
function jsdocReturnType(): number {
  return 1;
}

export {};
