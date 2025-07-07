# Philosophy

## Core principles

### Portability and interoperability

Portable, interoperable, detachable.
No platform-specific solutions.

#### Markdown features

Plain markdown readability with optional enhanced tooling.

## Technical decisions

### Build and execution

#### Bun scripts vs single file executables

Direct `bun <script>.ts` execution in moon.yml:

- **Platform portability**: Bun single file executables aren't cross-platform
- **Industry precedent**: oxlint and dprint use runtime platform detection
- **Performance**: Acceptable startup cost for portability

### Tool choices

#### Framework: Astro > Nue

Astro: most supported static site generator.

NueJS: requires less common markdown format support.

#### Editor: VSCode/VSCodium/Neovide > WebStorm

WebStorm lacks moon plugin support.

#### Linting and formatting

- **Biome**: insufficient rules
- **oxlint**: faster than ESLint
- **ESLint**: fills oxlint gaps
- **Stylelint**: CSS-specific rules
- **dprint**: universal formatter

#### Testing: Vitest + Playwright

Alternatives rejected:

1.  **WebdriverIO**
    - ✓ Firefox ESR support
    - ✗ No `prefers-contrast`/`prefers-reduced-motion` emulation
    - ✗ No Firefox user.js/Chrome flags support
    - ✗ Host configuration breaks reproducibility

2.  **Playwright standalone**
    - ✗ No unit testing

Vitest + Playwright: unit testing + browser automation + emulation.

#### AI SDK: OpenAI SDK > Vercel AI SDK

Vercel AI SDK forces React dependencies for non-React projects:

- **Dependency chain**: `ai` → `@ai-sdk/react` → `swr` → `react`
- **Bloated tree**: Frontend UI concerns bundled with backend logic
- **No core package**: Missing modular `@ai-sdk/core` without UI dependencies

OpenAI SDK: direct API integration without unnecessary dependencies.

## Future considerations

### Browser support

#### Firefox ESR 140 (June 2025)

Modern features without workarounds:

1.  **CSS Container Queries** - `@container` and container units
2.  **`:has()` selector**
3.  **CSS Nesting**
4.  **`content-visibility`**
5.  **Text Fragments**
6.  **CSS `@scope`**
7.  **Popover API**
8.  **View Transitions API**
