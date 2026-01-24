import {
  type CustomAtRules,
  type Visitor,
} from 'lightningcss';

//region LightningCSS Visitors -- Custom CSS transform implementations

/**
 * Transforms custom property units (e.g., `2--rp`) into `calc()` expressions.
 * This allows using CSS custom properties as units directly in values.
 * @example `2--rp` becomes `calc(2 * var(--rp))`
 */
const customUnitsVisitor: Visitor<CustomAtRules> = {
  Token: {
    dimension(token,) {
      if (token.unit.startsWith('--',)) {
        return {
          type: 'function',
          value: {
            name: 'calc',
            arguments: [
              {
                type: 'token',
                value: {
                  type: 'number',
                  value: token.value,
                },
              },
              {
                type: 'token',
                value: {
                  type: 'delim',
                  value: '*',
                },
              },
              {
                type: 'var',
                value: {
                  name: {
                    ident: token.unit,
                  },
                },
              },
            ],
          },
        };
      }
    },
  },
};

/**
 * Composed visitor combining all custom CSS transformations.
 * Note: @mixin/@apply expansion is handled by css-mixin-plugin.ts (text preprocessing)
 * as a workaround for LightningCSS issue #1081 (customAtRules breaks with var()).
 */
const composedVisitor: Visitor<CustomAtRules> = customUnitsVisitor;

//endregion LightningCSS Visitors

export { composedVisitor, };
