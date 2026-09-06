// Fixture: star-less TSDoc for require-asterisk-prefix in never mode.
// Expected: zero stylistic/require-asterisk-prefix violations under never mode.

/**
 Star-less description.

 **Leading bold** remains literal content.

 *through* remains literal content.

 @example
 ```ts
 readValue();
 ```
 */
function readValue(): string {
  return 'value';
}

/** Description may remain beside the opener. */
const inlineDescription = true;

/**
 Description whose closing delimiter shares its final line.
 */ const closeBesideContent = true;

export {
  closeBesideContent,
  inlineDescription,
  readValue,
};
