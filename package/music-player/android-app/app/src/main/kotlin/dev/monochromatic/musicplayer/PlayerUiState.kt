// ===========================================================================
// File summary (domain, for a TypeScript-only reader)
//
// This file declares ONE type, `PlayerUiState`: an immutable snapshot of
// everything the player SCREEN needs to render at a given moment. Think of it
// as the React-style "view model" / props object the UI re-reads each time it
// repaints. It is produced by `PlayerController` (the file
// `PlayerController.kt` in this same package) and handed to the UI.
//
// What this snapshot is for (folded in from the old KDoc that used to sit on
// the type below): `PlayerController` rebuilds a fresh `PlayerUiState` every
// time something the screen shows changes, namely the queue, the current
// track, the visible page tab, the shuffle mode, the repeat-track flag, or
// the play/pause state. Because the type is immutable, "changing the UI"
// means building a brand-new value and swapping it in (never mutating the old
// one in place).
//
// Deliberately EXCLUDED from this snapshot (this is a design choice, not an
// oversight): the playback POSITION and the track DURATION. Those two numbers
// tick every single animation frame, so if they lived in this snapshot the
// whole object would be rebuilt ~60 times a second for no reason. Instead the
// seek bar polls position and duration directly off the audio engine, and
// this snapshot only carries the slower-changing, "structural" state.
//
// Domain vocabulary used by the fields below (so the TS reader isn't lost):
//   - "queue": the full, flat list of tracks loaded into the player, in load
//     order. A track's "load-order index" is its position in that flat list.
//   - "page": one browsable tab. Tracks are grouped into pages either by their
//     top-level folder, or (for root-level tracks) by their first letter A-Z,
//     with a single `#` page catching digits/symbols/non-English letters.
//   - "page item": one row shown on the visible page; it pairs a track with
//     its load-order queue index (see the `PageEntry` type imported below).
//   - "shuffle mode": OFF / WITHIN_PAGE / ALL (see the `ShuffleMode` type
//     imported below); it controls both whether order is shuffled AND what
//     scope playback loops over.
//
// This file holds ONLY the data shape; all the logic that computes these
// values lives in `PlayerController`. Nothing here does I/O, audio, or UI.
// The whole file is one `data class` declaration plus its properties and
// their default values.
// ===========================================================================

// What:     `package dev.monochromatic.musicplayer` declares which "package"
//           (Kotlin's word for a namespace, i.e. a named bucket that fully-
//           qualifies the names in this file) this file belongs to. The single
//           top-level type declared below, `PlayerUiState`, becomes reachable
//           from elsewhere as
//           `dev.monochromatic.musicplayer.PlayerUiState`. By convention the
//           package name mirrors the on-disk directory path
//           (.../kotlin/dev/monochromatic/musicplayer/). Note this is the
//           top-level app package, NOT the `.core` sub-package the two imports
//           below come from.
// Why:      We need it so the UI and `PlayerController` (which live in this
//           same package and so don't even need an import) plus any other file
//           can refer to `PlayerUiState` by a stable, fully-qualified name.
//           Omitting it would dump the name into an unnamed "default package"
//           that other packages cannot import from cleanly.
// Gotcha:   Unlike a TS `import`, this line imports NOTHING and runs no code.
//           It only NAMES the current file's namespace, and must be the first
//           non-comment line in the file.
//
// In TS you'd write (pseudocode):
// ```ts
// // No `package` line in TS. Module identity comes from the file path itself:
// //   src/musicplayer/PlayerUiState.ts  ->  imported via that path.
// ```
package dev.monochromatic.musicplayer

// What:     `import dev.monochromatic.musicplayer.core.PageEntry` pulls the
//           name `PageEntry` into this file from the sibling `.core`
//           sub-package, so the property below can be typed `List<PageEntry>`
//           by its short name instead of its full dotted path. `PageEntry` is
//           a tiny record `{ index: Int; name: String }`: a track's load-order
//           queue index plus the display text shown for its row.
// Why:      We need it so the `pageItems` property can name `PageEntry` as its
//           element type without writing the whole
//           `dev.monochromatic.musicplayer.core.PageEntry` path every time.
// Gotcha:   Importing a name in Kotlin does NOT run any module code (Kotlin
//           has no top-level side-effecting module bodies the way a TS
//           `import "./x"` can trigger). It is purely a compile-time "let me
//           use the short name `PageEntry`" request.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PageEntry } from "./core/Page";
// ```
import dev.monochromatic.musicplayer.core.PageEntry

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` pulls the
//           enum type `ShuffleMode` into this file from the `.core`
//           sub-package, so the `shuffle` property below can name it by its
//           short name. `ShuffleMode` is a closed three-value enum: `OFF`,
//           `WITHIN_PAGE`, `ALL` (it is the TS reader's equivalent of a string
//           union `"Off" | "WithinPage" | "All"`).
// Why:      We need it so the `shuffle` property and its default value
//           `ShuffleMode.OFF` can be written with the short name rather than
//           the full dotted path.
// Gotcha:   Same as the import above: no module code runs; it's a compile-time
//           name-resolution request only.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./core/ShuffleMode";
// ```
import dev.monochromatic.musicplayer.core.ShuffleMode

// What:     `data class PlayerUiState( ... )` declares a "data class" named
//           `PlayerUiState`. A plain Kotlin `class` would give you only a type
//           with reference identity (two instances are "equal" only if they
//           are literally the same object). The `data` modifier tells the
//           compiler to AUTO-GENERATE, from the properties listed in the
//           parentheses (the "primary constructor"), these members:
//           `equals` + `hashCode` (structural, field-by-field comparison),
//           `toString` (a readable `PlayerUiState(pageLabels=..., ...)` dump),
//           `copy(...)` (make a near-duplicate changing only chosen fields),
//           and `componentN()` accessors enabling destructuring. The ten
//           values inside the `( ... )` are the snapshot's fields, each with a
//           DEFAULT value (the `= ...` after its type) so a caller can build a
//           blank initial state by writing just `PlayerUiState()`.
// Why:      We need a value-style record because the UI swaps whole
//           `PlayerUiState` snapshots and compares them: a UI framework can
//           skip a repaint when the new snapshot is structurally EQUAL to the
//           old one, and `copy(playing = true)` lets `PlayerController` build
//           the next state by tweaking one field of the current state. The
//           generated `equals`/`hashCode`/`copy` give us exactly that for free.
//           The defaults give a ready-made empty starting state.
// Gotcha:   Two `PlayerUiState` instances with equal fields are `==` (Kotlin's
//           structural-equality operator), which is NOT how a plain Kotlin
//           class behaves and NOT how TS object references compare with `===`.
//           `data` is what flips `==` from "same object" to "same contents".
//           (Reference identity is still available via `===` in Kotlin, the
//           OPPOSITE spelling from TS, where `===` means value/strict equality.)
// Gotcha:   `data class` is PUBLIC by default — Kotlin's default visibility is
//           public, so the absence of any modifier here is the same as writing
//           `public`. A TS reader seeing no `export` should NOT assume this is
//           file-private; it is visible across the module graph.
//
// In TS you'd write (pseudocode):
// ```ts
// // An immutable view-model snapshot; all fields have defaults via a factory.
// type PlayerUiState = {
//   pageLabels: string[];
//   selectedPage: number;
//   pageItems: PageEntry[];
//   currentIndex: number | null;
//   playing: boolean;
//   shuffle: ShuffleMode;
//   repeatTrack: boolean;
//   volume: number;
//   queueSize: number;
//   loading: boolean;
// };
// const makePlayerUiState = (p: Partial<PlayerUiState> = {}): PlayerUiState => ({
//   pageLabels: [], selectedPage: 0, pageItems: [], currentIndex: null,
//   playing: false, shuffle: "Off", repeatTrack: false, volume: 1.0,
//   queueSize: 0, loading: false, ...p,
// });
// ```
/**
 * Defines player ui state type for this music-player component; the TypeScript-oriented notes above explain its
 * role.
 */
data class PlayerUiState(
    // What:     `val pageLabels: List<String> = emptyList()`. `val` declares a
    //           READ-ONLY property: it is both a primary-constructor parameter
    //           AND a field you can read but never reassign after construction.
    //           `List<String>` is Kotlin's READ-ONLY list interface (an ordered
    //           collection exposing `size`, indexed access, and iteration, but
    //           NO add/remove/set methods) whose element type is `String`
    //           (Kotlin's immutable UTF-16 text). So this is "an ordered,
    //           non-mutating list of strings": the captions for the page tabs,
    //           in display order (folder names first, then A-Z letters, then
    //           the `#` catch-all). `= emptyList()` is the default value, a
    //           call to the stdlib function `emptyList()` that returns a shared
    //           empty `List`. Sibling list types the reader might have expected:
    //           `MutableList<String>` (adds `add`/`remove`/`set`),
    //           `Array<String>` (fixed-size, mutable elements),
    //           `Set<String>` (unordered, unique), `Collection<String>` (the
    //           unindexed super-interface).
    // Why:      `val` (not `var`) because a snapshot is immutable; a new state
    //           is built rather than this one mutated. `List` (not
    //           `MutableList`) because the labels are assembled once by the
    //           controller and then only read by the UI, so the read-only
    //           interface both documents intent and blocks accidental mutation.
    //           `emptyList()` as the default so a freshly constructed
    //           `PlayerUiState()` starts with zero tabs.
    // Gotcha:   Kotlin's `List` is a read-only VIEW/interface, not a deep-
    //           immutable guarantee: the same underlying object could be held
    //           elsewhere as a `MutableList` and changed behind your back.
    //           Think TS `readonly string[]` (mutation forbidden through THIS
    //           reference), not a frozen/`Object.freeze` deep copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly pageLabels: readonly string[]; // default []
    // ```
    val pageLabels: List<String> = emptyList(),
    // What:     `val selectedPage: Int = 0`. `val` is a read-only property (set
    //           once, never reassigned). `Int` is Kotlin's 32-bit signed
    //           integer (range roughly +/-2.1 billion). `= 0` is the default.
    //           This holds the INDEX of the currently visible page tab within
    //           `pageLabels` (0 means the first tab). Sibling integer types the
    //           reader might have expected: `Long` (64-bit), `Short` (16-bit),
    //           `Byte` (8-bit).
    // Why:      `val` because the snapshot is immutable. `Int` (not `Long`)
    //           because it indexes into the `pageLabels` list, and Kotlin's
    //           list/collection APIs (`List.size`, `list[i]`, `get(index: Int)`)
    //           are all `Int`-typed, so a `Long` would force a `.toInt()`
    //           conversion at every lookup. `0` as the default so the first tab
    //           is selected initially.
    // Gotcha:   `Int` is a fixed-width 32-bit integer, NOT TS's arbitrary
    //           `number`; it can overflow (wrap around) past ~2.1 billion,
    //           whereas TS `number` would keep widening to a float.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly selectedPage: number; // default 0
    // ```
    val selectedPage: Int = 0,
    // What:     `val pageItems: List<PageEntry> = emptyList()`. A read-only
    //           (`val`) property whose type is the read-only list interface
    //           `List<PageEntry>` (ordered, non-mutating; see `pageLabels`
    //           above for the sibling list types). Its element type `PageEntry`
    //           is the imported record `{ index: Int; name: String }`: one row
    //           on the visible page, pairing a track's load-order queue index
    //           with its display name. `= emptyList()` is the default (a shared
    //           empty list).
    // Why:      `val` because the snapshot is immutable. `List` (not
    //           `MutableList`) because the rows for the visible page are built
    //           once by the controller and then only iterated by the UI.
    //           `PageEntry` as the element type so each row carries BOTH the
    //           display name AND the queue index the UI needs to start playback
    //           when the row is tapped. `emptyList()` as the default so a fresh
    //           state shows no rows.
    // Gotcha:   Same read-only-VIEW caveat as `pageLabels`: `List` forbids
    //           mutation through THIS reference but is not a deep-frozen copy.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly pageItems: readonly PageEntry[]; // default []
    // ```
    val pageItems: List<PageEntry> = emptyList(),
    // What:     `val currentIndex: Int? = null`. `val` is a read-only property.
    //           The crucial token is the trailing `?` on `Int?`: it makes this
    //           a NULLABLE `Int`, i.e. the value is either a 32-bit integer OR
    //           the special absence value `null`. Without the `?`, a Kotlin
    //           `Int` can NEVER be null. `= null` is the default. This holds the
    //           load-order queue index of the current track, or `null` when no
    //           track is selected.
    // Why:      `val` because the snapshot is immutable. `Int?` (the nullable
    //           form, not plain `Int`) because "nothing is playing/selected" is
    //           a real state that needs representing, and `null` expresses it
    //           directly rather than overloading a sentinel like `-1`. `null`
    //           as the default so a fresh state correctly means "no current
    //           track".
    // Gotcha:   Kotlin's `?` here is on the TYPE (`Int?` = "nullable Int"), which
    //           is NOT the same as TS's `prop?:` syntax that marks a property
    //           OPTIONAL on an object. Here the property always EXISTS; its
    //           VALUE may be null. Also: Kotlin's compiler then forces you to
    //           null-check before using `currentIndex` as a number (e.g. via
    //           `?.`, `?:`, or `!!`), the way TS's `strictNullChecks` does.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly currentIndex: number | null; // default null
    // ```
    val currentIndex: Int? = null,
    // What:     `val playing: Boolean = false`. A read-only (`val`) property of
    //           type `Boolean` (Kotlin's two-value true/false type), defaulting
    //           to `false`. True when audio is currently playing, false when
    //           paused/stopped.
    // Why:      `val` because the snapshot is immutable. `Boolean` because this
    //           is a plain yes/no flag the UI uses to pick the play vs pause
    //           icon. `false` as the default so a fresh, just-opened player is
    //           not playing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly playing: boolean; // default false
    // ```
    val playing: Boolean = false,
    // What:     `val shuffle: ShuffleMode = ShuffleMode.OFF`. A read-only (`val`)
    //           property typed as the imported enum `ShuffleMode` (one of
    //           `OFF` / `WITHIN_PAGE` / `ALL`). The default value
    //           `ShuffleMode.OFF` reads the `OFF` constant off the enum type by
    //           its qualified name `ShuffleMode.OFF` (the `.` here selects a
    //           named member of the enum, like reaching for a member of a
    //           namespace; it is NOT a method call). This holds the active
    //           shuffle/scope mode.
    // Why:      `val` because the snapshot is immutable. `ShuffleMode` (the
    //           closed enum, not a bare `String` or `Int`) so the value is
    //           type-safe and the UI can branch on it exhaustively. `OFF` as the
    //           default because a fresh player starts un-shuffled, playing the
    //           current page in load order.
    // Gotcha:   `ShuffleMode.OFF` looks like a property access on an object, but
    //           it is selecting an ENUM CONSTANT (a singleton value of the enum
    //           type), not invoking anything. There are no parentheses precisely
    //           because nothing is being called.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly shuffle: ShuffleMode; // default "Off"
    // ```
    val shuffle: ShuffleMode = ShuffleMode.OFF,
    // What:     `val repeatTrack: Boolean = false`. A read-only (`val`) property
    //           of type `Boolean` (true/false), defaulting to `false`. True when
    //           the "repeat current track" toggle is on (the track replays
    //           instead of advancing).
    // Why:      `val` because the snapshot is immutable. `Boolean` because it is
    //           a plain on/off toggle independent of the `shuffle` mode. `false`
    //           as the default so a fresh player does not repeat.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly repeatTrack: boolean; // default false
    // ```
    val repeatTrack: Boolean = false,
    // What:     `val volume: Float = 1.0f`. A read-only (`val`) property of type
    //           `Float`, Kotlin's 32-bit (single-precision) IEEE-754 floating-
    //           point number. The default literal `1.0f` carries a trailing `f`
    //           suffix that tells the compiler "this literal is a `Float`, not a
    //           `Double`" — without the `f` the literal `1.0` would be a 64-bit
    //           `Double` and would not match the `Float` type. This holds the
    //           output gain in the range `0.0..1.0` (0 = silent, 1 = full).
    //           Sibling floating types the reader might have expected: `Double`
    //           (64-bit double precision).
    // Why:      `val` because the snapshot is immutable. `Float` (not `Double`)
    //           because audio gain only needs single-precision and the audio
    //           pipeline works in 32-bit floats, so storing a `Double` here
    //           would just force a narrowing conversion downstream. `1.0f` as
    //           the default so a fresh player starts at full volume.
    // Gotcha:   The `f` suffix is mandatory load-bearing syntax here, not
    //           decoration: dropping it changes the literal's type to `Double`
    //           and the line would no longer compile against a `Float` field. TS
    //           has no such suffix and no such distinction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly volume: number; // default 1.0
    // ```
    val volume: Float = 1.0f,
    // What:     `val queueSize: Int = 0`. A read-only (`val`) property of type
    //           `Int` (32-bit signed integer; siblings `Long`/`Short`/`Byte`),
    //           defaulting to `0`. This holds the total number of tracks in the
    //           full queue.
    // Why:      `val` because the snapshot is immutable. `Int` (not `Long`)
    //           because it counts list elements and mirrors Kotlin's `Int`-typed
    //           `List.size`; using `Long` would force a conversion. `0` as the
    //           default so a fresh, empty-queue player reports zero tracks.
    // Gotcha:   `Int` is a fixed-width 32-bit integer that can overflow past
    //           ~2.1 billion, unlike TS's auto-widening `number`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly queueSize: number; // default 0
    // ```
    val queueSize: Int = 0,
    // What:     `val loading: Boolean = false`. A read-only (`val`) property of
    //           type `Boolean` (true/false), defaulting to `false`. True while a
    //           library load or folder scan is in progress.
    // Why:      `val` because the snapshot is immutable. `Boolean` because it is
    //           a plain in-progress flag. Its PURPOSE: it lets the screen show a
    //           "loading..." notice rather than the empty-library message while
    //           a slow source scan runs — so an empty queue only means "no
    //           music" once `loading` is `false`. `false` as the default so a
    //           fresh state is treated as "not currently scanning".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // readonly loading: boolean; // default false
    // ```
    val loading: Boolean = false,
)
