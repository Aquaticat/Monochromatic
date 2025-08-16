# Tool Choices

## Framework: Astro > Nue

Astro: most supported static site generator.

NueJS: requires less common markdown format support.

## Editor: VSCode/VSCodium/Neovide > WebStorm

WebStorm lacks moon plugin support.

## Linting and formatting

- **Biome**: insufficient rules
- **oxlint**: faster than ESLint
- **ESLint**: fills oxlint gaps
- **Stylelint**: CSS-specific rules
- **dprint**: universal formatter

## Testing: Vitest + Playwright

Alternatives rejected:

1.  **WebdriverIO**
    - ✓ Firefox ESR support
    - ✗ No `prefers-contrast`/`prefers-reduced-motion` emulation
    - ✗ No Firefox user.js/Chrome flags support
    - ✗ Host configuration breaks reproducibility

1.  **Playwright standalone**
    - ✗ No unit testing

Vitest + Playwright: unit testing + browser automation + emulation.

## AI SDK: OpenAI SDK > Vercel AI SDK

Vercel AI SDK forces React dependencies for non-React projects:

- **Dependency chain**: `ai` → `@ai-sdk/react` → `swr` → `react`
- **Bloated tree**: Frontend UI concerns bundled with backend logic
- **No core package**: Missing modular `@ai-sdk/core` without UI dependencies

OpenAI SDK: direct API integration without unnecessary dependencies.