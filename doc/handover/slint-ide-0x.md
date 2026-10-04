# Slint IDE implementation handover

## Purpose and immediate next action

Continue the authorized implementation,
not another scope interview.
The user confirmed the [scope][scope],
reviewed the [approach][plan],
and explicitly said to implement.
The IDE is **not complete**.
The latest request is to update this handover before continuing.

Next implementation action:
fix the repo-owned nested Wayland session's missing `--help` using clap,
then use that compositor for native IDE verification.
The user explicitly requested this additional fix after the existing binary rejected `--help`.

The user-facing response to this handover should state what was recorded and which work remains;
it must not claim the IDE or the clap fix is done.

## Confirmed requirements and later additions

The complete product contract is in [the accepted scope][scope].
Important later additions are:

- Implement editord's Ctrl+0 through Ctrl+9 navigation,
  including promotion,
  recency badges,
  ancestor expansion,
  and reveal.
  History remains session-local.
- Bundle JetBrains Mono for source text and Inter for UI text,
  with applicable font licenses.
  Do not rely on those families being installed on the host.
- Follow system light/dark appearance,
  including changes while running.
  There is no app-specific theme override.
- Use the repo-owned `package/cli/nested-wayland-session` for isolated native input,
  screenshots,
  and appearance verification.
- Add `--help` to that compositor using clap.

The user preapproves Helix-owned dependencies and explicitly waives a broad choosing-technology exercise.
Use actual API/source inspection and focused integration checks rather than restarting vendor selection.
Inlay placement is delegated to the implementation.
Language support is capability-aware and bounded by Helix;
private caches/temp files outside the project are allowed.

## Work queue

- [ ] Nested Wayland clap/help fix,
  including real CLI exit/output checks without a display.
- [ ] Bundled fonts,
  native registration,
  license/provenance records,
  and verification without installed copies of those font families.
- [ ] Native source-view interaction and external-change correspondence.
- [ ] Live file tree,
  search,
  file switching,
  and native Ctrl+digit navigation/reveal.
- [ ] Definition,
  references,
  hover,
  inlays,
  displayed-file diagnostics,
  and external-reload language-server synchronization.
- [ ] Measured Helix runtime languages and subprocess project-write confinement.
- [ ] System-theme verification in both modes and during a theme change.
- [ ] Complete scoped lint/tests,
  consumer-boundary verification,
  packaging,
  and all behavior-difference documentation.

The document tests passing is not a completion boundary for this queue.

## Current IDE implementation

Package:
`package/desktop-app/ide`.

- `src/document.rs` owns a Helix rope,
  content revision,
  caret/selection,
  and viewport source anchor.
  It prepares reloads using `compare_ropes` and rejects a reload whose base revision is stale.
  Selection mapping uses application-selected affinities,
  not substring relocation.
- `tests/document.rs` contains the supplied caret and replacement-selection cases,
  reverse selection,
  Unicode prefix,
  deletion,
  stale reload rejection,
  and selection movement while a reload is pending.
- `src/view_model.rs` produces visible grapheme cells and hit-test geometry.
  It accounts for tabs,
  wide graphemes,
  and combining sequences.
- `tests/view_model.rs` adds geometry,
  source-copy,
  viewport,
  CRLF,
  and empty-document tests.
  These were written after the successful document-test run and have not been run yet.
- `src/recent.rs` implements ten unique push-to-front history slots and exact Ctrl+digit decoding.
  `tests/recent.rs` covers eviction,
  promotion,
  Ctrl+1 toggling,
  empty slots,
  and modifiers.
  These tests have not been run yet.
- `src/native.rs` binds the current source-view gate to Slint.
  It opens one supplied file or an explicit in-memory fixture.
  It wires pointer selection,
  select-all,
  left/right,
  Home/End,
  and Copy.
- `ui/app.slint` paints glyphs and the caret inside a `Flickable`,
  with viewport-limited line numbers and a read-only accessible source value.
  A hidden `TextInput` is used only as a toolkit clipboard bridge,
  not as a separately laid-out input underneath the source.

### Important unfinished behavior

- Native Ctrl+0 through Ctrl+9 is **not wired yet**.
  Only the history/decoding module and tests exist.
- There is no file tree,
  search surface,
  in-file find,
  or file-watching loop yet.
- There is no runtime syntax parser or language-server integration yet.
  Native `styles` is currently empty,
  so the screenshot proves plain-text rendering,
  not syntax highlighting.
- The UI's accessibility description already mentions automatic external refresh,
  but the running gate has no watcher.
  Correct that claim or implement the path before treating the UI as user-ready.
- Up/down,
  PageUp/PageDown,
  full focus navigation,
  and live viewport preservation still need work.
- Horizontal content width is currently a fixed 240 cells;
  replace that with measured document geometry before claiming arbitrary-line navigation.
- Fonts are referenced by family name but not bundled yet.
- Clippy,
  Rust documentation/line-budget checks,
  formatting,
  and the new tests have not all been run.

## Verified results

- `mise run //package/desktop-app/ide:fetch` succeeded.
- `mise run //package/desktop-app/ide:test` ran **7 document tests**, all passing.
  It did not include the subsequently added recent-file and view-model tests.
- `mise run //package/desktop-app/ide:build` succeeded after the key adapter fix.
- `mise run //package/desktop-app/ide:mcp` built with `slint/mcp`,
  launched headlessly,
  and exposed its native UI inspection server.
- MCP reported a 1100 by 660 window and a read-only source element containing the exact fixture text.
- A screenshot was captured and inspected at
  `~/temp/agent/slint-ide-languages.mEr8K9/source-view.png`.
  It shows the light-mode plain-text gate,
  not the finished IDE or verified system-theme behavior.

No native pointer/keyboard/clipboard regression sequence has been completed yet.
Neither supplied external-change example has been exercised through a running file-watching GUI yet.

## Running process and inspection interface

At handover creation,
`process list` reported:

- Process ID:
  `proc_37fc`.
- Name:
  `ide-headless-source-view`.
- Command:
  `mise run //package/desktop-app/ide:mcp`.
- MCP endpoint:
  `http://127.0.0.1:9317/mcp`.
- Logs:
  `/tmp/pi-processes-UdAlmh/proc_37fc-stdout.log` and
  `/tmp/pi-processes-UdAlmh/proc_37fc-stderr.log`.

Inspect the current process list before starting another instance.
Handles and process IDs are session-local and must be rediscovered if the process is restarted.

The tool registry did not expose this dynamically started MCP server;
raw loopback HTTP calls worked.
Use JSON-RPC `tools/call` with
`Content-Type: application/json` and `Accept: application/json, text/event-stream`.
Tool results wrap JSON text inside `result.content`.

Observed handles:
window `{generation: "1", index: "1"}`;
root element `{generation: "1", index: "1"}`;
`AppWindow::code-focus` element `{generation: "1", index: "2"}`.
Window and element handles are not interchangeable despite the identical shape.

`tools/list` exposed:
`list_windows`,
`get_window_properties`,
`get_element_tree`,
`get_element_properties`,
`find_elements_by_id`,
`query_element_descendants`,
`take_screenshot`,
`click_element`,
`drag_element`,
`hover_element`,
`move_pointer`,
scroll dispatch,
accessibility actions,
`set_element_value`,
`dispatch_key_event`,
and event recording.
Read current schemas before invoking them.

`dispatch_key_event` takes `eventType` of `Press`,
`Release`,
or `PressAndRelease` and encoded `text`.
Installed Slint 1.18.1 defines Control as U+0011,
Shift as U+0010,
left arrow as U+F702,
and right arrow as U+F703.
These are app-local events through the inspection server,
not host desktop synthetic keyboard injection.

## Build and generated-file constraints

Cargo tasks use the existing `localhost/monochromatic/terminal` build image.
They mount only this package and the dedicated `ide-cargo` volume,
with 2 GiB RAM,
2 CPUs,
512 processes,
4096 file descriptors,
and two Cargo jobs.
They do not mount the user's home or credentials.

Cargo resolved Slint and slint-build to **1.18.1**.
The earlier design inspection used 1.17.0;
read the installed 1.18.1 interfaces when implementing.
The Cargo cache is available at:
`~/.local/share/containers/storage/volumes/ide-cargo/_data`.

Root `file-enforcer.config.ts:1517` owns the Slint dependency shape.
It rewrote our optional dependency to an unconditional one.
The initial GUI feature then caused Cargo to report:
`feature gui includes dep:slint, but slint is not an optional dependency`.
The fix preserves the generated dependency and makes `gui = []` gate only UI code generation.
Do not restore the old optional dependency against its owner.

`rustc E0277` rejected comparing `SharedString` directly with a Slint `Key`.
The fixed adapter uses `SharedString::from(Key::...)`,
backed by `i-slint-core-1.18.1/input.rs:386`.

Slint's compiler warned that `viewport-width`,
`viewport-height`,
and `viewport-y` were deprecated.
The current markup uses `content-width`,
`content-height`,
and `content-y`.

## Nested Wayland help fix

This additional task is explicitly authorized.
No source changes for it have been made yet.

Relevant files:

- `package/cli/nested-wayland-session/src/cli.rs`:
  manual parser,
  configuration record,
  and size parser;
  includes duplicate handling blocks for isolation/CPU options.
- `src/cli_tests.rs`:
  existing color-scheme parsing tests.
- `src/main.rs`:
  calls `parse_args(&args).context("parsing command-line arguments")?` before `run(config)`.
- `src/lib.rs`:
  reexports `parse_args` and `Config`.
- `Cargo.toml`:
  no clap dependency yet.
- `mise.toml`:
  package build/test tasks exist,
  but their container invocation currently has no memory/CPU bounds.
  Bound compilation when running this task.

The executable is not on PATH.
An existing binary is at:
`package/cli/nested-wayland-session/target/release/monochromatic-nested-wayland-session`.
Its real invocation with `--help` returned exit 1 and:
`unknown flag: --help`.
The package was clean when last inspected.

Use clap as requested.
Root Cargo policy already defines clap as version `4` with `derive` enabled;
using its builder interface is also compatible.
Inspect installed clap interfaces before use.

Preserve these token forms:

- Parent options followed by `-- app --help` forward `--help` to the child.
- `app --help` forwards the child option after the command starts.
- Bare parent `--help` and `-h` print help and exit 0 without starting Wayland.
- Unknown parent options remain usage errors,
  not accidental executable names.
- Missing required values and a missing child command remain errors.
- Existing socket,
  size,
  color-scheme,
  isolation,
  CPU quota,
  and CPU weight options remain available.

Preserve or deliberately account for the public `parse_args` error interface.
A clap help error must not get wrapped into an ordinary anyhow failure that exits 1.
Verify the built binary with display-related environment variables absent.

Also propose tightening `AGENTS.md` rule `VB1` to include successful no-startup CLI help verification.
This policy proposal is not yet applied or accepted.
Suggested replacement body:

> Servers: check responses.
> CLIs: run real commands and check output;
> `--help` must exit 0 without normal startup.
> Hooks/plugins: trigger via host.
> Libraries: test from a consumer.

## Fonts and system theme

No font assets have been downloaded into the package yet.
The host currently resolves:
`~/.local/share/fonts/JetBrainsMono-Regular.ttf` and
`~/.local/share/fonts/Inter-Regular.ttf`.
That explains the initial rendering and is not bundling verification.

Official release metadata inspected:

- JetBrains Mono `v2.304`:
  `https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip`.
- Inter `v4.1`:
  `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip`.

Both upstream font licenses were fetched and identify SIL Open Font License 1.1.
Include the release's copyright/license notices and record asset checksums.
Bundle the faces actually used by the UI,
including its non-regular weight if required.

Slint source supports declarative font imports such as `import "font.ttf";`.
`slint-build` exposes `CompilerConfiguration::embed_resources(EmbedResourcesKind::EmbedFiles)`;
Rust output defaults to embedded resources,
but configure/test this explicitly rather than rely on a build-machine font path.
A top-level Rust `slint::register_font_from_memory` function was not found;
avoid inventing that API.

The current UI uses `Palette.background`,
`Palette.foreground`,
selection colors,
and `Palette.color-scheme` for token palette branches.
The host portal probe returned appearance value **1**, meaning dark.
The headless screenshot was light;
it is not evidence of host-theme tracking.

Read [the private theme-portal investigation][theme] before native verification.
The nested compositor supports startup `--color-scheme dark|light` using a private session bus.
Do not change host KDE appearance for tests.
A runtime theme-switch command was not established;
inspect the portal and its signal path before claiming dynamic theme-change verification.

## Helix and runtime evidence

Source clone:
`~/temp/agent/slint-ide-languages.mEr8K9/helix`.
Revision:
`ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.
The app's Helix dependencies are pinned to this revision for integration consistency.

Useful interfaces already inspected:
`compare_ropes`,
`ChangeSet::map_pos`,
`syntax::Loader`,
`Syntax`,
`DocumentFormatter`,
`TextAnnotations`,
and `helix-lsp::Client`/`Registry`.

The current tree-house highlighter is an event-offset API,
not the older start/end/source iterator shape.
Inspect its installed `highlighter.rs` before writing the adapter.

`helix-loader::config::default_lang_config()` supplies the built-in language registry.
`helix-loader::grammar::{fetch_grammars, build_grammars}` exist,
but runtime grammar preparation has not been implemented.
Respect configured synchronization mode when calling `text_document_did_change`.

The installed `/usr/bin/hx` reports `25.07.1 (a05c151b)`.
`hx --health typescript` found a parser,
queries,
and `typescript-language-server` at
`~/.local/share/mise/installs/npm-typescript-language-server/6.0.0/bin/typescript-language-server`.
The installed Helix runtime directory has not been located.
Probes of `/usr/share/helix/runtime` and `/usr/lib/helix/runtime` failed;
a broad RPM/find lookup timed out and no such probe process remained afterward.
Do not infer that the parser assets are missing or assume compatibility with the pinned Helix revision.

## Commits and worktree safety

Task commits:

- `913d8be3f`:
  package scaffold.
- `1e0f83090`:
  document correspondence and acceptance tests.
- `5ef871936`:
  initial test evidence.
- `c3aa4f535`:
  native source-view gate.
- `89edaf1bd`:
  recent-file module and generated-manifest adaptation.
- `9ccd1f8d8`:
  native key conversion fix and layout tests.
- `f12aef03c`:
  isolated native inspection task.

At handover creation,
`git status --short` showed only untracked `package/desktop-app/ide/LICENSES/`.
Those GPL/LGPL texts appeared through the repository's file enforcement;
preserve them and include them appropriately rather than deleting them.
Earlier unrelated changes were concurrent work and were not reverted.

Recheck status before editing.
Commit only explicitly scoped task paths;
auto-push is enabled.

[scope]: ../decision/slint-ide-0x-scope.md
[plan]: ../planning/slint-ide-implementation.md
[theme]: ../troubleshooting/slint-nested-color-scheme-portal.md
