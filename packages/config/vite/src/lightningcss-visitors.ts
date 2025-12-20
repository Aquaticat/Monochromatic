import {
  composeVisitors,
  type CustomAtRules,
  type DeclarationBlock,
  type Rule,
  type Visitor,
} from 'lightningcss';

//region LightningCSS Visitors -- Custom CSS transform implementations

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
