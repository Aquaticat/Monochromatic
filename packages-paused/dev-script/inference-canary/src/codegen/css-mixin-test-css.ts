/**
 * Test CSS input for the css-mixin-transpiler probe.
 *
 * Exercises all required features: recursive @apply, top-level @apply, nested rules,
 * multiple @apply in one block, and mixin bodies containing full rule blocks.
 */

/**
 * Full test CSS covering recursive, nested, and top-level mixin expansion
 */
export const CSS_MIXIN_TEST_CSS: string = [
  '@mixin --flex-center {',
  '  display: flex;',
  '  align-items: center;',
  '  justify-content: center;',
  '}',
  '',
  // Mixin that @apply's another mixin (recursive expansion)
  '@mixin --card-base {',
  '  @apply --flex-center;',
  '  padding-block: 1rem;',
  '  padding-inline: 2rem;',
  '}',
  '',
  '@mixin --visually-hidden {',
  '  position: absolute;',
  '  clip-path: inset(50%);',
  '  overflow: hidden;',
  '}',
  '',
  // Mixin whose body contains a full selector rule
  '@mixin --reset {',
  '  body {',
  '    margin: 0;',
  '    padding: 0;',
  '  }',
  '}',
  '',
  // Top-level @apply: mixin body expands directly into the stylesheet
  '@apply --reset;',
  '',
  '.card {',
  '  @apply --card-base;',
  '  border-radius: 0.5rem;',
  '}',
  '',
  '.nav {',
  '  background-color: var(--surface-bg);',
  '',
  '  & .link {',
  '    @apply --flex-center;',
  '    color: var(--link-fg);',
  '  }',
  '}',
  '',
  // Multiple @apply in one block
  '.hero {',
  '  @apply --card-base;',
  '  @apply --visually-hidden;',
  '}',
  '',
  // Later property should override earlier property from mixin
  '.override-test {',
  '  @apply --flex-center;',
  '  display: grid;',
  '}',
  '',
]
  .join('\n',);
