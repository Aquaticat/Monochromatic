import type {
  CustomAtRules,
  Visitor,
} from 'lightningcss';

export default {
  Rule: {
    style(rule) {
      const valuesByProperty = new Map();
      for (const decl of rule.value.declarations.declarations) {
        let name: string = decl.property;
        if (decl.property === 'unparsed') {
          name = decl.value.propertyId.property;
        }
        valuesByProperty.set(name, decl);
      }

      // @ts-expect-error
      rule.value.declarations.declarations = rule.value.declarations.declarations.map((decl) => {
        // Only single value supported. Would need a way to convert parsed values to unparsed tokens otherwise.
        if (decl.property === 'unparsed' && decl.value.value.length === 1) {
          const token = decl.value.value[0]!;
          if (token.type === 'token' && token.value.type === 'at-keyword' && valuesByProperty.has(token.value.value)) {
            const v = valuesByProperty.get(token.value.value);
            return {
              /** @type any */
              property: decl.value.propertyId.property,
              value: v.value,
            };
          }
        }
        return decl;
      });

      return rule;
    },
  },
} satisfies Visitor<CustomAtRules>;
