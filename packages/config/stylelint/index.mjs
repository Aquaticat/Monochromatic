/** @type {import('stylelint').Config} */
export default {
  extends: 'stylelint-config-standard',
  rules: {
    //region Avoid errors

    'no-descending-specificity': [true, { ignore: ['selectors-within-list',], },],

    //region Unknown

    'at-rule-no-unknown': [true, { ignoreAtRules: ['mixin', 'define-mixin',], },],

    /*'declaration-property-value-no-unknown': [true, {
      ignoreProperties: {
        '/[\w\-]+/': /(?:\d+|\d*\.\d+)--[\w\-_]+/,

        // In the specs, but Stylelint haven't caught on yet.
        'word-break': 'auto-phrase',
      },
    }],*/
    // TODO: Disabled until https://github.com/stylelint/stylelint/pull/7944 is released.
    'declaration-property-value-no-unknown': null,

    'unit-no-unknown': [true, { ignoreUnits: [/--[\w\-_]+/,], },],

    //endregion Unknown

    //endregion Avoid errors

    //region At-rule

    'at-rule-disallowed-list': ['charset', 'font-palette-values',],

    //endregion

    //region color

    'color-named': 'never',

    //endregion color

    //region Declaration

    //endregion Declaration

    //region Function

    'function-disallowed-list': [
      // Could result in unpredictable color.
      'color-contrast',

      // Always use oklch(), or color() when necessary.
      'hsl',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'rgb',
      'rgba',

      // Based on RGB instead of HSL, will lose precision.
      'saturate',

      /* Use custom properties + media query instead.
         That'd be more flexible and predictable. */
      'light-dark',

      //region Pointless

      'element',
      'paint',
      'palette-mix',
      //endregion Pointless
    ],

    //endregion Function

    //region Media

    'media-feature-name-disallowed-list': [
      // Always use <= or > syntax
      /^max-[\w-]+$/,
      /^min-[\w-]+$/,
    ],

    'media-feature-name-unit-allowed-list': {
      // It's @media, always use rem instead of em.
      // oxlint false positive because stylelint accept regular expressions inside strings.
      // eslint-disable-next-line no-useless-escape
      '/[\w-]+/': 'rem',
    },

    //endregion Media

    //region Property

    'property-disallowed-list': [
      //region Pointless

      'clear',

      'float',

      //endregion

      //region deprecated and non-standard

      'clip',

      'font-smooth',

      //endregion

      //region Shorthands - Always use full form.

      'animation',

      'background',

      'border',

      'border-block',

      'border-inline',

      'container',

      'flex',

      'font',

      'font-synthesis',

      'font-variant',

      'grid',

      'grid-area',

      'grid-template',

      'inset',

      'list-style',

      /margin$/,

      'mask',

      'offset',

      'outline',

      'overflow',

      'overscroll-behavior',

      /padding$/,

      /^place-[\w-]+$/,

      'scroll-timeline',

      'transition',

      'view-timeline',

      //endregion Shorthands

      //region Non-logical

      'width',

      'height',

      // Can't use that here: false positive: *-inline-width, *-width
      // /^[\w\-]+-width$/,
      'contain-intrinsic-width',
      'max-width',

      // Can't use that here: false positive: line-height
      // /^[\w\-]+-height$/,
      'contain-intrinsic-height',
      'max-height',

      /^[\w-]+-top$/,

      /^[\w-]+-left$/,

      /[\w-]+-right/,

      /[\w-]+-bottom/,
      //endregion Non-logical
    ],

    //endregion

    // region Unit

    'unit-disallowed-list': [
      //region angle - Use turn

      'rad',
      'deg',

      //endregion angle

      //region length

      /* The font-based units vary wildly depending on the font.
           This is as intended, but could make layout unpredictable.
           Use 1em or 0.5em instead. */
      'ch',
      'rch',
      'ex',
      'rex',
      'cap',
      'rcap',
      'ic',
      'ric',
      // lh is not banned.

      // Use logical
      'vh',
      'vw',
      'cqw',
      'cqh',

      // Do not use absolute length
      'px',
      'cm',
      'mm',
      'Q',
      'in',
      'pc',
      'pt',

      //endregion length

      //region Other

      // Always use s
      'ms',
      //endregion Other
    ],

    //endregion Unit

    //region length

    'length-zero-no-unit': null,

    //endregion length

    //region Case

    'value-keyword-case': ['lower', {
      ignoreProperties: ['font-family', '/^--/', 'initial-value',],
    },],

    //endregion Case

    //region Empty lines

    'declaration-empty-line-before': ['always', {
      except: ['after-comment', 'first-nested',],
    },],

    //endregion Empty lines

    //region Notation

    'font-weight-notation': 'named-where-possible',

    'import-notation': 'string',

    //endregion notation

    //region Pattern

    'custom-media-pattern': null,

    'custom-property-pattern': null,

    'keyframes-name-pattern': null,

    'selector-class-pattern': null,

    'selector-id-pattern': null,

    //endregion Pattern

    //region Redundant

    'declaration-block-no-redundant-longhand-properties': null,

    //endregion Redundant

    //region Whitespace inside

    'comment-whitespace-inside': null,
    //endregion Whitespace inside
  },
  /* See example..stylelintignore
     This way of ignoring files is too slow.
     Update: turns out stylelint can directly use gitignore if the command argument is passed in.
     */
  // ignoreFiles: [],

  overrides: [{
    files: ['*.astro', '**/*.astro', '*.html', '**/*.html',],
    customSyntax: 'postcss-html',
  },],

  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
  reportUnscopedDisables: true,
  cache: true,
};
