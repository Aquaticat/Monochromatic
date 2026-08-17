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

## Source and dependency audit

### Clack

`@clack/prompts` has four direct runtime dependencies:
`@clack/core`,
`fast-string-width`,
`fast-wrap-ansi`,
and `sisteransi`.
Its local runtime graph contains two Clack workspace packages.
Measurement of their non-test `src` trees found 43 files and 5,607 lines.
The package also contains output helpers,
spinners,
progress displays,
path selection,
and other surfaces not needed by the target interaction.

[`packages/prompts/src/common.ts:69-74`][clack-common]
defines per-prompt input,
output,
signal,
and guide options:

```ts
export interface CommonOptions {
	input?: Readable;
	output?: Writable;
	signal?: AbortSignal;
	withGuide?: boolean;
}
```
[`packages/prompts/src/multi-select.ts:18-30`][clack-multiselect]
provides initial values,
required selection,
cursor placement,
and bounded rendering.
Ctrl+C and abort resolve to a cancel symbol rather than throwing.
[`packages/core/src/prompts/prompt.ts:130-180`][clack-prompt]
restores raw mode and the cursor on submit or cancel.

The high-level prompt styles are fixed in source.
For example,
[`packages/prompts/src/multi-select.ts:54-80`][clack-multiselect]
hard-codes cyan active and green selected states:

```ts
if (state === 'active') {
	return `${styleText('cyan', S_CHECKBOX_ACTIVE)} ${label}`;
}
if (state === 'selected') {
	return `${styleText('green', S_CHECKBOX_SELECTED)} ${label}`;
}
```
Callers can supply already-styled messages and labels,
but version 1.7.0 exposes no per-prompt theme contract.
A closed,
unreleased pull request titled
[`add theme support for text prompt customization`][clack-theme-pr]
confirms that theme work remains outside this release.

The custom-stream implementation has two audit findings.
[`packages/core/src/prompts/prompt.ts:267-286`][clack-prompt]
calls `input.unpipe()` during cleanup
and computes wrapping from `process.stdout.columns`
rather than the supplied output stream:

```ts
this.input.unpipe();
this.input.removeListener('keypress', this.onKeypress);

const frame = wrapAnsi(this._render(this) ?? '', process.stdout.columns, {
```
These do not prevent basic custom-stream use,
but widen caller effects and make custom-width rendering less exact.

The npm record includes a publish attestation and SLSA provenance.
The provenance maps the package digest to source commit
`dc5bce8aae84a57b5863124adfaa839c1db1fa23`
and the pinned reusable publish workflow.
No native,
Wasm,
install,
or lifecycle script appears in the runtime package manifests.
All inspected runtime licenses are permissive.

### Inquirer

`@inquirer/prompts` directly depends on ten prompt packages.
Its local runtime graph reaches 16 Inquirer workspace packages,
37 non-test source files,
and 3,975 lines.
The umbrella includes unused editor functionality,
which adds `@inquirer/external-editor`,
`chardet`,
and `iconv-lite` to an installation even when the consumer imports only input and checkbox.
Older umbrella versions reached vulnerable `tmp` through the former external-editor package.
Version 8.5.2 uses the repository-owned `@inquirer/external-editor` 3.0.3 without `tmp`,
so that historical advisory path is resolved.

[`packages/type/src/inquirer.ts:24-30`][inquirer-context]
defines caller-provided input,
output,
clear-on-completion,
and abort signal context:

```ts
export type Context = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  clearPromptOnDone?: boolean;
  signal?: AbortSignal;
};
```
[`packages/core/src/lib/create-prompt.ts:49-100`][inquirer-create]
uses those streams,
converts Ctrl+C into `ExitPromptError`,
and cleans up abort and signal listeners.
[`packages/checkbox/src/index.ts:70-101`][inquirer-checkbox]
provides per-choice initial checks,
required selection,
validation,
separators,
and a deep partial theme:

```ts
export type CheckboxConfig<Value> = {
  choices: ReadonlyArray<Value | Choice<Value> | Separator>;
  required?: boolean;
  validate?: (choices: ReadonlyArray<Choice<Value>>) => boolean | string | Promise<string | boolean>;
  theme?: PartialDeep<Theme<CheckboxTheme>>;
};
```

Inquirer exposes materially finer presentation control.
The checkbox theme covers icons,
message,
highlight,
disabled text,
errors,
help,
and selected-choice rendering.
Its tests exercise custom icons,
styles,
key-help rendering,
Vim and Emacs bindings,
abort signals,
and Ctrl+C rejection.

The registry record has an npm signature and a `gitHead`
matching source commit `bfd8710229e3d3c9784bef3bbfbd84c7bd09bb9e`.
It does not publish an npm provenance attestation for 8.5.2.
No native,
Wasm,
or package-install script appears in the consumed manifests.
The unused editor module can spawn an external editor when called,
but the target interaction never imports or invokes that export.
All inspected runtime licenses are permissive.

### Hard-gate outcomes

Both candidates pass:

- category fit;
- MIT license compatibility;
- inspectable tagged source;
- JavaScript or TypeScript artifact form;
- Node 20.17.0 baseline compatibility;
- one-line input;
- initial multi-selection;
- validation;
- caller-provided streams;
- AbortSignal support;
- Ctrl+C recovery;
- visible styling of caller-provided security text.

Neither built-in boolean confirmation meets a strict no-default requirement:
both treat Enter as an affirmative answer by default.
Both can implement explicit yes or no through a one-line text prompt whose validator rejects empty input.
This is equal adapter work rather than a hard-gate exit.

## Tests and platform evidence

The repository-wide source census found:

- Clack:
  30 test files,
  461 `test` or `it` calls,
  and 8,174 test lines;
- Inquirer:
  31 test files,
  375 `test` or `it` calls,
  and 11,175 test lines.

Neither repository contains fuzzing,
property-test,
or mutation-test wiring.
The searches were rerun against each clone root without negative path filters.

Clack's pinned reusable CI runs build,
types,
test,
and production-dependency checks on Ubuntu with Node 22.
No Windows or macOS job is present.

Inquirer's CI runs unit tests on Ubuntu and Windows
across Node 20,
22,
24,
and 26.
It also compiles,
lints,
checks package setup,
and exercises isolated ESM,
CommonJS,
npm,
and Yarn consumers on Ubuntu.
No macOS job is present.
Inquirer therefore has stronger published platform and consumer-boundary evidence.

## Maintenance audit

### Clack

`@clack/prompts` 1.7.0 was released 2026-07-03.
The ten most recently updated Issues within the retained year contained four maintainer comments
and ten maintainer actions such as labeling or closure.
The sampled activity involved several members or collaborators.

The ten most recently updated pull requests contained eight maintainer-authored or automation-authored changes.
Six were merged.
Five of those six received review by another maintainer;
the unreviewed merge removed a redundant test.
Measured creation-to-merge durations were approximately
0.3,
6.2,
6.2,
41.0,
42.9,
and 85.3 hours,
with a sample median of 23.6 hours.
An external cancel-symbol contribution was closed after a maintainer supplied a smaller replacement.

Maintenance is active and distributed across several contributors.
Release automation publishes through a pinned reusable workflow with npm provenance.

### Inquirer

`@inquirer/prompts` 8.5.2 was released 2026-05-31.
The ten most recently updated Issues within the retained year contained 14 maintainer comments
and eight maintainer actions.
All sampled maintainer comments came from the repository owner,
showing responsive but concentrated public support.

The ten most recently updated pull requests contained two owner-authored changes,
seven dependency-bot changes,
and one open external fix.
Nine were merged without recorded reviews.
Their sample median creation-to-merge time was approximately three minutes,
dominated by automated dependency updates.
The two owner-authored changes merged in approximately four and 14 minutes.

Maintenance is active,
but the sampled merge and support paths are concentrated in one maintainer.
The package tag maps to source through `gitHead`,
but the registry publishes no SLSA attestation for this version.

## External execution manifests

### Upstream Clack validation

- Candidate:
  `@clack/prompts` 1.7.0 at `dc5bce8aae84a57b5863124adfaa839c1db1fa23`.
- Image:
  `docker.io/library/node:22.18.0-slim`,
  local digest `sha256:752ea8a2f758c34002a0461bd9f1cee4f9a3c36d48494586f60ffce1fc708e0e`.
- Dependency-fetch command:
  `corepack enable && pnpm install --frozen-lockfile --ignore-scripts`.
- Validation commands:
  `pnpm run build`,
  `pnpm run types`,
  `pnpm run test`,
  and `pnpm run deps`.
- Static command tree:
  pnpm,
  TypeScript,
  unbuild,
  Vitest,
  and knip;
  package lifecycle scripts are disabled.
- Expected network:
  npm-compatible registries during dependency fetch only.
- Expected writes:
  disposable source copy,
  package-manager store,
  `node_modules`,
  and build or coverage output.
- Bounds:
  2 GiB memory,
  two CPUs,
  256 processes,
  disposable container,
  no host home,
  no credentials,
  and no repository mount.
- Success condition:
  every CI-equivalent command exits zero.
- Failure condition:
  any command exits nonzero or exceeds container bounds.

### Upstream Inquirer validation

- Candidate:
  `@inquirer/prompts` 8.5.2 at `bfd8710229e3d3c9784bef3bbfbd84c7bd09bb9e`.
- Image and resource boundaries:
  identical to Clack.
- Dependency-fetch command:
  `corepack enable && yarn install --immutable` with lifecycle scripts disabled.
- Validation commands:
  `yarn tsc`,
  `yarn oxlint .`,
  `yarn oxfmt --check .`,
  `yarn eslint .`,
  `yarn package lint --check`,
  and `yarn vitest --run --coverage`.
- Additional boundary commands:
  the repository's isolated ESM,
  CommonJS,
  npm,
  and Yarn fixture checks when their command trees remain inside the same inspected package-manager boundary.
- Static command tree:
  Yarn,
  TypeScript,
  oxlint,
  oxfmt,
  ESLint,
  package lint,
  Vitest,
  and repository isolation helpers;
  package lifecycle scripts are disabled.
- Expected network,
  writes,
  success,
  failure,
  cleanup,
  and host isolation:
  identical to Clack.

### Consumer-boundary validation

A separate secret-free fixture installs both exact packages with lifecycle scripts disabled.
It drives each package through caller-provided input and output streams and verifies:

- one-line input;
- preselected multi-selection;
- empty explicit-decision rejection;
- visible red security text;
- Ctrl+C cancellation;
- listener and raw-mode cleanup.

The fixture runs under the same container bounds.
Network is enabled only during installation and disabled during execution.

## Execution results

### Clack

The dependency fetch completed in six seconds with lifecycle scripts disabled.
The first offline validation attempt failed before candidate code ran
because the ephemeral Corepack cache tried to download pnpm with networking disabled.
Persisting the already-inspected pnpm 10.33.0 manager cache corrected that harness error.

The corrected run passed build and type checking,
then reported four snapshot failures in `packages/prompts/test/note.test.ts`:

```text
Test Files  1 failed | 17 passed (18)
Tests  4 failed | 593 passed (597)
```

Every failure expected nested red formatting to resume after nested cyan formatting,
but Node 22.18.0 emitted the foreground reset instead.
A positive control on Node 26.7.0 restored the outer red style.
Node's [`respect nested formats in styleText`][node-styletext]
landed after Node 22.18.0 and appears in the Node 22.19.0 release history.
Clack's engine range begins at Node 20.12.0,
so the checked-in snapshots assume behavior absent from part of the declared runtime range.

This failure is outside the consumed input,
multiselect,
and confirmation paths.
A focused offline rerun passed:

- every `@clack/core` test:
  148 tests in 12 files;
- `text`,
  `multi-select`,
  and `confirm` high-level suites:
  98 tests in three files;
- the production dependency check.

The exact default suite does not pass on Node 22.18.0,
but every target interaction suite does.
This reduces platform-confidence scoring rather than creating a target-path hard-gate failure.

### Inquirer

Dependency installation completed with lifecycle scripts disabled.
The offline CI-equivalent run remains in progress.

## Evidence limits

No candidate has been recommended yet.
The static audit and Clack execution are complete.
Inquirer execution,
consumer-boundary validation,
score calculation,
and sensitivity analysis remain pending.

[clack-common]: https://github.com/bombshell-dev/clack/blob/dc5bce8/packages/prompts/src/common.ts#L69-L74
[clack-multiselect]: https://github.com/bombshell-dev/clack/blob/dc5bce8/packages/prompts/src/multi-select.ts#L18-L80
[clack-prompt]: https://github.com/bombshell-dev/clack/blob/dc5bce8/packages/core/src/prompts/prompt.ts#L130-L286
[clack-theme-pr]: https://github.com/bombshell-dev/clack/pull/426
[inquirer-checkbox]: https://github.com/SBoudrias/Inquirer.js/blob/bfd8710/packages/checkbox/src/index.ts#L70-L101
[inquirer-context]: https://github.com/SBoudrias/Inquirer.js/blob/bfd8710/packages/type/src/inquirer.ts#L24-L30
[inquirer-create]: https://github.com/SBoudrias/Inquirer.js/blob/bfd8710/packages/core/src/lib/create-prompt.ts
[node-styletext]: https://github.com/nodejs/node/pull/59098
