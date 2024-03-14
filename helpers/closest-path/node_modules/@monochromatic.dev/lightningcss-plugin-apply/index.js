const defined = new Map();

export default {
  Rule: {
    style(rule) {
      for (const selector of rule.value.selectors) {
        if (selector.length === 1 && selector[0].type === 'type' && selector[0].name.startsWith('--')) {
          defined.set(selector[0].name, rule.value.declarations);
          return { type: 'ignored', value: null };
        }
      }

      rule.value.rules = rule.value.rules.filter((child) => {
        if (child.type === 'unknown' && child.value.name === 'apply') {
          for (const token of child.value.prelude) {
            if (token.type === 'dashed-ident' && defined.has(token.value)) {
              const r = defined.get(token.value);
              const decls = rule.value.declarations;
              decls.declarations.push(...r.declarations);
              decls.importantDeclarations.push(...r.importantDeclarations);
            }
          }
          return false;
        }
        return true;
      });

      return rule;
    },
  },
};
