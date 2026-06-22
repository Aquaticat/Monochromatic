# Music player: one Rust core, generated platform apps

A proposal to collapse the desktop and Android music players onto a single shared Rust core,
then grow that core into a published library from which both platform apps are generated.

## Status and audience

Proposal and design document, dated 2026-06-21. Not yet implemented.

Written to be passed around inside and outside the team. It assumes familiarity with Rust and
mobile or desktop app structure, but not with this repository. Internal references use relative
links so a reader with the repo checked out can follow them.

## The endgame (north star)

The ambition is larger than removing duplication. The endgame is:

- `music-player-core` graduates from an in-repo crate into a **published, versioned package**
  (internal registry first, public crates.io if it proves useful) with a stable API. Any Rust
  application can depend on it to get the whole music player: decode, true-peak normalization,
  the queue and pagination model, session state, and the playback engine.

- **One build produces both apps.** A single build pipeline takes the shared core plus a small
  per-platform adapter description and emits both target apps: the Android Jetpack Compose app
  (bound to the core through generated Kotlin) and the desktop Slint app. The platform-specific
  pieces (audio output backend, file access, platform integration) are supplied by thin,
  templated adapters; the shared core and the app's behavior are written once.

- The platform apps stop being two codebases to maintain and become two generated outputs of one
  codebase. Adding a feature means changing the core and rebuilding; both apps inherit it.

This is the direction, not a finished design. The most speculative part is full generation of the
UI shells; the staged plan below builds the foundation that makes it reachable, and the open
questions section is honest about what is still unproven. The near-term, fully-specified goal is
the shared core with thin hand-written adapters; the generation pipeline is the layer added on top
once the core API is stable.

## Why: the same player, built twice

Today `packages/music-player` ships the same player implemented twice.

- `desktop-app/` is Rust plus Slint. Its `src/` holds the full domain in Rust: decode, opus,
  true-peak, fingerprint, queue, pagination, relpath, session, plus a PipeWire and cpal engine.

- `android-app/` is Kotlin plus Jetpack Compose over a Rust library reached through hand-written
  JNI. The Rust side re-implements decode, opus, true-peak, fingerprint, and the engine; the
  Kotlin side **separately** re-implements queue, pagination, relpath, session, shuffle, and
  normalization in `core/*.kt`.

The duplication is real and already drifting. The two Rust `truepeak.rs` files differ by
+460/-251 lines (Android added a windowed scan for tracks over 90 seconds that desktop lacks),
`opus.rs` by +229/-133, and `error.rs` by +219/-144. The pure logic lives in two languages with
no shared source of truth, so a fix or a tweak has to be made, reviewed, and tested twice, and the
two copies quietly diverge between those moments.

The original Android port decision (`../../docs/decisions/music-player-android-port.md`, 2026-06-12)
already planned the fix: ship the whole engine, including queue, pagination, relpath, and session,
as a library reached through UniFFI, with Kotlin doing only Compose UI, audio output, and file
access. A later audit (`android-app/kotlin-rust-boundary.md`) reversed that and kept the pure logic
in Kotlin for simplicity. This proposal returns to the original direction and pushes past it.

## Target architecture

```text
packages/music-player/
  core/                         shared library: all platform-agnostic logic, published over time
  desktop-app/                  thin adapter: Slint UI + PipeWire/cpal output + filesystem source
  android-app/
    rust/                       thin adapter: UniFFI facade + AAudio output, depends on the core
    app/                        thin adapter: Compose UI + MediaSession + SAF/MediaStore
```

The core is the product. Each app is a thin adapter that supplies a platform UI, an audio output
backend, file access, and platform integration, and otherwise defers to the core.

What the core owns (moves out of both apps):

- Audio: `decode` (the `Source` trait plus the symphonia and opus implementations and the shared
  `open_media_source` tail), `opus`, `truepeak`, `error`, `fingerprint`.
- Pure logic: `queue`, `pagination`, `page`, `relpath`, `displaypath`, `shuffle_mode`, `session`
  model, `normalization` gain formula, `audio_extensions` allowlist and predicate.
- Engine: the decode to ring-buffer to gain worker loop, the atomic control block, and the command
  channel, all behind an `Output` trait.
- Persistence: a Turso-backed peak cache and session store, plus the snapshot type the UI reads.

What stays in each app (the thin adapter):

- Desktop: the Slint UI, the PipeWire and cpal output implementations, the KDE and taskbar
  integration, the filesystem watcher, the command-line entry, and platform thread scheduling.
- Android Rust: the UniFFI facade that replaces hand-written JNI, and the AAudio output.
- Android Kotlin: Compose UI, the `MediaSessionService`, permissions, the SAF persistable
  permission grant, the SAF and MediaStore enumeration that hands display strings and content URIs
  to the core, the WorkManager peak-sweep scheduler, and audio focus handling.

## Key decisions

- **Move the pure UI-driving logic into Rust.** Queue, pagination, relpath, session, shuffle, and
  normalization become Rust in the core; the Kotlin re-implementations are deleted. This is the
  single source of truth that ends the drift.

- **Bind Kotlin to Rust with UniFFI.** Generated, type-safe Kotlin bindings carry the structured
  snapshots (page lists, track lists, enums, session) across the boundary, replacing hand-written
  JNI marshaling. This was the original port plan and is the foundation of the generation endgame.

- **Unify the playback engine behind an `Output` trait.** The decode-to-output worker becomes
  shared; each platform implements only the output backend.

- **Move both apps' persistence to Turso.** One storage layer in the core, synchronous
  (`turso_core`, which also lets the desktop drop its async runtime), replaces the desktop's JSON
  session plus Turso cache and Android's SharedPreferences plus JSON cache.

## Design seams

- **decode opener split.** `core::decode::open_media_source(Box<dyn MediaSource>, Hint)` is the
  shared tail (Android already factored this). Each app keeps a thin opener: desktop from a path,
  Android from a borrowed file descriptor opened off a `content://` URI.

- **Output trait.** `trait Output { fn reconfigure(&mut self, spec, playing) -> producer;
  fn set_playing(&mut self, playing); }`. Desktop's PipeWire and cpal output and Android's AAudio
  stream each implement it; the shared worker drives it. Today neither side abstracts output.

- **UniFFI across the crate boundary, confirmed before relied upon.** UniFFI generally needs a
  type's own crate to carry its record and enum derives, so the core carries feature-gated derives
  (off for desktop, on for Android) and the Android facade is generated in library mode, which
  collects exported types across every crate linked into the Android shared object. This is a known
  multi-crate rough edge and is the first thing the build proves with a small spike; the fallback
  is thin wrapper types in the facade, which reintroduces some duplication.

- **The UI reads snapshots per action, not per frame.** The controller rebuilds an immutable UI
  snapshot only on a user action or an engine event, and Compose observes it. So the core returns
  one snapshot per action across the boundary, which is the bounded cost that makes moving the
  state into Rust sound rather than a per-frame tax.

## Constraints that must not break

These are correctness contracts, not preferences. Breaking one breaks both apps.

- **Fingerprint bit-parity.** Keep the `gxhash` major version, the fixed seed, the exact
  (path, size, mtime) byte layout, and the AES target feature both `.cargo/config.toml` files set.
  Any change re-keys both peak caches.

- **True-peak is a real behavior change for long tracks, not a free merge.** Unifying the two
  implementations means picking one measurement for tracks over 90 seconds. Android's windowed scan
  does not add to the desktop full scan; it replaces it with a sampled measurement that can
  under-read the true peak, which is why Android carries a 1.26 safety factor. Adopting it shifts
  the desktop normalization gain for long tracks, an audible change. This is a decision for the
  team to ratify, not a refactor detail. The default proposal adopts the windowed path plus the
  desktop ceiling and gain formula; the alternative keeps full-scan on desktop behind a flag.

- **The audio-extension allowlist is shared, the filesystem walk is not.** Share the extension set
  and the predicate; the desktop keeps its recursive filesystem expansion, and Android keeps its
  SAF and MediaStore enumeration, both filtering through the shared allowlist.

- **The SAF permission grant stays in Kotlin.** The chosen library root identity moves into the
  shared session, but the Android persistable-permission token management is a platform concern and
  stays in the adapter.

## Staged plan

Each stage ends with both apps building and their tests green, committed before the next.

1.  Scaffold the core crate and prove the UniFFI multi-crate path with a throwaway spike before any
    binding design rests on it.
2.  Migrate the audio DSP core (decode, opus, true-peak reconciled, error, fingerprint), the proven
    duplication and lowest risk. Point both apps at the core, delete their copies, keep each app's
    thin opener.
3.  Migrate the pure logic (queue, pagination, page, relpath, displaypath, shuffle, session model,
    normalization, audio extensions). The desktop Rust is the canonical source; its tests come
    along.
4.  Stand up the UniFFI facade, add the codegen step to the Android build, and delete the Kotlin
    re-implementations; Compose consumes the generated bindings and the snapshot type.
5.  Unify the engine behind the `Output` trait; each app provides only its output backend. This is
    the largest reconciliation and may itself be split into sub-steps.
6.  Move persistence to Turso in the core; delete the per-app stores.
7.  Documentation, linting, and user-boundary verification on both platforms.

Beyond stage 7, the generation endgame: stabilize and publish the core API, then build the pipeline
that scaffolds each platform adapter from templates so both apps are generated outputs.

## Verification

Verification must cross both build boundaries, not just compile.

- Core: run the full test suite plus the Rust linter (line budget and required documentation) and
  clippy, all zero-error.
- Parity: a fingerprint test asserting equal inputs hash equally, and a synthetic-PCM true-peak
  test, both passing against the unified core; these guard the two parity contracts above.
- Desktop: build, then run on a real folder and confirm playback, transport, seek, volume, shuffle
  and repeat, pagination, and session restore at the user boundary.
- Android: cross-compile for device and emulator, assemble the app, confirm the generated Kotlin
  compiles, and run unit and on-device tests including real audio, background playback, and
  lockscreen controls.
- Persistence: confirm peak-cache rows survive a hard process kill on both platforms and that a
  cache miss self-heals.

## Open questions and risks

- **UniFFI multi-crate generation.** Library mode collecting types across the core and the facade
  is the load-bearing assumption for the thin Android adapter. Proven by spike in stage 1; the
  fallback adds some duplication.
- **The long-track true-peak change.** Needs a ratified decision because it alters desktop output.
- **UI shell generation.** The endgame's most speculative layer. Slint and Compose are different
  enough that generating both UIs from one description is real work and may land as templated
  scaffolding plus shared view-model rather than full UI generation. Scoped as a follow-on once the
  core API is stable.
- **Publishing.** Choosing a registry, an API stability policy, and a versioning cadence for a core
  that two first-party apps and outside Rust apps all depend on.

## Supersedes

This proposal supersedes the earlier `android-app/kotlin-rust-boundary.md` recommendation, which
argued for keeping the pure logic re-implemented in Kotlin. That document represented one team
member's opinion, favoring simplicity; the team's direction is that maintainability beats
simplicity. See that file's superseded banner for the history.
