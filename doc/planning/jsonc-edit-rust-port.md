# Native Rust port of jsonc-edit

## Status

Design interview in progress. No implementation is authorized until the user confirms shared understanding.

## Existing boundaries

- `package/module/jsonc-edit` is a TypeScript JSONC parser, canonical emitter, immutable edit API, and attached-comment API. Its public exports are in `package/module/jsonc-edit/src/index.ts`.
- `doc/decision/jsonc-edit-parser-foundation.md` accepts the comment-as-data model, canonical serialization, and browser availability without WebAssembly for the TypeScript package.
- The TypeScript package has unit, property, conformance, and benchmark sidecars. A search of package and workflow source found no production import outside those sidecars; this does not establish that external consumers do not exist.
- The separate monorepo-manager design selects a Rust `jsonc-parser` wrapper for meow in `doc/planning/monorepo-manager-from-scratch-design.md`, under "Managed file editing". This port does not silently change that decision.

## Decisions from the user

- Q1: Build for native Rust callers only. Do not require JavaScript bindings or browser execution of the Rust code.
- Q2: Maintain the TypeScript package alongside the Rust implementation. Do not freeze or retire it as part of this port.
- Q3: Expose an idiomatic Rust API with the equivalent public capabilities, rather than copying TypeScript call syntax.
- Q4: Expose exact JSON numeric values rather than JavaScript-number semantics. Preserve source number spelling for unedited literals as part of the established serialization contract.
- Q5: Duplicate object keys are user error and outside the supported behavioral contract. Interpret "undefined behavior" as unspecified library results for unsupported input, never permission for Rust memory unsafety or an unsafe-language contract; do not promise a particular parse or edit result for duplicates.

## Working baseline

A port retains the documented identity of the TypeScript library: JSONC container-root parsing, queryable attached comments, immutable edits, and canonical output. Documented behavior is the baseline, not unintended defects. Historical defect reports in `doc/planning/monorepo-manager-route-research/rust-structured-edits.md` need reproduction before they become acceptance criteria; that document also records later corrections to its research.

## Open decisions

- Exact public API surface, including low-level parse and emit capabilities, and whether internal artifact-test helpers remain public.
- Whether equal-valued JSON number spellings compare equal in the exact Rust value API, while retaining original spelling when unedited.
- Whether edits return new immutable states, mutate a Rust state, or expose both.
- How maintained TypeScript and Rust implementations share conformance checks and fixes for supported behavior, except the explicit numeric difference.
- Validation and release boundaries after the semantic contract is settled.

## Next action

Continue the design-tree interview on numeric representation, duplicate-key guarantees, and any independent public-surface decisions. Do not implement the crate before the user confirms the complete design.
