# Slint IDE implementation handover

## Purpose and next action

Continue the authorized implementation of `package/desktop-app/ide`.
The user confirmed [the scope][scope] and [the approach][plan],
then authorized implementation.
A checkpoint is not a pause:
continue the queue without asking the user to say “continue”.
The application remains an incomplete source-view gate.

Current boundary:
continue workspace tree/search/navigation after the verified font fixes.
The read-only workspace model's five tests and the lazy tree model's eight tests pass.
`FileTree` accepts directory snapshots without doing filesystem I/O.
Opaque directory-request identities now fence replies;
`proc_36aa` passed all fifteen tree/request tests and scoped Rust lint.
`DirectoryWorker` now performs bounded background reads with admission before token creation;
`proc_ab5d` passed all twenty tree/request/worker tests plus scoped Rust lint.
Native tree rows,
file switching,
and Ctrl+digit promotion/reveal are now bound.
Native callback tests and scoped lint pass in `proc_ee8d`.
Actual nested Wayland mouse/keyboard/clipboard navigation checks pass in
`/tmp/monochromatic-ide-native-bOrX20/interaction.mjs` and `edge-probe.mjs`.
Next verify off-screen reveal and Tab traversal,
finish the remaining guard controls/formatting,
then continue combined search and in-file find.
New identity/admission and file-open-generation guard controls remain to be exercised in the disposable copy.
The procedural-macro and variable-font paths now both pass native font isolation.
Continue annotations and language intelligence after workspace navigation.
Actual TypeScript/Rust syntax is now wired and the highlighted native screenshot was inspected.
The simplified UI,
nested clipboard,
and live external-change correspondence are verified.
Do not restart technology selection:
Helix reuse and the standalone Rust/Slint architecture are approved.

## Confirmed contract

- Current Linux x86_64 KDE/Wayland host only;
  local projects,
  one project root/window/source view.
- Read-only source navigation:
  file tree,
  combined path/content search,
  syntax highlighting,
  line numbers,
  caret/selection/copy,
  in-file find.
- Definition,
  references,
  hover,
  inlay hints,
  and displayed-file diagnostics,
  according to actual backend capabilities.
- Coverage is actual repository source/configuration languages found by `tokei`,
  intersected with Helix support.
  Documentation fences do not expand semantic coverage.
  No custom integrations for unsupported languages.
- No direct or delegated project-file writes.
  Scoped private caches and temporary files outside the project are allowed.
  Cache relocation alone is not write confinement.
- External changes refresh during selection,
  preserving best-effort source correspondence and roughly stable viewport.
  Required cases are `I am a bi|g cat.` to `I was a bi|g cat.`,
  and `I [am a] big cat` to `I [was a] big cat, but now I am a human!`.
  The selection must not jump to the later occurrence of `am a`.
- Ctrl+0 through Ctrl+9 match editord:
  unique MRU slots,
  promotion,
  tree badges,
  ancestor expansion,
  reveal,
  and session-local history.
  Ctrl+0 is the current file;
  Ctrl+1 alternates the last two after promotion;
  empty slots do nothing.
- Bundle Inter and JetBrains Mono with their licenses.
  Follow system appearance,
  including runtime changes,
  without an app-specific override.
- Shared CJK/Latin baseline and advance geometry.
  The independently centered per-grapheme screenshot was rejected.
- Genuine pixel-level smooth scrolling with a notched wheel,
  following music-player's native `Flickable` approach.
- Minimal visible UI.
  The user rejected the read-only indicator and Copy button.
  Those controls and the debug footer are removed from the current markup.
  Copy stays on Ctrl+C;
  accessibility retains read-only semantics;
  actionable errors appear only when needed.
- Record every deliberate difference from editord.
  Editing,
  saves,
  formatting,
  refactoring,
  filesystem mutations,
  go-to-line,
  tabs/splits,
  multiple roots,
  Git/status/diff UI,
  terminal/task/agent control,
  project-wide problems,
  rendered/media previews,
  persistent restore,
  remote support,
  and additional platforms are excluded.

## Work queue

- [x] Implement and verify nested compositor clap help and isolated clipboard support.
  Full package tests now report 40 passing cases,
  including wheel protocol and joined-option cases.
  Release build and post-wheel Clippy pass.
  Debug/release help exit 0 before Wayland startup.
  Native text/binary clipboard lifecycle checks pass.
  Hosted children no longer inherit X11 fallback variables.
- [x] Bundle and verify font embedding.
  Inter Regular/SemiBold and JetBrains Mono Regular are imported by Slint.
  `build.rs` explicitly selects `EmbedResourcesKind::EmbedFiles`.
  Generated Rust embeds/registers the bytes.
  Native fontconfig excludes host copies of those families.
- [ ] Complete native source-view interaction,
  clipboard readback,
  CJK/combining/tab boundary coverage,
  source rendering,
  and smooth-wheel acceptance.
- [x] Implement live external refresh and exercise both supplied correspondence examples through the GUI.
- [ ] Implement tree,
  search,
  in-file find,
  file switching,
  and native recent-file reveal/badges.
- [ ] Implement runtime syntax and language-server paths:
  definition,
  references,
  hover,
  hints,
  displayed-file diagnostics,
  and reload synchronization.
- [ ] Provision measured Helix runtime language coverage and enforce subprocess project-write confinement.
- [ ] Verify light mode and live system-theme changes using the private portal,
  not host KDE settings.
- [ ] Finish scoped formatting,
  Rust documentation/line budgets,
  Clippy,
  tests,
  packaging,
  consumer-boundary checks,
  and behavior-difference documentation.

## Current source boundaries

`src/document.rs` owns the Helix rope,
content revision,
selection,
caret,
and viewport anchor.
`prepare_reload()` uses `compare_ropes`;
`apply_reload()` rejects stale revisions and maps the latest reading state.
Its seven tests include both required correspondence cases,
reverse selection,
Unicode prefix,
deletion,
stale result rejection,
and selection movement while a reload is pending.

`src/file_reload.rs` reads regular UTF-8 source without filesystem mutation.
`src/reload_worker.rs` allows one outstanding job/reply on bounded channels,
computing reads and Helix correspondence on a named background thread.
File generations accompany replies;
the document still rejects stale content revisions.
`src/native/reload.rs` polls replies every 20 ms and submits reads at 250 ms intervals.
It applies changes to the latest selection,
retains fractional viewport placement,
and keeps the last readable text with an actionable error on read failure.
Its library tests and native build pass.
The live GUI verifies both required correspondence cases,
fractional viewport preservation after a prefix line,
and missing-file retention/recovery.
The probe is `/tmp/monochromatic-ide-reload-probe-STkJVk/probe.mjs`;
its native fixture is `/tmp/monochromatic-ide-native-zCPqiB/fixture.ts`.
Caret x changed from 137 to 146 while y remained 34,
and the next copied grapheme remained `g`.
Selection copied `was a`,
not the later literal.
Viewport offsets changed from -240.5 to -264.5 for one inserted line.
The selection screenshot was inspected.

`src/recent.rs` implements ten unique push-to-front slots and exact Ctrl+digit decoding.
Its four tests pass.
It is not yet wired to file switching or the native tree.

`src/text_projection.rs` preserves source/display correspondence through expanded tabs.
`src/shaped_text.rs` uses Parley 0.11 layouts for glyph advances,
fallback baselines,
caret,
selection,
and hit testing.
`src/text_raster.rs` uses Swash 0.2 to paint those exact glyph runs into premultiplied RGBA.
Both dependencies were already present through Slint.
The raster has a 64 MiB viewport allocation limit.

`src/glyph_cache.rs` adds bounded reuse of glyph masks/color images:
16 MiB of image data and 4096 entries.
Keys retain font blob/face,
size,
variation coordinates,
glyph ID,
and exact fractional position bits.
Empty glyphs are cached too.
Theme colors are applied while compositing alpha masks.

`src/source_frame.rs` distinguishes paint inputs from collapsed caret movement.
The native renderer reuses its image and shaped geometry for caret-only changes.
Selection range,
source revision,
syntax spans,
viewport tile,
scale,
horizontal origin,
and palette invalidate painting.
Reset the stamp and accessibility revision when replacing the displayed document with another file.

`src/native.rs` owns the current UI-thread state and startup.
`src/native/render.rs`,
`src/native/input.rs`,
and `src/native/viewport.rs` separate presentation,
input,
and native scrolling.
Pointer selection,
Ctrl+A,
left/right,
Home/End,
and Copy are wired.
A hidden `TextInput` is only a clipboard bridge,
not a second text layout.

Unfinished surfaces:
no tree,
search,
find,
file switching,
LSP,
or write confinement exists yet.
Up/down,
PageUp/PageDown,
and focus navigation remain incomplete.
The accessible description no longer claims automatic refresh before that path exists.
Legacy terminal-cell geometry and tests in `view_model.rs` were removed on 2026-10-04.
The retained `StyleSpan` now lives in `source_style.rs`.

## Verification and measured rendering issue

The complete IDE suite before render reuse passed 21 tests:
seven document,
four recent,
five shaped-text,
and five legacy view-model cases.
The shaped build and Slint markup check passed.
A native dark screenshot was inspected at
`/tmp/monochromatic-ide-native-DdPO53/shaped.png`.
This is not whole-application acceptance.

Before the debug footer was removed,
a native click reached `Selection 61:61` after the leading CJK glyph;
keyboard selection reached `Selection 60:61`.
After adding nested clipboard management,
independent `wl-paste` readback matches full source,
`猫`,
and decomposed `é` exactly.
Typing and Ctrl+V preserve the accessible source value.
A multi-step MCP probe timed out,
but subsequent state reads responded and showed the expected selection;
this did not establish an application deadlock.

Repeated Home MCP requests took 357.19,
364.49,
and 359.61 ms,
while an ignored `x` request took 2.31 ms.
These are end-to-end request timings,
not isolated paint timings.
The bounded `test:raster` fixture then measured unchanged shaping at 9.82 to 10.29 ms
and rasterization at 368.16 to 373.14 ms.
After glyph caching,
unchanged shaping measured 9.42 to 9.59 ms
and rasterization 7.76 to 8.10 ms.
Repeated cached pixels match byte-for-byte.
The container limits mean absolute fixture timings are not native-host timings.
Additional cache-invalidation and native-boundary checks remain necessary.

A genuine native notch before the cache fix moved from 0 to -60 pixels,
with fractional positions including -5.85,
-13.183334,
and -48.442593.
At the materialization boundary,
a state request took 367.79 ms and the next observed position jumped to -60.
Evidence:
`/tmp/monochromatic-ide-native-8CCvg2/wheel-before.json`.
Native `Flickable` easing exists,
but the synchronous source raster interrupted it.
After rebuilding,
`/tmp/monochromatic-ide-native-S6Y37Y/wheel-after.json` shows continued fractional motion through that boundary,
including -49.020374,
-57.600006,
and -59.814823.
The boundary request took 32.52 ms in this debug build,
not the previous 367.79 ms.
Steady repeated Home requests after caret-image reuse took 1.68 to 2.95 ms.
This is evidence of the corrected redraw path,
not a claim of guaranteed frame pacing or whole-application acceptance.

MCP `scroll_element` sends `TouchPhase::Cancelled`,
which exercises immediate scrolling and is not a notched-wheel test.
The repo compositor now supports
`wheel X Y HORIZONTAL_NOTCHES VERTICAL_NOTCHES`,
using `AxisSource::Wheel`,
v120 notch units,
and ordinary axis deltas.
See [the scroll investigation][scroll].

## Syntax and font-fidelity additions

`src/bin/ide-runtime.rs` and the `runtime` task own build-only grammar provisioning.
They reuse pinned Helix fetching/building,
with private configuration under `target`.
The initial slice contains Rust,
TypeScript,
TSX,
JavaScript,
and JSDoc grammars;
full measured-inventory coverage remains pending.
Queries come from the pinned Cargo checkout,
and each grammar's license is copied into the runtime.
Assets are published beside debug/release binaries.
The asset directory measured 5,655,910 bytes at this checkpoint.

The terminal base image lacked `c++`,
which Helix's grammar manager requests even for C parsers.
`package/desktop-app/ide/Containerfile` now extends that image with `gcc-c++`;
tasks use `localhost/monochromatic/ide` with the same resource bounds.
The `runtime` task and actual parser tests pass.

`src/syntax.rs` uses Helix filename/shebang recognition and tree-house offsets,
converting byte ranges to source-character ranges.
Adjacent equal paint intervals are merged;
Rust comments arrived as adjacent `//` and ` 猫` captures rather than a single span.
`HighlighterError` implements Display but not std::error::Error;
`src/syntax_error.rs` supplies explicit operation-specific diagnostics.
Syntax failures retain readable text rather than pretending an installed language is unrecognized.
The worker computes initial and changed-source syntax and tags it with its target revision.
Native application rejects stale syntax,
and immutable `SourceStyles` prevent copying all spans during caret-only updates.

The dark syntax screenshot was inspected at
`/tmp/monochromatic-ide-native-KA8eTH/syntax-dark.png`.
It shows real grammar classifications,
not fixed example colors.

The user explicitly requested correct ligatures and other JetBrains Mono/Inter font behavior.
The source now explicitly enables JetBrains Mono's `calt` feature.
Real on/off glyph controls,
slashed-zero substitution,
and ligature-interior caret/hit/copy checks pass.
A committed regression exposed wrong selection ink inside the middle character of `===`.
`src/selection_paint.rs` now clips foreground against the same rectangles used for native backgrounds,
without reshaping or breaking the ligature.
Fractional DPI/origin and opacity controls pass.

Inter tests verify kerning against an off control (106.35498 versus 112.976074 pixels),
real 400/600 face bytes,
and tabular/proportional figures through the same Parley/fontique stack Slint uses.
The user rejected the static subset and explicitly requested variable fonts and real italics.
On 2026-10-04,
`Inter-Regular.ttf`/`Inter-SemiBold.ttf` were replaced by `InterVariable.ttf`/`InterVariable-Italic.ttf`,
and `JetBrainsMono-Regular.ttf` by `JetBrainsMono-Variable.ttf`/`JetBrainsMono-VariableItalic.ttf`.
The original filesystem names for the latter pair are recorded in the font README;
font bytes and internal names are unchanged.
JetBrains Mono advertises wght 100 to 800;
Inter advertises wght 100 to 900 and opsz 14 to 32.
Both families have separate real italic faces.

`font_asset.rs` shares stable source-font blob identities.
`SourceTypography` validates variable weights and chooses real italic faces.
Tests verify intermediate weights,
exact font bytes,
no synthetic emboldening/skew,
variation-aware glyph caching with the same blob ID,
and italic ligature caret/copy behavior.
Inter tests verify explicit optical sizes 14 and 32.
The toolkit's ordinary UI request still leaves opsz at 14;
automatic optical sizing is not claimed.
Optional stylistic alternates remain upstream defaults and no settings panel was added.
`asset/font/README.md` records the measured feature boundary.

`ui/app.slint` now tracks a physical pixel converted to logical length,
so an idle display-scale change invalidates source rasterization.
`src/native/tests.rs` drives actual Slint window events through the headless backend.
`test:native` and the markup check pass after the observed-failing DPI test.

## Latest clipboard and interface verification

The user explicitly authorized adding clipboard support to the nested compositor.
`src/handler/clipboard.rs` registers wlr-data-control and ext-data-control against the nested seat.
`src/child.rs` removes `DISPLAY` and `XAUTHORITY` so toolkit fallback cannot reach host X11.
The new isolation test was observed failing before the fix and passing afterward.
`inspect:clipboard` passed text and binary transfer,
selection clearing,
and clean producer shutdown.
See [the clipboard investigation][clipboard].

The latest complete IDE suite passes 49 tests after the expanded font checks;
the native headless DPI test also passes.
A new five-case workspace-model test file was added afterward and is running.
The headless native DPI regression was observed failing (1300-pixel bitmap retained instead of 2600),
then passed after adding physical-pixel scale invalidation.
It checks scale factors 2,
1.25,
and back to 1 without source input or resize.
The Slint markup check and native build pass.
IDE Clippy,
Rust documentation/line budgets,
and Slint markup checks now pass.
`native.rs` uses Slint's supported procedural-macro re-export of `ui/app.slint`,
retaining generated-code provenance rather than suppressing shadow lints.
The earlier generated-module implicit-return allowance was removed.
`build.rs` explicitly supplies `SLINT_EMBED_RESOURCES=true` to that macro and retains standalone markup validation.
Native font-isolation verification should be repeated for this integration change.

The minimal dark UI screenshot at
`/tmp/monochromatic-ide-native-8rNGro/minimal-dark.png`
was inspected.
MCP confirms no Button role,
read-only badge,
or debug footer in the complete element tree.
Copy is keyboard-only.
Only the file context and source remain visible in the normal source-view gate.

## Active probes at this checkpoint

- `proc_3806`,
  `ide-native-tree-seat-controls`,
  serves MCP at port 9318 and control socket
  `/tmp/monochromatic-ide-native-bOrX20/control.sock`.
  Its binary predates the latest reveal-liveness,
  reader-disconnection,
  initial-directory diagnostic,
  and Tab changes;
  restart before their physical-input verification.
- `interaction.mjs` in that directory passes entirely through native seat modifiers and key events:
  mouse file opens,
  arrow/Enter tree navigation,
  Ctrl+1 alternation,
  Ctrl+0 ancestor reveal,
  failed-open retention,
  ignored typing,
  and `am a` to `was a` selection correspondence after switching files.
  Independent `wl-paste` reads the isolated clipboard.
  `tree-selection-reload.png` was inspected.
- `edge-probe.mjs` passes ignored native paste,
  outside-symlink rejection,
  external tree removal/recreation,
  root-unavailable source retention and recovery,
  and tree Home/End/PageUp/PageDown/Space controls.
  `tree-root-unavailable.png` was inspected.
- An initial probe mixed MCP modifier injection with native seat arrow events and failed its selection-copy assertion.
  It is not selection-regression evidence:
  the replacement probe keeps the entire chord on the native seat and passes.
- The nested helper now accepts `ctrl`,
  `shift`,
  `alt`,
  and `meta` key names.
  Its modifier test failed with `None` versus `Some(29)` before implementation;
  `proc_9075` then passed all 42 helper tests,
  Clippy,
  and the release build.
- Advisor raised unmatched reveal and stopped-reader liveness risks.
  `missing_reveal_keeps_the_existing_model_until_tree_changes` failed before the fix in `proc_bbf5`.
  The native code now waits for actual directory changes rather than rebuilding an identical tree every 20ms.
  A positive model-identity control proves the assertion detects real replacements.
- The proposed contained-alias defect was not reproduced:
  the canonical target row is selected and badged,
  reopening its alias preserves selection/generation,
  and model identity stays stable.
  The test passed both before and after the liveness fix.
  Canonical aliases intentionally share one history identity.
- Reader/opener disconnect tests failed before state cleanup in `proc_f52d`.
  `proc_9d01` passed after clearing the reader's busy/sender state and the opener's waiting target.
  `proc_ee8d` passed native review regressions,
  including accurate first-listing failure text and recovery,
  plus scoped Rust lint.

- `proc_ba75`,
  `ide-native-navigation-consumer-tests`,
  runs the real window callbacks for file switching,
  Ctrl+0 reading-state preservation,
  Ctrl+1 alternation,
  ancestor reveal,
  and failed-open retention through external refresh.
- `proc_d93e` passed the background file-opening tests.
- `proc_ead2` passed CLI parsing,
  real executable help/version/usage exits,
  and scoped Rust lint.
  Startup is now `monochromatic-ide PROJECT [--file FILE]`;
  native inspection tasks pass an explicit disposable project.
- `proc_247b` passed the full pre-opener suite and package lint after directory-reader integration.

- `proc_0d4b` passed the full library/integration suite after variable-font replacement,
  then exposed owned-name comparison lint findings in the new workspace tests.
  Those findings were fixed.
  `proc_e7bd` subsequently passed Clippy,
  Rust documentation/line budgets,
  and the native build.
- `proc_60a7` passed all three native tests,
  Rust documentation/line budgets,
  and Clippy after adding actual source-image typography/selection coverage.
  Native widget pixel comparisons cover request repainting and fallback distinction,
  not direct selected-font-byte introspection.
  The normal source surface remains roman 400 with color-only syntax spans.
- `proc_8ed6` passed both native headless tests under nextest:
  idle DPI changes and real widget variable-weight/italic pixel changes.
  Plain cargo test initially failed because Slint's global platform was initialized on another test thread;
  native tests now use process isolation.
- `proc_e46e`,
  `ide-variable-native-isolation`,
  stopped cleanly after variable-font verification.
  Its completed dark fixture was at
  `/tmp/monochromatic-ide-native-m6zNtt/control.sock`.
  MCP is port 9318.
  All four complete variable/italic font byte sequences were found in the binary.
  Isolated fontconfig resolves Inter Variable and JetBrains Mono to Adwaita Mono externally.
  The native middle-character ligature copy and screenshot probe passes;
  `/tmp/monochromatic-ide-native-m6zNtt/ligature-dark.png` was inspected.
- `proc_ed8c` is stopped after the pre-variable macro-path verification.

- `proc_f89f`,
  `ide-workspace-model-tests`,
  runs the IDE suite with new read-only workspace tests.
- `proc_e9fe`,
  `ide-font-cold-start`,
  is the current dark/syntax probe.
  Socket:
  `/tmp/monochromatic-ide-native-46wFSY/control.sock`.
  MCP:
  `http://127.0.0.1:9318/mcp`.
  It predates the procedural-macro integration change.
  Its font probe copied the middle `=` of `===` and its dark screenshot was inspected.

- `proc_75d5` (stopped),
  `ide-light-font-native`,
  verified the light/syntax fixture with ligature and DPI fixes.
  `/tmp/monochromatic-ide-native-SjCyvc/font-probe.mjs` copied exactly `=` from the middle of `===`.
  Selection was at x=236,
  y=32,
  with width 9.
  `ligature-light.png` in that directory was inspected.
- `proc_2d43`,
  `ide-inter-default-features`,
  passed the expanded font tests including Inter calt/dlig defaults.

- `proc_1614` (stopped),
  `ide-live-reload-native-retry`,
  was the verified dark/scroll fixture with live refresh.
  Socket:
  `/tmp/monochromatic-ide-native-zCPqiB/control.sock`.
  MCP:
  `http://127.0.0.1:9318/mcp`.
- `proc_4ae9` exited before spawning the IDE:
  private D-Bus startup timed out.
  The unchanged retry started successfully;
  no root cause or fix is established for that separate fixture-startup incident.
- `proc_b0cc` (stopped),
  `ide-minimal-clipboard-native`,
  is stopped after verifying the dark/basic fixture with the simplified UI and rebuilt clipboard-capable compositor.
  MCP is `http://127.0.0.1:9318/mcp`.
  Socket:
  `/tmp/monochromatic-ide-native-8rNGro/control.sock`.
  Consumer probe:
  `/tmp/monochromatic-ide-native-8rNGro/clipboard-probe.mjs`.
- `proc_f5f1` (stopped),
  `ide-native-wheel-probe`,
  runs the pre-cache source renderer with the rebuilt compositor.
  MCP is `http://127.0.0.1:9318/mcp`.
  Socket:
  `/tmp/monochromatic-ide-native-8CCvg2/control.sock`.
  Source:
  `/tmp/monochromatic-ide-native-8CCvg2/fixture.ts`.
  This historical baseline process is stopped.
- `proc_ea50`,
  `ide-caret-reuse-tests-build`,
  runs scoped tests then the native build.
  It completed successfully.
- `proc_37fc` and `proc_7948` are stopped.
  Their original source-view handles and binaries are obsolete.

Rediscover windows and elements after every restart.
JSON-RPC `tools/call` accepts loopback POST with
`Content-Type: application/json` and `Accept: application/json, text/event-stream`.
Tool JSON is inside `result.content[].text`.
`list_windows` returns `windowHandles`,
not `windows`.
Use `find_elements_by_id` for `AppWindow::scroll`.
Element and window handles are distinct even when their shapes coincide.
Read current `tools/list` schemas before driving input.

## Build and runtime evidence

All Cargo tasks run through package `mise.toml` in the IDE image extending the terminal build image,
with 2 GiB RAM,
2 CPUs,
512 processes,
4096 file descriptors,
and two Cargo jobs.
Only the package and dedicated Cargo volume are mounted.
Slint resolves to 1.18.1.
Its installed source is under
`~/.local/share/containers/storage/volumes/ide-cargo/_data/registry/src/`.

Root `file-enforcer.config.ts` owns the unconditional Slint dependency.
`gui = []` gates generated UI code,
not optional dependency membership.
Reintroducing `dep:slint` would reproduce Cargo's
`feature gui includes dep:slint, but slint is not an optional dependency`.
Native key comparisons use `SharedString::from(Key::...)`.
Current Slint markup uses `content-width`,
`content-height`,
and `content-y` rather than deprecated `viewport-*` names.

Font provenance,
checksums,
and original OFL licenses live in `asset/font/README.md` and adjacent license files.
Selected releases are Inter v4.1 and JetBrains Mono v2.304.
Native fontconfig resolves both absent primary families to Adwaita Mono externally,
while the app retains its embedded faces.

Read [the private theme-portal investigation][theme].
The compositor supports startup `--color-scheme dark|light` on a private D-Bus session.
Live theme-switch signaling still needs investigation and verification.

## Helix and behavioral references

Pinned Helix revision:
`ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`.
Source clone:
`~/temp/agent/slint-ide-languages.mEr8K9/helix`.
All selected Helix crates use that same revision.
Relevant inspected APIs include `compare_ropes`,
`ChangeSet::map_pos`,
`syntax::Loader`,
`Syntax`,
`TextAnnotations`,
and `helix-lsp::Client`/`Registry`.
The installed tree-house highlighter uses event offsets,
not the older start/end/source iterator shape.

`helix-loader::config::default_lang_config()` supplies the registry.
Grammar fetching/building exists in `helix-loader::grammar`,
and the initial Rust/TypeScript/TSX/JavaScript/JSDoc runtime slice is provisioned.
The remaining measured-language inventory still needs build/runtime coverage.
Respect each server's text synchronization mode.
The measured inventory includes TS/JS,
Rust,
Kotlin,
Slint,
QML,
HCL,
SQL,
shell,
C/C++,
Batch,
and configuration/markup families.
Inspected SQL,
XML/SVG,
and Batch entries have grammars but no configured LSP.

Installed `hx` reports `25.07.1 (a05c151b)`.
`hx --health typescript` found parser/query assets and typescript-language-server 6.0.0.
A fresh `hx --health` probe found the installed runtime at `/usr/lib64/helix/runtime`.
Its other reported candidates,
`~/.config/helix/runtime` and `/usr/bin/runtime`,
were absent.
Installed assets are not assumed compatible with the pinned Helix revision.

Editord reference:
`package-paused/desktop-daemon/editord`.
Recency behavior is in `src/client/recent-files.ts`,
`src/client/app/app.ts`,
and `src/client/file-tree/reveal.ts`.
The paused browser/WebSocket daemon architecture is not being revived.

## Workspace model and remaining verification details

`src/workspace.rs` opens one canonical local root,
resolves tree/search paths against it,
and returns fresh directory snapshots in filesystem order.
It preserves hidden entries and native filenames.
`tests/workspace.rs` covers normal listings,
refresh,
contained paths,
sibling-prefix/parent escapes,
symlinks,
and invalid directory inputs.
`src/file_tree.rs` and its `listing`/`rows` helpers now own lazy expansion,
visible snapshot order,
and detached-subtree pruning without filesystem I/O.
Collapsing a parent retains descendant expansion but suppresses hidden loading requests.
Directory-to-file replacement discards obsolete child caches.
Atomic snapshot validation rejects traversal-like names,
duplicate keys,
and mismatched paths;
native byte filenames remain intact.
`test:tree` passes eight cases;
Clippy,
Rust documentation/line budgets,
and Slint checks pass in `proc_1f80`.
`DirectoryRequest` now carries a private shared allocation identity across threads,
not a reusable integer or just path equality.
Superseded,
consumed,
foreign-tree,
and removed/recreated-directory replies are ignored before applying either data or errors.
A current read error releases its request slot while preserving the previous snapshot.
Asynchronous callers must use `complete_listing` rather than the synchronous `apply_listing` entry point.
`DirectoryWorker` admits at most one read or unread reply,
never blocks UI polling,
and closes input before joining its thread on shutdown.
The native tree now uses `ui/tree.slint` plus `src/native/navigation/` bindings.
Its header shows the distinguishing project name;
the full root remains available through accessibility.
It retains native paths behind lossy display labels,
shows recent-file slot badges,
and expands/reveals ancestors after successful opens.
Rows have 48px minimum dimensions;
expanded folders use both arrow direction and font weight,
and the displayed file uses selection background and weight.
The current sidebar is fixed at 256px;
resizing parity remains unimplemented.

`FileOpener` reuses `ReloadWorker` for project-relative resolution,
read/diff,
and syntax on its reader thread.
Only the latest requested open can install a document;
failed opens retain the old source and do not promote history.
The ordinary displayed-file refresh worker continues independently.
`navigation_error` remains separate from `file_error`,
so successful refresh of the old file cannot erase an unrelated failed-open diagnostic.

Directory refresh currently round-robins visible expanded folders at 500ms intervals,
with missing lazy snapshots taking priority.
This is polling,
not filesystem watcher integration;
refresh latency grows with the number of expanded directories.
No event-driven latency guarantee is claimed.
Collapsing a folder dismisses its folder-scoped diagnostic;
re-expansion requests it again.
Canonical inside symlink aliases select and badge the real target row rather than creating duplicate history slots.
Successful file opens focus the source view;
Tab traversal back to the tree is implemented but still needs physical-input verification.
Both readers close their input and join on shutdown;
a filesystem operation that never returns can therefore delay shutdown.
Cancellation invalidates replies,
not a running operating-system file read.

Observed-failing guard checks passed in `proc_1d30`:
removing snapshot validation,
unknown-directory rejection,
and non-directory expansion rejection each caused its named test to fail.
Restoring all guards returned the eight-test suite to passing.
The evidence is `results.json` beside the disposable copy.
The disposable copy is `/home/user/temp/agent/ide-tree-guard-zlIbRv/package`;
its baseline passed eight tests in `proc_5274`.
`guard-check.mjs` outside that copy removes guards one at a time,
checks named failures,
restores the files,
and reruns the suite.
All Cargo work remains bounded by the copied package's container task.
Canonical path checks do not claim race-proof OS-level read confinement;
server project-write confinement remains a separate required gate.

Reference search behavior was re-read:
editord returns up to 20 smart-case substring file-path matches before up to 30 regex content matches,
one content line per file,
using concurrent ripgrep processes and cancellation.
Its tree preserves readdir order and does not turn directory symlinks into expandable directories.
Its CSS uses tab-size 2;
the current source projection still expands tabs using a four-column terminal-width calculation.
Tab-width parity and mixed-script physical tab geometry are outstanding findings,
not verified font behavior.

The runtime build helper's configuration-boundary test passes,
but its guard still needs an observed-failing removal probe in disposable fixtures.
Do not loosen the guard or touch real user configuration for that verification.

The compositor protocol-delivery regression failed with an unflushed sync reply,
then passed after end-of-dispatch flushing.
Its full 41-test suite,
Clippy,
and release build pass.
The rebuilt helper cold-started the native dark font probe successfully.
The earlier light-startup stall recovered before the fix,
so its exact trigger remains unproven.
See `doc/troubleshooting/nested-wayland-protocol-delivery.md`.

## Repository safety and policy proposals

Scope every commit to task files and preserve concurrent work.
Auto-push is enabled.
Generated GPL/LGPL texts under `package/desktop-app/ide/LICENSES/` are now committed unchanged.
Current unrelated linter work is concurrent work,
not something to revert.

Recent task commits:
`4af24d5c7` adds the raster probe;
`6385c1fe1` adds bounded glyph images;
`205ff25ea` splits native boundaries;
`d4e4b3973` adds caret-only image reuse.
Inspect current Git status and process state rather than assuming this snapshot is live.

Outstanding policy proposal:
tighten `AGENTS.md` `VB1` to require CLI `--help` to exit 0 without normal startup.
The earlier stop correction also called for making checkpoint continuation explicit in `PXQ`.
These proposals are not permission to pause implementation or silently change policy.

[scope]: ../decision/slint-ide-0x-scope.md
[plan]: ../planning/slint-ide-implementation.md
[theme]: ../troubleshooting/slint-nested-color-scheme-portal.md
[scroll]: ../troubleshooting/slint-flickable-smooth-scroll.md
[clipboard]: ../troubleshooting/slint-nested-clipboard.md
