# ESLint Configuration Troubleshooting

## Custom Parsers and Processors

### Parser vs Processor
- Use a custom **parser** when you need to parse a different file format entirely (like .astro, .vue)
- Use a **processor** when you need to extract JavaScript/TypeScript from within another file format
- Parsers give you full control over the AST and type checking

### Plugin Configuration with Type Safety
Don't use `Object.assign` to add configs to a plugin - TypeScript can't track the type changes.
Instead, create a new const with the full type:

```ts
const plugin: FlatConfig.Plugin = { meta: {...}, configs: {} };
const pluginWithConfig: FlatConfig.Plugin & { configs: { recommended: FlatConfig.Config[] } } = {
  ...plugin,
  configs: { recommended: [...] }
};
export default pluginWithConfig;
```

### Parser Options Inheritance
- Don't duplicate `languageOptions.parserOptions` in plugin configs if they're already defined in the main config
- The main config's parser options will be merged automatically

### Type Definitions for ESLint
- Use `@typescript-eslint/utils/ts-eslint` for proper TypeScript types (`FlatConfig.Plugin`, etc.)
- The basic `eslint` package types are incomplete for advanced use cases

### Virtual Files and Project Service
When creating virtual files (like `file.astro/frontmatter.ts`), TypeScript's projectService won't recognize them.

Solutions:
- Use a custom parser instead of a processor
- Or configure `allowDefaultProject` with specific patterns (but no `**` allowed)