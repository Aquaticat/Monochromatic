# Create element from selector technology vet

- Status: in progress
- Lifecycle phase: context and rubric frozen
- Subject: create element from selector package
- Scope: whether to resurrect `Aquaticat/createElementFromSelector` as a new Monochromatic package
- Start date: 2026-08-18
- Last updated: 2026-08-18
- Governing skill commit: `a05818ad70a40e5769a36de669697ba109891b31`
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`
- Compatibility fingerprint: `e87bdd7d4b6605a0ccb03eaab881b149ecae2bec68aaf10414a7fa0432cafd6f`
- Active audit owner: current Pi session, session identifier unavailable in the process environment
- Prior compatible report: none found

## Context

The proposed package would turn a constructible subset of CSS selector syntax into a live browser `HTMLElement`.
The question is whether a clean Monochromatic implementation of that capability deserves a separate package now.
Recommendation is not adoption, so this audit may change documentation only.

## Scope correction

The user clarified on 2026-08-18 that the upstream repository is known to be broken and is their own work.
This audit uses upstream only to identify the intended capability and example syntax.
Upstream implementation defects, packaging, tests, age, release history, and maintenance do not count against the idea.
A candidate called “clean selector-shorthand implementation” means a fresh implementation meeting current Monochromatic standards.

Measured repository context:

- `package/module/hyperscript` already exports `hDom`, a typed live-DOM element factory.
- Seventeen active or paused package manifests reference `@monochromatic-dev/module-hyperscript`.
- Active packages contain 45 `document.createElement` calls across 21 TypeScript files.
- No active or paused source references `createElementFromSelector`.
- No prior selector-to-element audit or decision document was found.

## Classification

- Base category: inspectable open-source local technology.
- Managed-service gates: not applicable because no hosted service is involved.
- Proprietary-local gates: not applicable because every eligible implementation must be inspectable.
- High-trust overlay: not applicable because this is ordinary browser DOM manipulation without credentials,
  agent execution, hooks, plugins, or CI execution.
- Native, Wasm, and prebuilt overlay: not applicable and prohibited by a hard constraint.
- Sensitive-data overlay: not applicable because selectors are application data and no data leaves the browser.
- Replacement overlay: not applicable because the proposal does not replace an external incumbent.
- Custom-implementation gate: applicable because the decision is about a fresh local implementation;
  existing internal and external mechanisms must fail a named requirement before custom code is recommended.
- Multi-platform overlay: not activated because no browser support matrix was requested.

## Hard constraints

- Produce a browser-native `HTMLElement`.
- Use inspectable open-source source.
- Introduce no native, Wasm, prebuilt, network, filesystem, or credential boundary.
- Permit reproducible validation in a disposable browser fixture.
- Preserve a single, documented interpretation for every accepted selector.
- Reject selector forms that cannot uniquely describe element construction.

## Frozen score criteria

No outcome-changing user preference remains unresolved.
Repository standards supply the relevant priorities, and each criterion has default weight 1:

- Demonstrated repository demand.
- API clarity and TypeScript precision.
- Parser and syntax-boundary correctness.
- Audit and dependency surface.
- Package cohesion.
- Maintenance viability.

Candidate-specific evidence has not changed these criteria or weights.

## Query schedule

The initial source lookup crossed the substantial-evaluation threshold before this report was created.
The literal tool inputs are reconstructed here before candidate scoring.
No candidate was promoted or rated before this schedule was recorded.

### npm registry

For each literal query, inspect pages of 20 results in registry relevance order until the registry is exhausted
or two complete consecutive pages add no screening survivor:

- `create element selector`
- `element from selector`
- `css selector dom create`
- `hyperscript selector`

### GitHub

For each literal query, inspect pages of 30 repositories in best-match order until GitHub is exhausted
or two complete consecutive pages add no screening survivor:

- `"createElementFromSelector" language:JavaScript`
- `"create element from selector" language:JavaScript`
- `"element from selector" DOM language:JavaScript`
- `"parse element selector" language:JavaScript`

Inspect repository code, releases, and organization projects for each screening survivor.

### Broader web

Run each literal query without include or exclude filters:

- `npm package "create element from CSS selector" JavaScript DOM`
- `npm "selector to element" DOM package`
- `GitHub "createElementFromSelector" JavaScript`
- `GitHub "create element from selector" "document.createElement" JavaScript`
- `JavaScript CSS selector shorthand hyperscript create DOM element library`
- `npm selector hyperscript DOM element package`
- `"@aquaticat/create-element-from-selector" alternative`
- `TypeScript CSS selector create DOM element library browser`

### This repository

Search active packages, paused packages, audits, decisions, planning documents, manifests, and source for:

- `createElementFromSelector`
- `document.createElement`
- `querySelector`
- `selector`
- `@monochromatic-dev/module-dom`
- `@monochromatic-dev/module-hyperscript`

## Initial candidate ledger

### Keep `@monochromatic-dev/module-hyperscript` and add no selector parser

- Discovery source: Monochromatic repository search.
- Base category: inspectable open-source local technology.
- Screening result: pending targeted validation.
- Category fit: creates live DOM elements, but intentionally uses structured options rather than selector strings.

### Build a clean selector-shorthand implementation

- Discovery source: user-named package idea, illustrated by `Aquaticat/createElementFromSelector`.
- Base category: inspectable open-source local technology.
- Screening result: pending category-fit and consumer-boundary validation.
- Evaluation unit: fresh Monochromatic code, not upstream source or package artifacts.

## Evidence records

### Monochromatic incumbent surface

- Candidate: `@monochromatic-dev/module-hyperscript` 0.0.1 at repository revision
  `a6f566173d90ef007c361b11edb4580fb7180925`.
- Claim: Monochromatic already owns a typed DOM factory with zero runtime dependencies.
- Decision relevance: a separate package must provide a distinct cohesive boundary rather than duplicate this capability.
- Gate: category fit and existing-tools precedence.
- Status: pass, with targeted validation pending.
- Primary source: `package/module/hyperscript/package.json`, `package/module/hyperscript/src/dom/index.ts`,
  and `package/module/hyperscript/README.md`, accessed 2026-08-18.
- Outcome: keep as a serious internal alternative.

### Package-idea definition

- Candidate: clean selector-shorthand implementation.
- Claim: the intended capability creates one live element from tag, ID, class, and constructible attribute syntax.
- Decision relevance: this defines the feature being evaluated without inheriting upstream implementation quality.
- Gate: category fit.
- Status: pending consumer-boundary validation.
- Primary source: <https://github.com/Aquaticat/createElementFromSelector>, README usage example accessed 2026-08-18.
- Outcome: keep as a serious conceptual alternative while excluding upstream artifact health from scoring.

## Evidence limits

The audit is not yet complete.
External discovery, equal-depth finalist validation, scoring, sensitivity analysis, and recommendation remain pending.
