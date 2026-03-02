# Dependency Source Code Audit

## Excluded from Auditing

Dependencies excluded from full source code audit, with rationale.

### Transitive / Unavoidable

| Dependency | Reason |
| --- | --- |
| sharp | Transitive dependency of vite; required by @motion-canvas/* |
| esbuild | Transitive dependency of vite; required by @motion-canvas/* |

### Trusted / Pre-Vetted

| Dependency | Reason |
| --- | --- |
| dprint | Trusted native formatter; dev-only |
| neovim | Trusted MCP integration; dev-only |
| @anthropic-ai/sdk | Trusted first-party AI vendor SDK |
| openai | Trusted first-party AI vendor SDK |

### Planned for Removal

| Dependency | Reason |
| --- | --- |
| astro | Will be replaced with a simpler SSG |
| @astrojs/mdx | Will be removed with astro |
| exa-js | Already replaced by linkup.so |

## Audited

| Dependency | Version | Date | Verdict | Notes |
| --- | --- | --- | --- | --- |
| feedsmith | >=3.0.0-next.2 | 2026-03-01 | Acceptable | Single-author (macieklamberski), MIT, 3 runtime deps (fast-xml-parser, entities, strnum). No eval/network/fs/DOM in source. XML entity processing disabled for parsing (`processEntities: false`), mitigating XXE/billion-laughs. No ReDoS-vulnerable regex. No `__proto__`/`constructor` key filtering in `traverseAndNormalize`, but downstream parsers build new objects with hardcoded keys so injected keys are discarded. Unbounded recursion in namespace normalization is a theoretical DoS vector on deeply nested XML — mitigate with a response size limit on fetch. Generator path uses `processEntities: true` but we only use parsers. `parseDate` is a no-op stub (passes strings through) — our code validates dates via Zod. Prerelease semver range means trusting a sole maintainer's `next` branch; pin if stability matters. Overall: clean, well-tested (3,400+ tests), well-typed codebase with no significant security issues for parse-only use on untrusted feeds. |

## Audit Queue

Remaining dependencies to audit, ordered by priority.

### Tier 1 — High Risk (server frameworks, untrusted input processing)

- [ ] elysia
- [ ] @elysiajs/static
- [ ] @elysiajs/swagger

### Tier 2 — Medium Risk (build pipeline, data transformation)

- [ ] vite (plugin system, config execution)
- [ ] postcss
- [ ] lightningcss
- [ ] stylelint
- [ ] rehype-* / remark-* / unified (content pipeline)
- [ ] happy-dom
- [ ] zod
- [ ] @motion-canvas/*

### Tier 3 — Lower Risk (utilities, dev-only)

- [ ] type-fest
- [ ] ts-pattern
- [ ] superjson
- [ ] decircular
- [ ] safe-stringify
- [ ] dot-prop
- [ ] find-up
- [ ] tinyglobby
- [ ] nano-spawn
- [ ] execa
- [ ] @kazupon/gunshi
- [ ] @optique/core
- [ ] @optique/run
- [ ] preact
- [ ] preact-render-to-string
- [ ] watcher
- [ ] lfi
- [ ] happy-opfs
- [ ] happy-rusty
- [ ] @csstools/css-tokenizer
- [ ] @cspotcode/outdent
- [ ] serialize-error
- [ ] chokidar
- [ ] the-new-css-reset
- [ ] TODS
- [ ] opentype.js
- [ ] @logtape/logtape
- [ ] @logtape/file
- [ ] browserslist
- [ ] minimatch
- [ ] glob
- [ ] smol-toml
- [ ] @total-typescript/ts-reset
- [ ] @ungap/structured-clone
- [ ] eslint + plugins (dev-only)
- [ ] typescript-eslint (dev-only)
- [ ] remark-lint-* (dev-only)
- [ ] tsdown (dev-only)
- [ ] rollup (dev-only, vite transitive)
- [ ] vite-plugin-singlefile (dev-only)
- [ ] vite-plugin-json5 (dev-only)
- [ ] istanbul-lib-report (dev-only)
- [ ] @vitejs/plugin-basic-ssl (dev-only)
- [ ] @shikijs/transformers
- [ ] remark-github-blockquote-alert
- [ ] remark-sectionize
- [ ] rehype-slug-custom-id
- [ ] rehype-autolink-headings
- [ ] rehype-preset-minify
- [ ] rehype-parse
- [ ] rehype-stringify
- [ ] to-vfile
- [ ] vue + vue-tsc (dev-only, type-checking)
