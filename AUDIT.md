# Dependency Security Report

## vlt Socket security scan (2026-04-04)

### Critical findings

- **Malware (medium+):** None detected
- **Known CVEs:** None detected (`:cve` and `:cwe` arrays empty for all packages)
- **Typosquatting:** None detected
- **Abandoned:** None detected
- **Manifest confusion:** None detected
- **Install scripts:** None detected by Socket (note: `sharp@0.34.5` has `scripts.install` in its manifest but Socket classifies it as non-risky)
- **Unlicensed:** None detected
- **Obfuscated:** None detected
- **High-entropy strings:** None detected
- **Unstable ownership:** None detected

### Dependency chains for flagged packages

**`@npmcli/*`, `glob@10.5.0` (deprecated), `chokidar@3`, `picomatch@2.3.2`:**
Removed. These were all transitive deps of `remark-cli`, which was replaced by
`dprint-plugin-markdown` (formatting) + `markdownlint-cli2` (semantic linting) via mise.

**`micromatch@4.0.8` -> `picomatch@2.3.2` -- from stylelint (dev-only):**
```
stylelint -> micromatch -> picomatch@2.3.2
stylelint -> globby -> fast-glob -> micromatch
```

Stylelint maintainers are actively discussing migration to `tinyglobby` or `fs.glob` (Node 22+)
but have blocked it on a major release to avoid breaking the `globbyOptions` API.
Two community PRs (stylelint/stylelint#8988, stylelint/stylelint#9118) were closed without merge.
The discussion continues in stylelint/stylelint#8051 and stylelint/stylelint#8929.

**`vite-plugin-singlefile`** -- removed. Was a stale lockfile entry from the deleted
`packages/config/vite` package. No active imports or package.json references remain.
Will be cleaned from the lockfile on next `vlt install`.

**`picomatch@2.3.2` CVE status:**
Two CVEs affected picomatch before 2.3.2:
- CVE-2026-33671 -- ReDoS via extglob quantifiers (CVSS 7.5 High)
- CVE-2026-33672 -- method injection in POSIX character classes (CVSS 5.3 Medium)

Both are **fixed in 2.3.2**, which is the version installed. Socket reports empty CVE/CWE arrays
for picomatch@2.3.2, confirming no active vulnerabilities. The `:severity(">=medium")` flag
is Socket's proprietary behavioral risk score, not a CVE indicator.

`picomatch@4.0.4` (used by vite, tsdown, tinyglobby, rolldown, fdir) is a separate major version
and was never affected by these CVEs.

### Informational findings

**Deprecated (0)**
- ~~`glob@10.5.0`~~ -- removed with remark-cli

**Socket severity medium (2 unique packages) -- behavioral risk, not CVEs**
- `gray-matter@4.0.3` -- uses eval and fs access; prod dep of ssg-test
- `picomatch@2.3.2` -- transitive via stylelint (micromatch); dev-only; CVEs fixed in this version

**Copyleft licenses (4 unique packages)**
- `lightningcss@1.32.0` (MPL-2.0) -- prod dep of vite-deprecated and vite; MPL-2.0 is file-level copyleft, fine for dependencies
- `lightningcss-linux-x64-gnu@1.32.0` (MPL-2.0) -- platform binary for lightningcss
- `bun-types@1.3.11` (MIT but Socket flags restricted/copyleft) -- transitive via @types/bun
- `@img/sharp-libvips-linux-x64@1.2.4` (LGPL-3.0-or-later) -- optional native binary for sharp; LGPL fine for dynamically linked native modules

**Dynamic code execution / eval (14)**
- gray-matter, neovim, css-tree, @sinclair/typebox, core-js, source-map-js, lodash, js-yaml, istanbul-lib-coverage, lodash.truncate, ajv, playwright-core, regenerator-runtime, uglify-js

**Shell access (8)**
- @tursodatabase/database, esbuild, tree-kill, cross-spawn, detect-libc, playwright-core, foreground-child, @npmcli/promise-spawn

**Network access (21)**
- vite, lfi, happy-rusty, exa-js, rolldown (2 versions), sharp, esbuild, cross-fetch, html2canvas, core-js, canvg, winston, rollup, domutils, playwright-core, acorn, clean-css, cacheable, lru-cache, @npmcli/git

**New collaborator publishing (11)**
- istanbul-lib-report, kind-of, vscode-uri, stack-trace, anymatch, fn.name, text-hex, abbrev, @npmcli/name-from-folder, npm-normalize-package-bin, validate-npm-package-name

**Trivial (<10 lines, 3)**
- is-arrayish@0.2.1, boolbase@1.0.0, @npmcli/name-from-folder@2.0.0

**Unmaintained (>5 years without updates, 54 packages)**
- outdent, tree-kill, svg-tags, normalize-path, is-plain-object, globjoin, global-modules, pluralize, fast-decode-uri-component, extend, strip-bom-string, section-matter, kind-of, tiny-inflate, path-browserify, lodash.truncate, util-deprecate, cssesc, merge2, text-table, shebang-command, rgbcolor, raf, extend-shallow, esprima, argparse (2 versions), one-time, astral-regex, require-from-string, json-schema-traverse, fast-deep-equal, resolve-from, is-empty, concat-stream, ieee754, performance-now, is-extendable, string_decoder, inherits, fn.name, kuler, enabled, to-regex-range, is-extglob, run-parallel, safe-buffer, text-hex, is-number, queue-microtask, validate-npm-package-license, promise-retry, promise-inflight, err-code

---

# Dependency Source Code Audit

## Excluded from Auditing

Dependencies excluded from full source code audit, with rationale.

### Transitive / Unavoidable

- **postcss** — Used by stylelint and CSS build pipeline
- **tinyglobby** — Used by tsdown and other build tooling


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
- ~~remark-lint-*~~ -- removed; replaced by markdownlint-cli2 + dprint-plugin-markdown
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
