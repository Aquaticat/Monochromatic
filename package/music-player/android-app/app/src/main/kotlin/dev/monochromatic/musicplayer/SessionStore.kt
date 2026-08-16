// What:     `package dev.monochromatic.musicplayer` declares the namespace for this
//           file's single top-level declaration (`SessionStore`). It sits in the app
//           package (alongside `LibraryRoot`, `PlaybackService`, `MainActivity`), NOT
//           in `core`, because it touches the Android platform (SharedPreferences,
//           Context). The package must mirror the directory path.
// Why:      `SessionStore` is the PLATFORM half of session persistence: the pure
//           `core.Session` model carries only the in-memory shape, and this object
//           reads/writes it to device storage. Keeping it out of `core` preserves
//           `core`'s no-Android, fully-unit-testable purity.
//
// In TS you'd write (pseudocode):
// ```ts
// // No statement equivalent — the file's path is its namespace.
// ```
package dev.monochromatic.musicplayer

// What:     `import android.content.Context` pulls in the Android `Context` type, the
//           handle to app-global facilities (here, the SharedPreferences store).
// Why:      `load`/`save` need a `Context` to open the preferences file.
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
//
// In TS you'd write (pseudocode):
// ```ts
// import { edit } from "androidx/core/content"; // prefs.edit((e) => {...})
// ```
import androidx.core.content.edit

// What:     `import dev.monochromatic.musicplayer.core.Session` brings the pure model
//           type into scope.
// Why:      `load` returns a `Session` and `save` takes one.
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
//
// In TS you'd write (pseudocode):
// ```ts
// export const SessionStore = { load(ctx) {...}, save(ctx, s) {...} };
// ```
/**
 * Defines session store object for this music-player component; the TypeScript-oriented notes above explain its
 * shared role.
 */
object SessionStore {
    // What:     `private const val PREFS_NAME: String = "session"` declares a private
    //           compile-time constant naming the SharedPreferences file.
    //           - `const val` is a COMPILE-TIME constant (inlined; must be a primitive
    //             or String literal), stronger than a plain `val`.
    // Why:      The XML file this object reads/writes; distinct from `LibraryRoot`'s
    //           "library_root" file so the two stores never collide.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const PREFS_NAME = "session";
    // ```
    /**
     * Defines prefs name value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val PREFS_NAME: String = "session"

    // What:     `private const val KEY_SELECTED: String = "selected"` is the key for
    //           the selected-track identity (a content URI string), or absent for none.
    // Why:      A stable key for the selected track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_SELECTED = "selected";
    // ```
    /**
     * Defines key selected value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    private const val KEY_SELECTED: String = "selected"

    // What:     `private const val KEY_POSITION: String = "position_bits"` is the key
    //           for the resume position, stored as the `Double`'s raw 64-bit pattern.
    // Why:      Named "_bits" to signal it is a `Long` bit pattern, not a plain number.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_POSITION = "position_bits";
    // ```
    /**
     * Defines key position value for this music-player component; the TypeScript-oriented notes above explain
     * its source and use.
     */
    private const val KEY_POSITION: String = "position_bits"

    // What:     `private const val KEY_VOLUME: String = "volume"` is the key for the
    //           saved gain (`Float`).
    // Why:      A stable key for volume.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_VOLUME = "volume";
    // ```
    /**
     * Defines key volume value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val KEY_VOLUME: String = "volume"

    // What:     `private const val KEY_SHUFFLE: String = "shuffle"` is the key for the
    //           shuffle mode, stored as the enum's `.name`.
    // Why:      A stable key for the shuffle mode.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_SHUFFLE = "shuffle";
    // ```
    /**
     * Defines key shuffle value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val KEY_SHUFFLE: String = "shuffle"

    // What:     `private const val KEY_REPEAT: String = "repeat_track"` is the key for
    //           the repeat-track flag (`Boolean`).
    // Why:      A stable key for the repeat-track flag.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_REPEAT = "repeat_track";
    // ```
    /**
     * Defines key repeat value for this music-player component; the TypeScript-oriented notes above explain its
     * source and use.
     */
    private const val KEY_REPEAT: String = "repeat_track"

    // What:     `KEY_PAGE_CONTROL_STYLE` is the SharedPreferences key for the page
    //           selector treatment, stored as the enum's `.name` string.
    // Why:      Keep this UI preference in the existing session preference file without
    //           adding it to the playback controller's pure Session model.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const KEY_PAGE_CONTROL_STYLE = "page_control_style";
    // ```
    /** Defines the persisted page-control style key. */
    private const val KEY_PAGE_CONTROL_STYLE: String = "page_control_style"

    // What:     `fun load(context: Context): Session { ... }` declares a public function
    //           taking a `Context` and returning a `core.Session`, block body.
    // Why:      Read the persisted session at launch; a blank store yields the model's
    //           defaults (nothing selected, position 0, full volume, shuffle off, no
    //           repeat), because each `getX(key, default)` supplies that default.
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
    /**
     * Defines load behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun load(context: Context): Session {
        // What:     `val prefs: SharedPreferences = prefs(context)` opens the store.
        // Why:      One handle reused for every field read below.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const prefs = this.prefs(context);
        // ```
        /**
         * Defines prefs value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
        val prefs: SharedPreferences = prefs(context)
        // What:     `val shuffleName: String? = prefs.getString(KEY_SHUFFLE, null)` reads
        //           the stored shuffle name, or `null` when absent. `getString(key,
        //           default)` returns the stored string or the default.
        // Why:      Resolve it to an enum below without throwing on an unknown value.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const shuffleName = prefs.getString(KEY_SHUFFLE, null);
        // ```
        /**
         * Defines shuffle name value for this music-player component; the TypeScript-oriented notes above
         * explain its source and use.
         */
        val shuffleName: String? = prefs.getString(KEY_SHUFFLE, null)
        // What:     `val shuffle: ShuffleMode = ShuffleMode.entries.firstOrNull { it.name == shuffleName } ?:
        //           ShuffleMode.OFF`
        //           resolves the stored name to a `ShuffleMode`.
        //           - `ShuffleMode.entries` is the enum's list of constants (Kotlin's
        //             `entries`, the modern replacement for `values()`).
        //           - `.firstOrNull { it.name == shuffleName }` finds the constant whose
        //             `.name` matches, or `null` if none (unknown or absent name).
        //           - `?: ShuffleMode.OFF` falls back to OFF.
        // Why:      Graceful, throw-free decoding: a corrupt or older store cannot crash
        //           the launch; it just loses the shuffle setting.
        // Gotcha:   This avoids `ShuffleMode.valueOf(name)`, which THROWS on an unknown
        //           name; `firstOrNull` + Elvis is the non-throwing equivalent.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const shuffle = ShuffleMode.entries.find((m) => m.name === shuffleName) ?? ShuffleMode.OFF;
        // ```
        /**
         * Defines shuffle value for this music-player component; the TypeScript-oriented notes above explain its
         * source and use.
         */
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
    /**
     * Defines save behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    fun save(context: Context, session: Session) {
        // What:     `prefs(context).edit { ... }` opens the store and the KTX `edit`
        //           lambda; inside, `this` is the `SharedPreferences.Editor`, so the
        //           `putX` calls write to it, and `edit` commits at the end.
        // Why:      Write all five fields atomically in one batch.
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putLong(KEY_POSITION, doubleToRawLongBits(session.positionSecs));
            // ```
            putLong(KEY_POSITION, session.positionSecs.toRawBits())
            // What:     `putFloat(KEY_VOLUME, session.volume)` stores the `Float` gain
            //           directly (SharedPreferences supports Float).
            // Why:      Persist the volume.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putFloat(KEY_VOLUME, session.volume);
            // ```
            putFloat(KEY_VOLUME, session.volume)
            // What:     `putString(KEY_SHUFFLE, session.shuffle.name)` stores the enum's
            //           `.name` ("OFF"/"WITHIN_PAGE"/"ALL").
            // Why:      A stable, human-readable encoding decoded by `load` above.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putString(KEY_SHUFFLE, session.shuffle.name);
            // ```
            putString(KEY_SHUFFLE, session.shuffle.name)
            // What:     `putBoolean(KEY_REPEAT, session.repeatTrack)` stores the flag.
            // Why:      Persist repeat-track.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // e.putBoolean(KEY_REPEAT, session.repeatTrack);
            // ```
            putBoolean(KEY_REPEAT, session.repeatTrack)
        }
    }

    // What:     `fun loadPageControlStyle(context: Context): PageControlStyle` reads the
    //           stored enum name and distinguishes a missing key from an unknown value.
    // Why:      Fresh installs use Chromium tabs while stale values safely use radio controls.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // loadPageControlStyle(context): PageControlStyle {
    //   const name = prefs(context).getString(KEY_PAGE_CONTROL_STYLE, null);
    //   return name === null ? 'CHROMIUM_TABS' : PageControlStyle.fromStoredName(name);
    // }
    // ```
    /** Loads saved style with Chromium first-install default and radio unknown-value fallback. */
    internal fun loadPageControlStyle(context: Context): PageControlStyle {
        // Read nullable text because a fresh store has no value yet.
        /** Holds the persisted enum name, or null when no choice was saved. */
        val storedName: String? = prefs(context).getString(KEY_PAGE_CONTROL_STYLE, null)
        // Match known names without throwing; unknown names use the requested default.
        return PageControlStyle.fromStoredName(storedName)
    }

    // What:     `fun savePageControlStyle(context, style)` writes only the selected
    //           enum name through the existing preferences editor.
    // Why:      Style changes become durable immediately without replacing playback fields.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // savePageControlStyle(context, style): void {
    //   prefs(context).edit((editor) => editor.putString(KEY_PAGE_CONTROL_STYLE, style.name));
    // }
    // ```
    /** Persists one page-control style selection. */
    internal fun savePageControlStyle(context: Context, style: PageControlStyle) {
        prefs(context).edit {
            putString(KEY_PAGE_CONTROL_STYLE, style.name)
        }
    }

    // What:     `private fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS_NAME,
    //           Context.MODE_PRIVATE)`
    //           declares a private helper returning the app-private preferences file,
    //           expression body.
    //           - `getSharedPreferences(name, mode)` opens (creating if absent) the
    //             named file; `Context.MODE_PRIVATE` makes it readable only by this app.
    // Why:      One place that resolves the store, shared by `load` and `save`; mirrors
    //           `LibraryRoot.prefs`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // private prefs(context: Context) { return context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE); }
    // ```
    /**
     * Defines prefs behavior for this music-player component; the TypeScript-oriented notes above explain its
     * call shape and effects.
     */
    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
