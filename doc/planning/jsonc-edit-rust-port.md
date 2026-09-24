# Native Rust port of jsonc-edit

## Status

Design interview in progress. No implementation is authorized until the user confirms shared understanding.

## Existing boundaries

- `package/module/jsonc-edit` is a TypeScript JSONC parser, canonical emitter, immutable edit API, and attached-comment API. Its public exports are in `package/module/jsonc-edit/src/index.ts`.
- `doc/decision/jsonc-edit-parser-foundation.md` accepts the comment-as-data model, canonical serialization, and browser availability without WebAssembly for the TypeScript package.
- The TypeScript package has unit, property, conformance, and benchmark sidecars. A search of package and workflow source found no production import outside those sidecars; this does not establish that external consumers do not exist.
- The separate monorepo-manager design selects a Rust `jsonc-parser` wrapper for meow in `doc/planning/monorepo-manager-from-scratch-design.md`, under "Managed file editing". This port does not silently change that decision.
- `package/rust-module/forbidden-regex/Cargo.toml` is a standalone, published Rust-library precedent, while `.github/workflows/cargo-publish.yml` currently handles only the named crates in its dispatch and push paths.
- `mise exec rust -- cargo info jsonc-edit` and the same probe for `monochromatic-jsonc-edit` both reported that the package could not be found in the registry; neither name is reserved by that probe. `cargo search serde_json --limit 2` returned results as a positive control for registry queries.
- The [Cargo publishing guide](https://doc.rust-lang.org/cargo/reference/publishing.html) says published versions cannot be overwritten or deleted. The [crates.io Trusted Publishing guide](https://crates.io/docs/trusted-publishing) says initial publication requires an API token before trusted publishing can be configured for the crate. Existing workflow comments on the library's first release describe manual bootstrap.

## Decisions from the user

- Q1: Build for native Rust callers only. Do not require JavaScript bindings or browser execution of the Rust code.
- Q2: Maintain the TypeScript package alongside the Rust implementation. Do not freeze or retire it as part of this port.
- Q3: Expose an idiomatic Rust API with the equivalent public capabilities, rather than copying TypeScript call syntax.
- Q4: Expose exact JSON numeric values rather than JavaScript-number semantics. Preserve source number spelling for unedited literals as part of the established serialization contract.
- Q5: Duplicate object keys are user error and outside the supported behavioral contract. Interpret "undefined behavior" as unspecified library results for unsupported input, never permission for Rust memory unsafety or an unsafe-language contract; do not promise a particular parse or edit result for duplicates.
- Q6: Exact numeric values compare mathematically: `1`, `1.0`, and `1e0` compare equal. An unedited number retains its source spelling on output.
- Q7: Each edit returns a new state; the previous state remains usable. Do not make in-place mutation the public editing contract.
- Q8: Share supported-behavior fixtures across Rust and TypeScript, and fix confirmed unintended discrepancies in both during the port. The exact Rust number API is an explicit, tested exception to JavaScript-number parity.
- Q9: Port supported behavior, not necessarily the TypeScript parser algorithm. Vetted Rust parser components are allowed only if they preserve the attached-comment and edit contract; no dependency is selected yet.
- Q10: Publish the native Rust crate as part of this port, rather than keeping it private or only publication-ready.
- Q11: Name the published crate `monochromatic-jsonc-edit`, not `jsonc-edit`.

## Working baseline

A port retains the documented identity of the TypeScript library: JSONC container-root parsing, queryable attached comments, immutable edits, and canonical output. Documented behavior is the baseline, not unintended defects. Historical defect reports in `doc/planning/monorepo-manager-route-research/rust-structured-edits.md` need reproduction before they become acceptance criteria; that document also records later corrections to its research.

## Open decisions

- Exact public API surface, including low-level parse and emit capabilities, and whether internal artifact-test helpers remain public.
- First-publish authentication and workflow path, without asking for or exposing secrets. A local Cargo credential file exists, and `gh api user --jq .login` returned `Aquaticat`; neither proves crates.io publication rights or token validity.
- Native dependency foundation is a research and verification task, subject to the repository's choosing-technology gates rather than another user preference.
- Recheck name availability immediately before publish; registry lookup does not reserve names.

## Implementation baseline for confirmation

- Place the standalone crate in `package/rust-module/jsonc-edit`, with package name `monochromatic-jsonc-edit`, using the repository's Rust package tasks and license precedent. Use `0.1.0` for its first release, following existing Rust-library versions; preserve the current library's LGPL-3.0-or-later license. These are repository defaults, not separate changes to the user's requirements.
- Port the public parser, emitter, edit, navigation, errors, node and comment capabilities. Internal artifact-test helpers need tests, not identical public Rust exports. Preserve container-root JSONC syntax and canonical formatting. Edits are immutable. Document and test the exact-number divergence.
- Reuse the existing TypeScript conformance and property cases through language-neutral fixtures, adding focused differential tests for comments, edits, and output. When a supported-behavior defect is confirmed with a failing test, fix both maintained implementations, with documented exceptions for exact Rust numbers.
- Choose parser or numeric dependencies only after applicable source and consumer-boundary vetting. Do not adopt meow's selected editor merely because it exists, and do not replace meow's editor as part of this port.
- Verify the packaged crate by building and calling it from a disposable Rust consumer, then publish the checked artifact using an authorized token route. Extend the existing release workflow for subsequent releases only after the first publication, when the crate can be configured for trusted publishing.

## Next action

Ask the user to confirm the complete design before any implementation or publication. If confirmed, investigate the foundation and release mechanics, implement, verify and publish; if not, resume the design tree at the disputed decision.
