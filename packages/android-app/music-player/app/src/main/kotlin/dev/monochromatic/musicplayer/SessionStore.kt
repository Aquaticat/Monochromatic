// What:     `package dev.monochromatic.musicplayer` declares the namespace for this
//           file's single top-level declaration (`SessionStore`). It sits in the app
//           package (alongside `LibraryRoot`, `PlaybackService`, `MainActivity`), NOT
//           in `core`, because it touches the Android platform (SharedPreferences,
//           Context). The package must mirror the directory path.
// Why:      `SessionStore` is the PLATFORM half of session persistence: the pure
//           `core.Session` model carries only the in-memory shape, and this object
//           reads/writes it to device storage. Keeping it out of `core` preserves
//           `core`'s no-Android, fully-unit-testable purity.
// TS map:   No `package` keyword; the file path is the module. Importers write
//           `import { SessionStore } from ".../SessionStore"`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No statement equivalent — the file's path is its namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in the Android `Context` type, the
//           handle to app-global facilities (here, the SharedPreferences store).
// Why:      `load`/`save` need a `Context` to open the preferences file.
// TS map:   `import { Context } from "android/content";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Context } from "android/content";
// ```
import android.content.Context

// What:     `import android.content.SharedPreferences` pulls in the small key/value
//           persistence type. It stores primitives (String/Int/Long/Float/Boolean)
//           in an app-private XML file.
// Why:      The session is a tiny flat record, so SharedPreferences (the same store
//           `LibraryRoot` uses for the SAF tree URI) is the natural fit; no JSON
//           serializer or database is needed.
// TS map:   `import { SharedPreferences } from "android/content";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { SharedPreferences } from "android/content"; // ~ a typed localStorage
// ```
import android.content.SharedPreferences

// What:     `import androidx.core.content.edit` pulls in the AndroidX KTX EXTENSION
//           FUNCTION `SharedPreferences.edit { ... }`, which opens an editor, runs the
//           lambda against it, and commits, in one call.
// Why:      `save` batches all field writes inside one `edit { ... }` block (the same
//           idiom `LibraryRoot` uses), rather than manually `edit()`/`apply()`.
// TS map:   no direct analogue; mentally a helper `withEditor(prefs, (e) => { ... })`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { edit } from "androidx/core/content"; // prefs.edit((e) => {...})
// ```
import androidx.core.content.edit

// What:     `import dev.monochromatic.musicplayer.core.Session` brings the pure model
//           type into scope.
// Why:      `load` returns a `Session` and `save` takes one.
// TS map:   `import { Session } from "./core/Session";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Session } from "./core/Session";
// ```
import dev.monochromatic.musicplayer.core.Session

// What:     `import dev.monochromatic.musicplayer.core.ShuffleMode` brings the
//           three-state enum into scope.
// Why:      The shuffle field is stored as its `.name` string and read back into a
//           `ShuffleMode`.
// TS map:   `import { ShuffleMode } from "./core/ShuffleMode";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { ShuffleMode } from "./core/ShuffleMode";
// ```
import dev.monochromatic.musicplayer.core.ShuffleMode

// =============================================================================
// File summary
// =============================================================================
//
// `SessionStore` is the platform persistence layer for `core.Session`. The desktop
// player saves the session as a JSON blob under its config dir; Android does not need
// cross-language compatibility (the session is per-device), so this stores the flat
// record in an app-private SharedPreferences file, exactly as `LibraryRoot` stores the
// SAF tree URI. Note the deliberate ASYMMETRY with desktop: the Source Root is NOT
// saved here. On Android the source is re-resolved every launch by `LibrarySource`
// (a held SAF grant, persisted by `LibraryRoot`, else MediaStore), so the session
// persists only the SELECTED TRACK (a content URI), the resume position, and the
// settings (volume, shuffle, repeat-track). See `CONTEXT.md`.
//
// Two encoding choices worth noting:
//   - positionSecs is a `Double`, which SharedPreferences cannot store directly (it
//     has Float but not Double), so it is stored as the Double's raw 64-bit pattern
//     via `toRawBits()`/`Double.fromBits(...)`, preserving full precision.
//   - shuffle is stored as the enum's `.name` ("OFF"/"WITHIN_PAGE"/"ALL"); an unknown
//     or missing name falls back to `ShuffleMode.OFF`, so a corrupt/old store degrades
//     gracefully rather than throwing.

// What:     `object SessionStore { ... }` declares a SINGLETON object named
//           `SessionStore`. Kotlin's `object` creates exactly one instance, accessed
//           by the type name (`SessionStore.load(...)`), like a static utility holder.
// Why:      Session persistence is stateless (it holds no fields, only functions over
//           a passed-in `Context`), so a singleton object is the right shape; this
//           mirrors `LibraryRoot`.
// TS map:   `export const SessionStore = { load(...) {}, save(...) {} };` or a class
//           with only static methods.
//
// In TS you'd write (pseudocode):
// ```ts
// export const SessionStore = { load(ctx) {...}, save(ctx, s) {...} };
// ```
object SessionStore {
    // What:     `private const val PREFS_NAME: String = "session"` declares a private
    //           compile-time constant naming the SharedPreferences file.
    //           - `const val` is a COMPILE-TIME constant (inlined; must be a primitive
    //             or String literal), stronger than a plain `val`.
    // Why:      The XML file this object reads/writes; distinct from `LibraryRoot`'s
    //           "library_root" file so the two stores never collide.
    // TS map:   `const PREFS_NAME = "session";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const PREFS_NAME = "session";
    // ```
    private const val PREFS_NAME: String = "session"

    // What:     `private const val KEY_SELECTED: String = "selected"` is the key for
    //           the selected-track identity (a content URI string), or absent for none.
    // Why:      A stable key for the selected track.
    // TS map:   `const KEY_SELECTED = "selected";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_SELECTED = "selected";
    // ```
    private const val KEY_SELECTED: String = "selected"

    // What:     `private const val KEY_POSITION: String = "position_bits"` is the key
    //           for the resume position, stored as the `Double`'s raw 64-bit pattern.
    // Why:      Named "_bits" to signal it is a `Long` bit pattern, not a plain number.
    // TS map:   `const KEY_POSITION = "position_bits";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_POSITION = "position_bits";
    // ```
    private const val KEY_POSITION: String = "position_bits"

    // What:     `private const val KEY_VOLUME: String = "volume"` is the key for the
    //           saved gain (`Float`).
    // Why:      A stable key for volume.
    // TS map:   `const KEY_VOLUME = "volume";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_VOLUME = "volume";
    // ```
    private const val KEY_VOLUME: String = "volume"

    // What:     `private const val KEY_SHUFFLE: String = "shuffle"` is the key for the
    //           shuffle mode, stored as the enum's `.name`.
    // Why:      A stable key for the shuffle mode.
    // TS map:   `const KEY_SHUFFLE = "shuffle";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_SHUFFLE = "shuffle";
    // ```
    private const val KEY_SHUFFLE: String = "shuffle"

    // What:     `private const val KEY_REPEAT: String = "repeat_track"` is the key for
    //           the repeat-track flag (`Boolean`).
    // Why:      A stable key for the repeat-track flag.
    // TS map:   `const KEY_REPEAT = "repeat_track";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_REPEAT = "repeat_track";
    // ```
    private const val KEY_REPEAT: String = "repeat_track"

    // What:     `fun load(context: Context): Session { ... }` declares a public function
    //           taking a `Context` and returning a `core.Session`, block body.
    // Why:      Read the persisted session at launch; a blank store yields the model's
    //           defaults (nothing selected, position 0, full volume, shuffle off, no
    //           repeat), because each `getX(key, default)` supplies that default.
    // TS map:   `load(context: Context): Session { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // load(context: Context): Session {
    //   const p = prefs(context);
    //   return makeSession({
    //     selected: p.getString(KEY_SELECTED, null),
    //     positionSecs: Double.fromBits(p.getLong(KEY_POSITION, 0)),
    //     volume: p.getFloat(KEY_VOLUME, 1.0),
    //     shuffle: ShuffleMode.entries.find(m => m.name === p.getString(KEY_SHUFFLE, null)) ?? ShuffleMode.OFF,
    //     repeatTrack: p.getBoolean(KEY_REPEAT, false),
    //   });
    // }
    // ```
    fun load(context: Context): Session {
        // What:     `val prefs: SharedPreferences = prefs(context)` opens the store.
        // Why:      One handle reused for every field read below.
        // TS map:   `const prefs = this.prefs(context);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const prefs = this.prefs(context);
        // ```
        val prefs: SharedPreferences = prefs(context)
        // What:     `val shuffleName: String? = prefs.getString(KEY_SHUFFLE, null)` reads
        //           the stored shuffle name, or `null` when absent. `getString(key,
        //           default)` returns the stored string or the default.
        // Why:      Resolve it to an enum below without throwing on an unknown value.
        // TS map:   `const shuffleName = prefs.getString(KEY_SHUFFLE, null);`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const shuffleName = prefs.getString(KEY_SHUFFLE, null);
        // ```
        val shuffleName: String? = prefs.getString(KEY_SHUFFLE, null)
        // What:     `val shuffle: ShuffleMode = ShuffleMode.entries.firstOrNull { it.name == shuffleName } ?: ShuffleMode.OFF`
        //           resolves the stored name to a `ShuffleMode`.
        //           - `ShuffleMode.entries` is the enum's list of constants (Kotlin's
        //             `entries`, the modern replacement for `values()`).
        //           - `.firstOrNull { it.name == shuffleName }` finds the constant whose
        //             `.name` matches, or `null` if none (unknown or absent name).
        //           - `?: ShuffleMode.OFF` falls back to OFF.
        // Why:      Graceful, throw-free decoding: a corrupt or older store cannot crash
        //           the launch; it just loses the shuffle setting.
        // TS map:   `const shuffle = ShuffleMode.entries.find((m) => m.name === shuffleName) ?? ShuffleMode.OFF;`
        // Gotcha:   This avoids `ShuffleMode.valueOf(name)`, which THROWS on an unknown
        //           name; `firstOrNull` + Elvis is the non-throwing equivalent.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const shuffle = ShuffleMode.entries.find((m) => m.name === shuffleName) ?? ShuffleMode.OFF;
        // ```
        val shuffle: ShuffleMode = ShuffleMode.entries.firstOrNull { it.name == shuffleName } ?: ShuffleMode.OFF
        // What:     `return Session( ... )` builds the model from the stored fields using
        //           NAMED ARGUMENTS.
        //           - `selected = prefs.getString(KEY_SELECTED, null)` reads the URI or
        //             `null`.
        //           - `positionSecs = Double.fromBits(prefs.getLong(KEY_POSITION, 0L))`
        //             reconstructs the `Double` from its stored 64-bit pattern; the
        //             default `0L` decodes to `0.0` (bits 0 is +0.0).
        //           - `volume = prefs.getFloat(KEY_VOLUME, 1.0f)` reads the gain,
        //             defaulting to full.
        //           - `shuffle = shuffle` uses the resolved enum.
        //           - `repeatTrack = prefs.getBoolean(KEY_REPEAT, false)` reads the flag.
        // Why:      Produce the in-memory session the controller restores from.
        // TS map:   `return makeSession({ ... });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return makeSession({ selected, positionSecs, volume, shuffle, repeatTrack });
        // ```
        return Session(
            selected = prefs.getString(KEY_SELECTED, null),
            positionSecs = Double.fromBits(prefs.getLong(KEY_POSITION, 0L)),
            volume = prefs.getFloat(KEY_VOLUME, 1.0f),
            shuffle = shuffle,
            repeatTrack = prefs.getBoolean(KEY_REPEAT, false),
        )
    }

    // What:     `fun save(context: Context, session: Session) { ... }` declares a public
    //           function taking a `Context` and a `core.Session`, returning `Unit`
    //           (void), block body.
    // Why:      Persist the session so the next launch can restore it; called from the
    //           service at lifecycle points (track change, pause, destroy).
    // TS map:   `save(context: Context, session: Session): void { ... }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // save(context: Context, session: Session): void {
    //   prefs(context).edit((e) => {
    //     e.putString(KEY_SELECTED, session.selected);
    //     e.putLong(KEY_POSITION, doubleToRawLongBits(session.positionSecs));
    //     e.putFloat(KEY_VOLUME, session.volume);
    //     e.putString(KEY_SHUFFLE, session.shuffle.name);
    //     e.putBoolean(KEY_REPEAT, session.repeatTrack);
    //   });
    // }
    // ```
    fun save(context: Context, session: Session) {
        // What:     `prefs(context).edit { ... }` opens the store and the KTX `edit`
        //           lambda; inside, `this` is the `SharedPreferences.Editor`, so the
        //           `putX` calls write to it, and `edit` commits at the end.
        // Why:      Write all five fields atomically in one batch.
        // TS map:   `prefs(context).edit((e) => { ... });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // prefs(context).edit((e) => { ... });
        // ```
        prefs(context).edit {
            // What:     `putString(KEY_SELECTED, session.selected)` stores the selected
            //           URI. A `null` value REMOVES the key, so an absent selection reads
            //           back as `null`.
            // Why:      Persist the selected track identity (or clear it).
            // TS map:   `e.putString(KEY_SELECTED, session.selected);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putString(KEY_SELECTED, session.selected);
            // ```
            putString(KEY_SELECTED, session.selected)
            // What:     `putLong(KEY_POSITION, session.positionSecs.toRawBits())` stores
            //           the `Double` position as its raw 64-bit `Long` pattern.
            //           `toRawBits()` is the `Double` extension returning the IEEE-754
            //           bit pattern.
            // Why:      SharedPreferences has no Double; the bit pattern preserves the
            //           value exactly (no Float-narrowing precision loss).
            // TS map:   `e.putLong(KEY_POSITION, doubleToRawLongBits(session.positionSecs));`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putLong(KEY_POSITION, doubleToRawLongBits(session.positionSecs));
            // ```
            putLong(KEY_POSITION, session.positionSecs.toRawBits())
            // What:     `putFloat(KEY_VOLUME, session.volume)` stores the `Float` gain
            //           directly (SharedPreferences supports Float).
            // Why:      Persist the volume.
            // TS map:   `e.putFloat(KEY_VOLUME, session.volume);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putFloat(KEY_VOLUME, session.volume);
            // ```
            putFloat(KEY_VOLUME, session.volume)
            // What:     `putString(KEY_SHUFFLE, session.shuffle.name)` stores the enum's
            //           `.name` ("OFF"/"WITHIN_PAGE"/"ALL").
            // Why:      A stable, human-readable encoding decoded by `load` above.
            // TS map:   `e.putString(KEY_SHUFFLE, session.shuffle.name);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putString(KEY_SHUFFLE, session.shuffle.name);
            // ```
            putString(KEY_SHUFFLE, session.shuffle.name)
            // What:     `putBoolean(KEY_REPEAT, session.repeatTrack)` stores the flag.
            // Why:      Persist repeat-track.
            // TS map:   `e.putBoolean(KEY_REPEAT, session.repeatTrack);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putBoolean(KEY_REPEAT, session.repeatTrack);
            // ```
            putBoolean(KEY_REPEAT, session.repeatTrack)
        }
    }

    // What:     `private fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)`
    //           declares a private helper returning the app-private preferences file,
    //           expression body.
    //           - `getSharedPreferences(name, mode)` opens (creating if absent) the
    //             named file; `Context.MODE_PRIVATE` makes it readable only by this app.
    // Why:      One place that resolves the store, shared by `load` and `save`; mirrors
    //           `LibraryRoot.prefs`.
    // TS map:   `private prefs(context: Context): SharedPreferences { return context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE); }`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private prefs(context: Context) { return context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE); }
    // ```
    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
