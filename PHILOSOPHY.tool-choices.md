# Tool Choices

## Framework: Astro > Nue

Astro: most supported static site generator.

NueJS: requires less common markdown format support.

## Editor: VSCode/VSCodium/Neovide > WebStorm

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

## Code search: Agentic search > Semantic search

Semantic search (embedding-based vector search over codebases) consistently underperforms
agentic search (grep, glob, and file reading driven by an LLM agent).
Agentic search adapts its strategy based on intermediate results,
while semantic search returns a fixed set of "similar" results that often miss the actual target.
This aligns with findings from the Claude Code team at Anthropic,
who found agentic search outperforms semantic/embedding-based retrieval for code navigation.

No plans to implement an MCP server for codebase indexing or semantic code search.

## AI SDK: OpenAI SDK > Vercel AI SDK

Vercel AI SDK forces React dependencies for non-React projects:

- **Dependency chain**: `ai` → `@ai-sdk/react` → `swr` → `react`
- **Bloated tree**: Frontend UI concerns bundled with backend logic
- **No core package**: Missing modular `@ai-sdk/core` without UI dependencies

OpenAI SDK: direct API integration without unnecessary dependencies.

## Bundler: tsdown > raw rolldown

tsdown (v0.20.3) is a ~5,000-line config translator and plugin orchestrator on top of rolldown.
Full source audit completed 2026-03-01.

### Why not raw rolldown

Rolldown's primary customer is Vite (application bundling).
Library bundling is a secondary concern for the rolldown team.
tsdown fills the gap with:

- **Auto-externalization**: reads `dependencies` + `peerDependencies` from package.json
  and marks them external via a rolldown `resolveId` plugin (`dep.ts`, 193 lines).
  Also scans the final bundle for leaked node_modules imports (`inlineOnly` safety net).
- **DTS generation**: wires `rolldown-plugin-dts`, handles the CJS special case
  (separate rolldown build pass for `.d.cts` files when format is CJS + DTS enabled).
- **Output extension matrix**: `.mjs`/`.cjs`/`.js` determined by format x package.json `type` x `fixedExtension` flag.
- **Watch-safe clean**: in watch mode, deletes only previous output chunks instead of nuking the directory.
  Prevents race conditions when watch-building multiple interdependent packages in parallel.
- **Config file loading**: detects Bun/native TS support and uses native `import()` with zero transpilation overhead,
  falls back to `unrun` otherwise. No jiti/esbuild for config loading.

### What tsdown does that we don't use but is fine to carry

- Workspace mode (92 lines, half-baked: no topological sort, shallow config merge, no error isolation).
  We use mise for monorepo orchestration instead.
- Hooks system (hookable, 86 lines). Redundant with mise task sequencing.
- pkg/ directory (publint, attw, exports generation -- 821 lines, 16% of codebase).
  Post-build validation, not bundling. Would be better as a separate tool.
- CSS handling (160 lines). Admitted workaround until rolldown supports CSS syntax lowering natively.

### Known weaknesses (accepted)

- Test coverage skews toward utils; core pipeline (`build.ts`, `rolldown.ts`, `dep.ts`, `output.ts`) is untested.
- TSDoc nearly absent on the public `UserConfig` type surface.
- Six files exceed 200 lines; `resolveUserConfig` is a ~200-line procedural block.

### Why we're cautious about dropping it

- sxzz (Kevin Deng) is the author of both tsdown and `rolldown-plugin-dts`, a Vite team member,
  and works directly with the rolldown codebase. If raw rolldown were sufficient for library bundling,
  he wouldn't maintain a 5,000-line wrapper. The pain points he's solving likely include edge cases
  in CJS interop, DTS dual-format builds, shebang preservation, and `node:` protocol handling
  that don't show up in a feature matrix but break real packages on npm.
- Full source audit (2026-03-01) confirmed general code quality is high and nothing suspicious.
  The architecture is sound (config translator + plugin orchestrator), dependencies are reasonable,
  and there's no unnecessary complexity in the core path. The weaknesses listed above are
  engineering tradeoffs, not red flags.

### When to revisit

- Rolldown 1.0 stable ships (currently rc.6 as of 2026-02-26).
- Rolldown absorbs auto-external from package.json or ships a library preset.
- `rolldown-plugin-dts` gets absorbed into rolldown core.
- Any of these would shrink the gap enough to reconsider raw rolldown + mise.