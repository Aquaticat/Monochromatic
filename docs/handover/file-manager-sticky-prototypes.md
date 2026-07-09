# Handover: file-manager sticky prototypes, audit doc, and troubleshooting write-ups

Working session state for the sticky-layout prototype effort.
Update this file whenever a work unit lands so the context survives auto-compaction.

## What exists and is committed

- `packages/desktop-app/file-manager-electron`: sticky-flow Electron prototype.
  Model is a TS port of the original's `model.rs` (tests ported case for case);
  layout is `overflow: auto` plus `position: sticky` with flow numbers from `src/bands.ts`.
  Complete: README, zero oxlint findings, unit tests pass, nested-Wayland boundary test passes
  (`mise run //packages/desktop-app/file-manager-electron:test:wayland`).
- `packages/desktop-app/file-manager-gtk-sticky`: GTK variant.
  Reuses the original crate's public `model`/`fs`/`types` via path dependency;
  the lane engine plus solver is replaced by `src/band.rs`
  (`y = band_top + clamp(scroll - band_top, 0, band_height - PANE_HEIGHT)`).
  One absolute `GtkFixed` canvas (per-column canvases were stretched by hexpand propagation).
  Complete: README, clippy plus repo rust-linter clean, 8 unit tests pass,
  boundary test passes in under a second
  (`mise run //packages/desktop-app/file-manager-gtk-sticky:test:wayland`).
- `docs/audit/file-manager-sticky-flow.md`: first version of the audit (committed),
  currently references other docs; being expanded to fully self-contained with diagrams.

## Verified facts to preserve

- Both boundary tests share one key sequence (enter, left, enter, left, down, enter, backspace)
  and one shallow JSON state schema
  (`activePath`, `columnCount`, `overlapCount`, `paneCount`, `ready`, `rootPinned`,
  `scrolledDown`, `scrollTopPx`).
- Decisive assertions: `rootPinned: true` while `scrolledDown: true`, `overlapCount: 0`.
- Line counts (code lines, comments/blanks excluded):
  original lane engine 549 (`layout.rs` 170, `layout/lane.rs` 275, `lane/geometry.rs` 40,
  `layout/scroll.rs` 64); GTK sticky `band.rs` 75 plus `layout.rs` 227; Electron `bands.ts` 119.
- Behavioral deltas vs approved baseline (documented in the audit):
  release point at rail end vs lane-bottom-at-viewport-bottom;
  every parent sticks (not only roots); solver's gap compression gone; scope cuts
  (no thumbs/DnD/bulk closes in prototypes).

## Footguns encountered this session (all to get troubleshooting docs)

1. GTK4 hexpand propagation stretched per-column `GtkFixed` canvases ~74px;
   explicit `set_hexpand(false)` did NOT stop it empirically (docs say it should);
   probe built at the path in `/tmp/agent/probe-path.txt` to settle it; fix used: one absolute
   canvas (`file-manager-gtk-sticky` commit "one absolute canvas so panes align with bands").
2. GtkListView keyboard cursor unset until first arrow/`scroll_to`; bare Enter activates
   nothing; fix `list.scroll_to(0, FOCUS|SELECT, None)` (needs gtk4 feature v4_12).
3. Initial window focus lands on first focusable widget (header close button);
   Enter closed the pane; fix `close.set_focusable(false)`.
4. gtk4 feature v4_12 deprecates `CssProvider::load_from_data` -> use `load_from_string`
   (build-breaking under clippy -D warnings).
5. `serde_json::json!` macro expands to `Result::unwrap` -> trips repo clippy
   disallowed-methods; fix: build `serde_json::Map` explicitly.
6. nested-wayland-session drops keystrokes sent before the client maps its surface;
   fix: app mirrors a `ready` fact gated on GTK `connect_map`, tests wait for it.
7. tsdown: two configs sharing one `outDir`; the second run's default clean deletes the
   first's output (preload build deleted `main.mjs`); fix `clean: false` on the second config.
8. tsc `isolatedDeclarations`: exported computed const needs explicit type annotation (TS9010).
9. Electron sandboxed preload must be CommonJS (bundled as `.cjs` via its own tsdown config).
10. Electron under the nested compositor prints
    `Fatal Wayland communication error: Broken pipe` and a `Failed to shutdown` FATAL at quit;
    benign in passing runs; one early run flaked nonzero (unreproduced across 5 later runs).
11. Operational: AF_UNIX socket paths must stay under SUN_LEN (~108 bytes); deep scratchpad
    paths fail (`path must be shorter than SUN_LEN`), use `/tmp/agent/...`.
    Also `pkill -f <pattern>` matches the invoking shell's own command line and kills it.

## Remaining work in this session (user instructions)

- Write troubleshooting docs for EVERY footgun above (user: "Document every potential footgun.
  We have unlimited time."), following `.claude/skills/troubleshooting-doc` (required sections,
  GTK source trace with file:line citations, verification harnesses, upstream-filing decision
  with 6-constraint walk, `.out-of-scope/` check, duplicate search before any filing).
- Reference the troubleshooting docs from `docs/audit/file-manager-sticky-flow.md`.
- Expand the audit doc to be fully self-contained (no other doc needed to understand the
  layout), with diagrams (ASCII in code blocks, SVG/mermaid/HTML as useful).
  User authorized making it a self-contained HTML if that presents better; current plan:
  keep the canonical `.md` self-contained AND add a self-contained interactive
  `docs/audit/file-manager-sticky-flow.html` companion (live sticky demo), verified with
  agent-browser (console clean, interactions exercised) per repo rule VB5.
- Keep this handover updated after each landed unit; commit eagerly with scoped pathspecs.

## Investigation assets

- GTK expand probe: cargo project at the path recorded in `/tmp/agent/probe-path.txt`
  (`gtk-expand-probe`), prints widths and `compute_expand` for a plain vs
  `set_hexpand(false)` `GtkFixed` with an hexpanding child, under the nested compositor.
- Manual compositor driving: socket must live under `/tmp/agent/` (SUN_LEN);
  drive with python `socket.AF_UNIX` one-liners (`nc` is absent on this host);
  commands: `ping`, `key <name>`, `screenshot <abs path>`, `resize`, `quit`.
- GTK source for citations: clone the GitHub mirror `GNOME/gtk` shallowly under `/tmp/agent/`.

## Repo-rule notes that bit during this session

- `no-nullish-union` (repo oxlint): no `T | null` / `T | undefined` annotations; use optional
  properties, guards, or exported `unique symbol` sentinels (pattern now in
  `file-manager-electron/src/strip-types.ts`).
- `typescript/prefer-readonly-parameter-types` cannot model branded primitive intersections
  (precedent: `packages/module/jsonc-edit/src/edit-state.ts`); allow-list is only for types we
  do NOT control (user instruction); mutable-by-design carriers use scoped disable regions
  (precedent: `packages/rolldown-plugins/import-attributes/src/scan-importer.ts`).
- Boundary-test state files: shallow scalar objects only; assert equality on booleans/counts,
  never raw floats; make every step's expectation distinguishable from the previous state
  (e.g. `activePath` flips) so polling cannot false-pass.
