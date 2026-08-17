# Clack versus Inquirer for a standalone TypeScript CLI

- Status:
  in progress
- Lifecycle phase:
  finalists cloned for validation
- Subject:
  Clack versus Inquirer for a standalone TypeScript CLI
- Scope:
  compare `@clack/prompts` 1.7.0 and `@inquirer/prompts` 8.5.2
  without repository-incumbent or catalog preference
- Started:
  2026-08-16
- Last updated:
  2026-08-16
- Governing skill commit:
  `a05818ad70a40e5769a36de669697ba109891b31`
- Governing skill SHA-256:
  `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`
- Compatibility fingerprint:
  `4fcb5d1c98032259b8c3096cb47f033a3b264bda914b00cf81d9bd16f603e437`
- Active audit owner:
  current Pi session
- Prior compatible report:
  none found

## Context

The comparison intentionally removes repository context.
Neither an existing catalog entry nor another tool's dependency choice receives score credit.
The target is a local interactive TypeScript CLI with:

- one-line text input;
- multi-select pickers with initial selections;
- security-sensitive labels and visible styling;
- explicit yes-or-no decisions with no accidental default;
- clean Ctrl+C cancellation;
- caller-provided terminal streams.

The component handles local terminal input and output.
It does not receive credentials,
perform network requests,
or introduce native or Wasm execution.

## Decision context

### Hard constraints

- Cancel cleanly on Ctrl+C without reopening a controlling-terminal device.
- Customize security-sensitive prompt text and visible styling.
- Provide one-line text input,
  preselected multi-select choices,
  and explicit yes-or-no decisions.
- Remain inspectable open-source JavaScript or TypeScript without native or Wasm artifacts.
- Support caller-provided terminal streams.

### Classification

Both candidates are inspectable open-source local technologies.
Both receive the human-auditability and multi-platform terminal overlays.
There is no incumbent in this context.
The managed-service,
SaaS,
replacement,
credential,
native,
Wasm,
and prebuilt overlays do not apply.

### Frozen criteria

No relative priority was specified,
so every soft criterion has weight `1`.

- Required interaction ergonomics beyond the hard-gate minimum.
- Prompt-level styling and composition.
- Human auditability of the consumed runtime path.
- Runtime dependency and installation surface.
- Test and platform evidence.
- Maintenance and release provenance.

Each rating uses the governing skill's `0` to `4` scale.
Hard-gate failures remain outside arithmetic.
Unused prompt types receive no breadth credit.

## Discovery

### Frozen query schedule

#### Package registry

- Fetch `https://registry.npmjs.org/@clack%2fprompts/latest`.
- Fetch `https://registry.npmjs.org/@inquirer%2fprompts/latest`.
- Inspect package manifests,
  dependency lists,
  engine ranges,
  tarball integrity,
  signatures,
  and provenance metadata.

#### Repository host

- Clone the exact `@clack/prompts@1.7.0` tag from `bombshell-dev/clack`.
- Clone the exact `@inquirer/prompts@8.5.2` tag from `SBoudrias/Inquirer.js`.
- Inspect source,
  tests,
  CI,
  releases,
  issues,
  and pull requests for each.

#### Broader web

- Search `@clack/prompts vs @inquirer/prompts terminal prompt TypeScript comparison`.
- Inspect each candidate's official documentation.

#### Repository sources

The user explicitly requested a no-prior-repository-context comparison.
Repository dependencies and precedent are measured separately
but excluded from hard gates and scoring.

### Taxonomy expansion round

The first discovery pass added these terms:

- `multiselect` and `checkbox`;
- cancellation sentinel and `ExitPromptError`;
- custom streams and prompt context;
- styling and theme;
- `AbortSignal`.

One de-duplicated expansion round will inspect those terms in official source and tests.
The schedule is now frozen.

### Discovery result

The user fixed the pairwise candidate set to Clack and Inquirer.
The direct registry records,
official repositories,
and official documentation resolve both candidates.
The broader comparison query discovered no additional candidate within the requested pairwise scope.
Discovery is saturated with two screening survivors.

## Candidate ledger

### `@clack/prompts` 1.7.0

- Discovery source:
  npm registry and official `bombshell-dev/clack` repository.
- Base category:
  inspectable open-source local technology.
- Overlays:
  human auditability and multi-platform terminal support.
- Registry integrity:
  `sha512-y7/yvZ2TPAnR9+jnc00klvNNLkJiXFFrQA/hlLCcxA9a2A4zQIOimyFQ9XfwYKiGD1fb5GY8vbKIIgO8d5Tb2A==`.
- Source tag commit:
  `dc5bce8aae84a57b5863124adfaa839c1db1fa23`.
- Screening result:
  survives;
  targeted evidence pending.

### `@inquirer/prompts` 8.5.2

- Discovery source:
  npm registry and official `SBoudrias/Inquirer.js` repository.
- Base category:
  inspectable open-source local technology.
- Overlays:
  human auditability and multi-platform terminal support.
- Registry integrity:
  `sha512-IYR/3C/paEVVQYQvdDlFZVjRCJVYHHON0XXMH91KO9GSxs0TdKYWlUdvfQl2EfAHDxUaN3IBffkE/BDTh5nJ6g==`.
- Source tag commit:
  `bfd8710229e3d3c9784bef3bbfbd84c7bd09bb9e`.
- Screening result:
  survives;
  targeted evidence pending.

## Initial hard-gate screening

### License and inspectability

Both packages declare MIT licensing and resolve to public tagged source.
Their consumed implementations are JavaScript or TypeScript.
No native or Wasm artifact appears in either registry manifest.
Both pass initial license,
source-availability,
and artifact-form screening.

### Runtime baseline

- Clack requires Node `>=20.12.0`.
- Inquirer requires Node `>=23.5.0 || ^22.13.0 || ^20.17.0`.

The frozen deployment baseline is Node 20.17.0 or newer.
Both pass initial engine screening.

### Interaction fit

Registry metadata and prior source evidence show:

- Clack exports text,
  confirm,
  select,
  and multiselect prompts.
- Inquirer exports input,
  confirm,
  select,
  and checkbox prompts.

Exact cancellation,
stream,
styling,
and no-default behavior remain pending source validation.

## Evidence limits

No candidate has been executed or recommended yet.
Registry metadata establishes package identity and provenance leads,
not runtime behavior.
Source,
tests,
maintenance,
consumer-boundary validation,
scoring,
and sensitivity remain pending.
