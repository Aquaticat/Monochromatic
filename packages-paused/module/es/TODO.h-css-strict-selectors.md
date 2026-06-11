# h-css: strict selector builders

The `rule` field in h-css currently accepts raw strings, allowing untyped selectors
like `'input::placeholder,textarea::placeholder'` to bypass the type system.

## Goal

Replace `rule: string` with typed selector builders so that:

- Element names, pseudo-classes, pseudo-elements, and combinators are all constructed via functions
- Comma-separated selector lists use a dedicated combinator (like `cssCommaList` for values)
- Typos in pseudo-classes or element names become compile-time errors
- The selector API mirrors the value API: no raw strings, every token goes through a constructor

## Examples of what this enables

```ts
// Before (raw string, no validation)
css({ rule: 'input::placeholder,textarea::placeholder', decls: { ... } })

// After (typed builders, compile-time checked)
css({ rule: selectorList([sel('input', '::placeholder'), sel('textarea', '::placeholder')]), decls: { ... } })
```

## Scope

- `rule` field type in `RuleOptions`
- Selector combinators: descendant, child, sibling, general sibling
- Pseudo-classes: `:hover`, `:focus-visible`, `:disabled`, `:not()`, `:is()`, etc.
- Pseudo-elements: `::before`, `::after`, `::placeholder`, `::backdrop`, etc.
- Nesting: `&` reference
- Comma lists for grouped selectors
