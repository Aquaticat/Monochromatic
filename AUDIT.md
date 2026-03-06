# Dependency Source Code Audit

## Excluded from Auditing

Dependencies excluded from full source code audit, with rationale.

### Transitive / Unavoidable

- **`@motion-canvas/*`** - Unavoidable for making animations.
- **vite** both 5 and latest — Required by @motion-canvas/*
- **sharp** — Transitive dependency of @motion-canvas/*
- **esbuild** — Required by @motion-canvas/*; no longer a vite dependency as of vite 8
- **rollup** - Required by Vite 5
- **rolldown** — Vite transitive; native Rust bundler, replaces rollup in vite 8
- **@rolldown/pluginutils** — Vite transitive, via rolldown
- **@oxc-project/runtime** — Vite transitive
- **@oxc-project/types** — Vite transitive, via rolldown
- **postcss** — Vite transitive
- **nanoid** — Vite transitive, via postcss
- **picocolors** — Vite transitive, via postcss
- **source-map-js** — Vite transitive, via postcss
- **lightningcss** — Vite transitive
- **detect-libc** — Vite transitive, via lightningcss
- **tinyglobby** — Vite transitive
- **fdir** — Vite transitive, via tinyglobby
- **picomatch** — Vite transitive, via tinyglobby
- **fsevents** — Vite transitive, optional macOS-only


### Trusted / Pre-Vetted

- **dprint** — Trusted native formatter; dev-only
- **neovim** — Trusted MCP integration; dev-only
- **@anthropic-ai/sdk** — Trusted first-party AI vendor SDK
- **openai** — Trusted first-party AI vendor SDK
- **zod** - Impossible to avoid.

### Planned for Removal

- **astro** — Will be replaced with a simpler SSG
- **@astrojs/mdx** — Will be removed with astro
- **exa-js** — To be replaced by linkup.so
- **@kazupon/gunshi** - To be replaced by @optique/*
- **`@logtape/*`** - To be replaced by our custom logger

## Audited

### feedsmith

- **Version:** >=3.0.0-next.2
- **Date:** 2026-03-01
- **Verdict:** Acceptable
- **Notes:** Single-author (macieklamberski), MIT, 3 runtime deps (fast-xml-parser, entities, strnum).
  No eval/network/fs/DOM in source.
  XML entity processing disabled for parsing (`processEntities: false`), mitigating XXE/billion-laughs.
  No ReDoS-vulnerable regex.
  No `__proto__`/`constructor` key filtering in `traverseAndNormalize`, but downstream parsers build new objects with hardcoded keys so injected keys are discarded.
  Unbounded recursion in namespace normalization is a theoretical DoS vector on deeply nested XML — mitigate with a response size limit on fetch.
  Generator path uses `processEntities: true` but we only use parsers.
  `parseDate` is a no-op stub (passes strings through) — our code validates dates via Zod.
  Prerelease semver range means trusting a sole maintainer's `next` branch; pin if stability matters.
  Overall: clean, well-tested (3,400+ tests), well-typed codebase with no significant security issues for parse-only use on untrusted feeds.

### stylelint

- **Version:** 17.4.0
- **Date:** 2026-03-03
- **Verdict:** Acceptable
- **Notes:** The codebase is a straightforward CSS linter with:
  - No network activity
  - No shell execution
  - No dynamic code evaluation
  - Proper pinned CI dependencies
  - Benign install scripts
  - Well-scoped file system access (only writes user-specified output files)

### elysia

- **Version:** 1.4.7
- **Date:** 2026-03-03
- **Verdict:** Acceptable
- **Notes:**  Elysia's source code is straightforward framework code with no "funny business." It has solid security hygiene (prototype
  pollution guards, timing-safe crypto, strict mode), legitimate use of dynamic code generation for performance, and zero data
  collection or exfiltration mechanisms.

### tsdown

- **Version:** 0.18.1
- **Date:** 2026-03-01
- **Verdict:** Acceptable
- **Notes:** Rolldown wrapper that does what it says on the tin.

### lfi

- **Notes:** The lfi package (v4.1.2) should be approved for use. A thorough audit of both the GitHub source and the published npm tarball
  reveals no malicious code, no install hooks, no network calls, no filesystem access, no environment variable reads, and zero
  runtime dependencies. The only two flagged patterns — an eval('') for CSP feature detection and a new Function() for function
  composition optimization — are well-known, legitimate techniques with safe fallbacks. The published tarball matches the expected
  build output from the repository. The library is small (~21KB), purely functional, side-effect-free, and does exactly what it
  claims: lazy iteration over sync, async, and concurrent iterables.

### happy-rusty AND happy-opfs

- **Notes:** Both happy-rusty and happy-opfs are clean, well-engineered TypeScript libraries with no security red
  flags. happy-rusty has zero runtime dependencies and provides Rust-style error handling primitives with strict typing and
  immutable objects. happy-opfs builds on this foundation to offer a browser-compatible file system API over OPFS with minimal,
  reputable dependencies. Both libraries demonstrate above-average code quality: strict TypeScript configurations, comprehensive
  test suites, thorough JSDoc documentation, consistent input validation, and no use of eval, dynamic code execution, install
  scripts, or obfuscated code. No data exfiltration, telemetry, or hidden functionality was detected. The only minor concern is the
   single-author bus factor across the @happy-ts ecosystem, which is common for focused open-source utilities and does not
  constitute a blocking risk.

### smol-toml

- **Notes:**  well-engineered, zero-runtime-dependency TOML parser/serializer with ~1,300 lines of TypeScript source. The audit
  found no suspicious code — no network calls, telemetry, eval, environment variable access, or postinstall scripts. Security is
  handled proactively: prototype pollution is mitigated via Object.defineProperty, all regexes are anchored and ReDoS-safe, and
  recursive depth is capped at 1000 to prevent stack overflows. CI/CD follows best practices with SHA-pinned GitHub Actions and npm
   provenance publishing. The test suite covers parsing, serialization, error reporting, and DoS protection. One minor concern:
  skipVoid uses recursion per comment line, which could theoretically overflow on pathologically large inputs, but this is
  low-severity. With ~7M weekly npm downloads and BSD-3-Clause licensing, this library is production-ready and safe to adopt.

### superjson

- **Notes:** well-engineered, minimal TypeScript library for serializing rich JavaScript types (Date,
  Map, Set, BigInt, etc.) over JSON. The codebase is lean (~1,530 lines), strictly typed, and carries only one runtime dependency.
  It has no install hooks, no telemetry, no network calls, and no obfuscated code — the supply chain risk is negligible. Security
  is actively addressed: prototype pollution is explicitly blocked and tested from both serialize and deserialize vectors. Test
  coverage is strong at a roughly 1:1 test-to-code ratio with edge-case and performance regression tests. The library is actively
  maintained with recent commits and regular releases. The only minor concern is a theoretical ReDoS vector via RegExp
  deserialization, which requires attacker control of the trusted payload — low risk in typical use. This dependency is safe to
  adopt.

### happy-dom

- **Notes:** Uses of eval() and child_process are inherent to
  its purpose as a browser DOM simulator and mirror patterns found in the industry-standard jsdom. The project is 100% TypeScript
  with ~300 test files, ESLint/Prettier enforcement, and CI that explicitly disables install scripts.

## Audit Queue

Remaining dependencies to audit, ordered by priority.

### Tier 1 — High Risk (server frameworks, untrusted input processing)

### Tier 2 — Medium Risk (build pipeline, data transformation)

- [ ] rehype-* / remark-* / unified (content pipeline)

### Tier 3 — Lower Risk (utilities, dev-only)

- [ ] type-fest
- [ ] ts-pattern
- [ ] decircular
- [ ] safe-stringify
- [ ] dot-prop
- [ ] find-up
- [ ] nano-spawn
- [ ] execa
- [ ] @optique/core
- [ ] @optique/run
- [ ] preact
- [ ] preact-render-to-string
- [ ] watcher
- [ ] @csstools/css-tokenizer
- [ ] @cspotcode/outdent
- [ ] serialize-error
- [ ] chokidar
- [ ] the-new-css-reset
- [ ] TODS
- [ ] opentype.js
- [ ] browserslist
- [ ] minimatch
- [ ] glob
- [ ] @total-typescript/ts-reset
- [ ] @ungap/structured-clone
- [ ] eslint + plugins (dev-only)
- [ ] typescript-eslint (dev-only)
- [ ] remark-lint-* (dev-only)
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
