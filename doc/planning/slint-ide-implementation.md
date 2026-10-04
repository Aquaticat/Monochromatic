# Slint IDE implementation proposal

## Status and purpose

The [0.x scope][scope] is accepted.
The user requests the build approach before implementation.
This document proposes architecture and sequencing;
no application implementation or integration spike has run yet.

## Architecture

Propose a standalone Rust plus Slint application under `package/desktop-app/ide`.
Follow the existing native application task and packaging conventions,
without modifying the paused editor.

Do not revive the Bun daemon or introduce an HTTP/WebSocket protocol for a local-only native application.
Use Helix internals behind application-owned modules,
not Helix's terminal UI or modal commands.

### Document module

Own the current immutable text snapshot,
revision,
caret,
selection,
and viewport anchor.
Disk is authoritative;
there is no dirty-buffer or save lifecycle.

On an external change:

1. Read the new file off the UI thread.
2. Compare old and new text and compute correspondence.
3. Map caret,
   selected range,
   and the visible source anchor through the changes.
4. Install the new revision only if its file identity and generation still match.
5. Notify language servers in their negotiated synchronization mode before requesting fresh intelligence.
6. Refresh syntax and annotations without holding for selection release.

Start with Helix's rope,
diff,
and change-set primitives.
Do not assume its default selection affinities satisfy the user's replacement example.
Test both supplied examples first,
and keep application-specific range-mapping policy separate if needed.
At installation,
map the latest caret/selection/scroll state for the displayed base revision,
not a stale interaction snapshot captured when background work started.

Own conversions between UTF-8 offsets,
Helix character positions,
negotiated LSP position encoding,
and display positions in one place.
Include tabs,
CRLF,
combining characters,
and multi-code-point graphemes in tests.

### Workspace module

Own local file reads,
lazy directory listings,
filesystem change observation,
and cancellable file-path/content searches.
Reuse editord's established search behavior as the starting reference,
including ripgrep rather than building a persistent search index.

Watch changes as invalidations,
then reconcile with disk.
Handle atomic replacement,
delete/recreate,
read failure,
and directory refresh without silently trusting an event stream forever.
Fence directory responses and search results by their own generations,
not only the open document's generation.

No filesystem mutation interface belongs in this module.
Navigating to a local dependency definition does not create another project root.
Validate returned paths and URI schemes before opening a target.

### Language module

Reuse `helix-lsp` client/registry behavior and Helix's language configuration where it fits the contract.
Start servers on demand,
maintain document lifecycle,
route the required feature requests,
and aggregate displayed-file diagnostics by source.

Distinguish unsupported capability,
missing executable,
starting server,
failed request,
and empty successful result.
Do not relabel a broken supported capability as unsupported.

Requests carry document identity and revision context.
Reject stale responses after navigation or reload.
Versioned diagnostics can be checked directly;
unversioned push diagnostics need an explicitly conservative freshness policy,
not a fictitious guarantee from request IDs.

Reject server-initiated workspace edits.
Do not expose formatting,
rename,
code-action mutation,
or execute-command workflows.
Run language-server processes with read-only project access and writable private tool state.
Cache environment redirection alone is not enforcement;
verify the actual subprocess write restrictions with disposable fixtures.

### Source-view module

Slint owns the native window,
file tree,
search surface,
popups,
scroll container,
and presentation.
The application owns source positions and reading interaction.

Propose a dedicated read-only code view rather than assuming stock `TextEdit` is a syntax-aware editor widget.
Use a shared layout model for highlighted text,
annotations,
selection geometry,
caret placement,
mouse hit testing,
and source-position lookup.
Do not layer independently laid-out invisible input and colored text without proving they remain aligned.

Investigate Helix's existing `DocumentFormatter` and `TextAnnotations` before writing layout logic.
They expose source positions,
grapheme traversal,
virtual text,
and visual coordinates.
Those coordinates use terminal-style columns;
matching them to Slint glyph geometry and font fallback is still a native integration check.

Materialize visible content and overscan rather than a widget per character across the entire file.
Keep the document model independent of that rendering decision.
Full-file reading and reconciliation are permitted;
UI work and background scheduling still need explicit bounds.

Inlay placement is decided by the first rendering probe.
Accessibility,
keyboard navigation,
copy fidelity,
and light/dark rendering are part of that probe,
not deferred decorative work.

## Reuse proposal

- `helix-core`:
  rope,
  change sets,
  diff,
  source-position primitives,
  syntax loading,
  highlighting,
  and reusable document/annotation formatting where native geometry verifies.
- `helix-lsp` and its required supporting crates:
  protocol transport,
  clients,
  capabilities,
  and synchronization.
- Helix language registry,
  queries,
  and selected runtime grammars:
  keep matching code/runtime versions and respect each asset's license.
- Existing repo Slint applications:
  native startup,
  task conventions,
  headless UI tests,
  and live host verification patterns.

Prefer Git dependencies on one inspected Helix revision over copying or forking the whole editor.
Keep the matching runtime assets versioned with those dependencies.
Document the revision pin as an integration-consistency requirement.
Retain MPL-2.0 notices and applicable source-distribution obligations.

The current Slint package version and Helix revision are source-inspection baselines,
not evidence that their combined application already compiles or runs.

## Build sequence and gates

1. Prove the source view and document correspondence in a disposable implementation spike.
   Require selectable highlighted text,
   click-to-caret,
   drag and keyboard selection,
   exact clipboard contents,
   annotations,
   scrolling,
   and both supplied external-change examples.
   Expose caret/selection and revision state to tests.
2. Build the live reader around that proven view:
   local root,
   lazy tree,
   search,
   file switching,
   and disk refresh.
   Verify races and stale responses at each interface.
3. Complete an end-to-end language-intelligence slice with actual TypeScript and Rust projects.
   Exercise all five feature paths,
   external reload synchronization,
   capability reporting,
   shutdown,
   and write restrictions.
4. Extend the verified path across the measured Helix-supported language inventory.
   Package the selected grammars and tool configuration;
   do not start every language server on launch or make the app an automatic dependency installer.
5. Verify the complete native application on the current host,
   run scoped lint/tests,
   and update the behavior-difference record.

These are implementation gates within one deliverable,
not permission to postpone required features to an unspecified later 0.x release.

## Evidence inspected

### Repository incumbents

- `package/desktop-app/terminal/Cargo.toml`:
  Rust/Slint 1.17 integration and renderer configuration.
- `package/desktop-app/terminal/ui/app.slint`:
  positioned text under a Slint `Flickable`.
  This is a rendering precedent,
  not proof of a complete selectable source view.
- `package/desktop-app/terminal/mise.toml` and `package/music-player/desktop-app/mise.toml`:
  scoped build/lint/test and Slint testing tasks.
- `package-paused/desktop-daemon/editord/src/server/operations/search.ts`:
  concurrent file-path and content searches.

### Helix

Source clone:
`~/temp/agent/slint-ide-languages.mEr8K9/helix`.
Revision:
`ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.

- `helix-core/src/diff.rs:141`:
  `compare_ropes` returns a transaction;
  line diff and bounded-hunk character diff are implemented in this file.
- `helix-core/src/transaction.rs:518`:
  `ChangeSet::map_pos` exposes position association policy.
- `helix-core/src/selection.rs:180`:
  default range mapping uses sticky endpoint associations.
- `helix-core/src/syntax.rs:514`:
  syntax creation/update and range highlighting.
- `helix-core/src/doc_formatter.rs:1` and `helix-core/src/text_annotations.rs:15`:
  grapheme/source-coordinate formatting and inline annotations.
- `helix-lsp/src/client.rs:211`:
  process launch and transport construction.
- `helix-lsp/src/client.rs:1081`:
  `text_document_did_change` honors negotiated full,
  incremental,
  or absent synchronization.
  Never force full-sync messages unconditionally.
- `helix-lsp/src/lib.rs:581`:
  registry with incoming calls and file-event handling.
- `helix-core/Cargo.toml` and `helix-lsp/Cargo.toml`:
  supporting crate dependencies do not require the terminal frontend.

### Installed Slint 1.17

Inspected the installed compiler and core sources under the Cargo registry.

- `i-slint-compiler-1.17.0/builtins.slint:1641`:
  `TextInput` owns a plain string;
  read-only selection and selection-offset setting are exposed,
  while cursor/anchor readback fields are marked internal/test-only.
- `i-slint-compiler-1.17.0/widgets/common/textedit-base.slint:6`:
  `TextEditBase` wraps `TextInput` and a scroll view.
- `i-slint-compiler-1.17.0/builtins.slint:731`:
  styled text is a separate element.

This identifies a rendering integration risk,
not a claim that Slint cannot implement the required viewer.
The proposed first gate must establish the usable implementation before the rest of the app depends on it.

## Next action

Explain this proposal to the user before implementation.
No application source files have been added or changed.

[scope]: ../decision/slint-ide-0x-scope.md
