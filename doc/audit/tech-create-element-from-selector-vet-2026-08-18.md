# Create element from selector technology vet

- Status: in progress
- Lifecycle phase: discovery saturated and screening complete
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
- Ten active and seven paused package manifests reference `@monochromatic-dev/module-hyperscript`.
- Forty active TypeScript files import `hDom` and contain 234 `h({ ... })` calls.
- Eighteen active non-test TypeScript files still call `document.createElement` directly.
- No active or paused source requests or implements selector-string element creation.
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

## Discovery results

Discovery ended saturated with at least two screening survivors.
The survivors are internal package-topology options, not external dependency adoptions.

### npm registry query log

The provider was the npm registry search API, with no include or exclude filter and registry relevance order.
Every inspected page returned 20 entries.
A page was counted as adding a survivor only when an entry could produce a live browser element
or materially change the internal seam choice.

- `create element selector`: pages 1 through 6 inspected;
  new entries were `hast-util-parse-selector`, `hast-util-from-selector`, and `put-selector`.
  Pages 5 and 6 added no survivor.
- `element from selector`: pages 1 through 5 inspected;
  the only new entry beyond the first query was `hast-util-from-selector`.
  Pages 4 and 5 added no survivor.
- `css selector dom create`: pages 1 through 3 inspected;
  no new survivor appeared, and pages 2 and 3 added none.
- `hyperscript selector`: pages 1 through 5 inspected;
  new entries were `parse-sel`, `hyperscript`, and `hyposcript`.
  Pages 4 and 5 added no survivor.

The de-duplicated expansion round used taxonomy discovered in those results:

- `put selector`: pages 1 through 3 inspected;
  `put-selector` was already known, and pages 2 and 3 added no survivor.
- `selector based DOM creation`: pages 1 through 3 inspected;
  `crelt` was a new structured DOM-builder precedent, and pages 2 and 3 added no survivor.
- `simple CSS selector element`: pages 1 through 3 inspected;
  only already-known HAST utilities appeared, and pages 2 and 3 added no survivor.

Registry totals were too broad to represent category size because npm token search matches millions of unrelated packages.
The recorded two-page survivor rule, rather than the unstable total, controlled saturation.

### GitHub query log

The provider was GitHub repository search, with the literal language filters shown,
no exclusions, best-match order, and 30 entries requested per page.
Three pages were requested for every query, including empty pages after exhaustion.

- `"createElementFromSelector" language:JavaScript`: one result,
  `Aquaticat/createElementFromSelector`.
- `"create element from selector" language:JavaScript`: two results,
  the user-named repository and `egoist/create-element-from-selector`.
- `"element from selector" DOM language:JavaScript`: zero results.
- `"parse element selector" language:JavaScript`: one result,
  `hville/parse-element-selector`.
- Expansion `"put selector" DOM language:JavaScript`: one result,
  `kriszyp/put-selector`.
- Expansion `"selector-based syntax" "DOM elements" language:JavaScript`: one result,
  the same `put-selector` repository.
- Expansion `"simple CSS selector" element language:JavaScript`: two results,
  `syntax-tree/hast-util-parse-selector` and category-mismatched `cosmoslabs/selement`.

Every query was exhausted on page 1; pages 2 and 3 were empty.

### Broader web query log

The provider was Exa fast search with Linkup standard fallback, no include or exclude filter,
and provider-default ordering.
The initial queries returned the following result counts and new category-relevant candidates:

- `npm package "create element from CSS selector" JavaScript DOM`: 10 results;
  `dom-create-element-query-selector`, `dom-create-node`, `put-selector`, and HAST utilities.
- `npm "selector to element" DOM package`: 10 results;
  `dom111/element-from-selector`.
- `GitHub "createElementFromSelector" JavaScript`: seven results;
  no new package candidate.
- `GitHub "create element from selector" "document.createElement" JavaScript`: 10 results;
  `egoist/create-element-from-selector` and `dom-create-node`.
- `JavaScript CSS selector shorthand hyperscript create DOM element library`: 10 results;
  `hyperscript` and Mithril as framework precedent.
- `npm selector hyperscript DOM element package`: 10 results;
  `parse-sel` and `parse-element-selector`.
- `"@aquaticat/create-element-from-selector" alternative`: five results;
  no new candidate.
- `TypeScript CSS selector create DOM element library browser`: 10 results;
  HAST utilities and unrelated typed query tools.

The one permitted expansion round returned:

- `JavaScript "selector-based syntax" creating DOM elements`: 10 results;
  `put-selector` and `GilchristTech/make-element`.
- `JavaScript "simple CSS selector" create HTMLElement`: 10 results;
  `dom-create-element-query-selector`, `put-selector`, and `padolsey/satisfy`.
- `hyperscript selector strings DOM`: 10 results;
  no new creation-library candidate.

The fixed schedule and expansion round are complete.
Later taxonomy was recorded without recursively expanding discovery.

## Candidate ledger

### Keep `@monochromatic-dev/module-hyperscript` and add no selector parser

- Discovery source: Monochromatic repository search.
- Base category: inspectable open-source local technology.
- Screening result: pass.
- Category fit: creates live DOM elements, but intentionally uses structured options rather than selector strings.
- Lifecycle: finalist.

### Add a clean descriptor helper to `module-hyperscript`

- Discovery source: Monochromatic’s existing `hDom` seam plus external hyperscript precedent.
- Base category: inspectable open-source local technology.
- Screening result: pass.
- Category fit: provides the shorthand without creating another package seam.
- Lifecycle: finalist.

### Build a clean standalone selector-shorthand package

- Discovery source: user-named package idea, illustrated by `Aquaticat/createElementFromSelector`.
- Base category: inspectable open-source local technology.
- Screening result: pass.
- Evaluation unit: fresh Monochromatic code, not upstream source or package artifacts.
- Lifecycle: finalist.

### External live-DOM selector constructors

- Candidates: `create-element-from-selector`, `element-from-selector`, `dom-create-element-query-selector`,
  `dom-create-node`, `put-selector`, `hyperscript`, and `make-element`.
- Discovery sources: npm, GitHub, and broader web queries.
- Base category: inspectable open-source local technology.
- Screening result: excluded from finalist adoption as a decision-scope mismatch.
- Reason: these are useful precedent, but the user asked whether an owned capability deserves a new Monochromatic
  package seam; adopting an external package does not answer that topology question.
- Evidence effect: confirms that selector-like element descriptors are an established idea,
  with successful designs ranging from tag, ID, and class sugar to full tree builders.

### Parser-only and non-DOM utilities

- Candidates: `parse-sel`, `parse-element-selector`, `hast-util-parse-selector`,
  `hast-util-from-selector`, and `hyposcript`.
- Base category: inspectable open-source local technology.
- Screening result: hard-gate category mismatch.
- Reason: they return parsed metadata, HAST nodes, or server-rendered strings rather than a browser-native `HTMLElement`.

### Multi-element selector satisfiers

- Candidate: `satisfy`.
- Base category: inspectable open-source local technology.
- Screening result: hard-gate category mismatch.
- Reason: it creates selector-described trees and returns a `NodeList`, not exactly one `HTMLElement`.

### Structured external DOM builders

- Candidate: `crelt` and the object interface of `make-element`.
- Base category: inspectable open-source local technology.
- Screening result: excluded as duplicated by the existing `hDom` interface.
- Reason: existing-tools precedence favors the zero-runtime-dependency Monochromatic implementation already in use.

## Repository fit

### Capability overlap

`hDom` already owns the live-element construction seam.
Its structured options cover tag, class, text, HTML, attributes, styles, listeners, and children.
The proposed shorthand covers only tag, ID, classes, and constructible attributes before callers return to ordinary DOM mutation.
A separate package would therefore overlap an established interface while providing less end-to-end construction behavior.

The deletion test is unfavorable for a separate package.
Deleting a selector parser would replace each call with a slightly longer `hDom` object;
it would also delete the parser and its grammar tests rather than distribute equivalent complexity among callers.
That is a shallow package seam, not leverage.

### Existing caller evidence

The 234 active `hDom` calls demonstrate that structured element construction is already normal in this repository.
The remaining direct `document.createElement` sites mostly need behavior a selector string cannot carry:

- canvas contexts and dimensions;
- custom-element class methods and explicit type assertions;
- text, children, listeners, and dynamic properties;
- generated download anchors;
- style-node text;
- dynamic classes and state.

A selector shorthand could shorten literal class, ID, and attribute setup within some of those sites,
but none currently contains a selector-to-element workaround or request.

### Interface semantics

CSS selectors answer whether an existing element matches.
Element construction can interpret only a subset unambiguously.
Combinators, selector lists, pseudo-classes, pseudo-elements, negation, universal selectors,
and non-equality attribute operators do not uniquely specify one element to create.
The interface would therefore need callers to learn a new descriptor grammar that resembles CSS but is not CSS.

Structured `hDom` options preserve TypeScript inference from `tag`, allow editor completion for named fields,
and keep dynamic values outside a string grammar.
A selector string is concise for fixed literals but requires CSS identifier and attribute-value escaping when values are composed.
Runtime parsing can return a tag-specific element type only with a parallel template-literal type parser or a caller assertion.

### Seam placement if demand appears

The dependency is in-process browser DOM state, so no adapter or new seam is needed.
If a real caller later requires selector shorthand, the coherent location is an additional helper inside
`package/module/hyperscript/src/dom/`, beside `hDom`.
It should use a name such as element descriptor rather than claim full CSS-selector construction,
and its accepted grammar should be intentionally narrow and tested at the exported interface.

A standalone package becomes justified only if independent consumers need the shorthand without the rest of
`module-hyperscript`, or if the parser grows into a reusable, independently versioned grammar module.
No current repository evidence establishes either condition.

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

### Active caller adoption

- Candidate: keep the existing `hDom` construction seam.
- Claim: 40 active TypeScript files import `hDom` and contain 234 `h({ ... })` calls.
- Decision relevance: repository callers already use the structured interface at material scale.
- Gate: existing-tools precedence and demonstrated demand.
- Status: pass.
- Primary source: `package/`, searched 2026-08-18 with
  `rg --files-with-matches 'import .*hDom|hDom as' package --glob '*.ts'` and per-file `h({` counts.
- Outcome: retain as a finalist.

### Selector-shorthand demand

- Candidate: clean selector-shorthand implementation.
- Claim: no active or paused source contains selector-to-element code, requests, or workarounds.
- Decision relevance: a new package has no measured consumer yet.
- Gate: scored concern, not a hard failure.
- Status: low-signal range 0 through 1 for demonstrated demand.
- Primary source: `package/`, `package-paused/`, and `doc/`, searched 2026-08-18 for
  `createElementFromSelector`, `elementFromSelector`, `fromSelector`, and selector-shorthand terms.
- Counterevidence: the user’s question itself establishes interest in the capability, but not a consumer requirement.
- Outcome: keep as a finalist because absent current demand does not make the idea invalid.

### Package-seam depth

- Candidate: standalone clean selector-shorthand package.
- Claim: deleting the package removes its parser complexity and leaves callers with structured `hDom` objects.
- Decision relevance: the package would be shallow unless independent consumers or an independently reusable grammar appear.
- Gate: package cohesion.
- Status: scored concern.
- Primary source: `package/module/hyperscript/src/dom/index.ts` and 234 active `hDom` call sites,
  inspected 2026-08-18.
- Outcome: penalize the standalone package seam, not the underlying shorthand idea.

## Evidence limits

The audit is not yet complete.
External discovery, finalist concept validation, scoring, sensitivity analysis, and recommendation remain pending.
