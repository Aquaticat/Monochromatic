import {
  composeVisitors,
  type CustomAtRules,
  type DeclarationBlock,
  type Rule,
  type Visitor,
} from 'lightningcss';

//region LightningCSS Visitors -- Custom CSS transform implementations

/**
 * LightningCSS customAtRules limitation:
 * The `customAtRules` option would eliminate "Unknown at rule" warnings by telling
 * LightningCSS how to parse @mixin/@apply. However, LightningCSS v1.30.2 has a bug
 * that breaks customAtRules when CSS contains var() functions.
 * See: https://github.com/parcel-bundler/lightningcss/issues/1081
 *
 * Until fixed, these visitors use `Rule.custom` which expects customAtRules config.
 * Without customAtRules, warnings appear but the mixin system still works via the
 * "unknown" at-rule fallback mechanism.
 */

/** Storage for mixin definitions */
const mixins = new Map<string,
  | Required<DeclarationBlock>
  | Rule[]>();

/** Transforms custom property units into `calc()` expressions */
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

/** Transforms `@mixin` definitions and `@apply` usage */
const mixinsVisitor: Visitor<CustomAtRules> = {
  Rule: {
    custom: {
      mixin(rule,) {
        // Uncomment to get the updated TypeScript inferred type for the map.
        // const body = rule.body.value;
        mixins.set(rule.prelude.value as string, rule.body.value,);
        return [];
      },
      apply(rule,) {
        return mixins.get(rule.prelude.value as string,);
      },
    },
  },
};

const composedVisitor: Visitor<CustomAtRules> = composeVisitors([
  customUnitsVisitor,
  mixinsVisitor,
],);

//endregion LightningCSS Visitors

export { composedVisitor, };
