// Android persistence boundary for the pure Session model. New writes contain one
// playback-mode key. Former shuffle and repeat keys are read only for migration.

// What:     `package ...musicplayer` places this Android-specific object beside the
//           service that calls it.
// Why:      SharedPreferences must stay outside the platform-independent core package.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

// What:     Android Context resolves app-private services and storage.
// Why:      Both public operations open this app's SharedPreferences file.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Context } from "android/content";
// ```
import android.content.Context

// What:     SharedPreferences is Android's primitive key/value store.
// Why:      The session is a small flat record that needs no database.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { SharedPreferences } from "android/content";
// ```
import android.content.SharedPreferences

// What:     AndroidX `edit` opens an editor, runs one receiver lambda, and applies it.
// Why:      Migration and save each update related keys in one batch.
//
// In TS you'd write (pseudocode):
// ```ts
// import { edit } from "androidx/core/content";
// ```
import androidx.core.content.edit

// What:     PlaybackMode is the new four-state model and owns wire decoding helpers.
// Why:      Persistence converts old fields into this value before returning a Session.
//
// In TS you'd write (pseudocode):
// ```ts
// import { PlaybackMode } from "./core/PlaybackMode";
// ```
import dev.monochromatic.musicplayer.core.PlaybackMode

// What:     Session is the immutable pure value written and restored here.
// Why:      Storage code should not expose raw keys to the controller.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Session } from "./core/Session";
// ```
import dev.monochromatic.musicplayer.core.Session

// What:     `object` creates one stateless singleton, unlike an instantiable `class`.
// Why:      Session persistence needs no per-instance state.
//
// In TS you'd write (pseudocode):
// ```ts
// export const SessionStore = { load() {}, save() {} };
// ```
/** Loads, migrates, and saves the Android playback session. */
object SessionStore {
    /** App-private preferences file name. */
    private const val PREFS_NAME: String = "session"

    /** Selected-track content URI key. */
    private const val KEY_SELECTED: String = "selected"

    /** Raw Double-bit resume-position key. */
    private const val KEY_POSITION: String = "position_bits"

    /** Float output-gain key. */
    private const val KEY_VOLUME: String = "volume"

    /** Current single playback-mode key. */
    private const val KEY_PLAYBACK_MODE: String = "playback_mode"

    /** Former shuffle key, retained only as migration input. */
    private const val LEGACY_KEY_SHUFFLE: String = "shuffle"

    /** Former repeat-track key, retained only as migration input. */
    private const val LEGACY_KEY_REPEAT: String = "repeat_track"

    /** Persisted page-control style key. */
    private const val KEY_PAGE_CONTROL_STYLE: String = "page_control_style"

    // What:     `fun load(context: Context): Session` reads primitives and returns
    //           one typed value. Nullable String reads distinguish missing keys.
    // Why:      A valid new value wins; otherwise old fields migrate once and are
    //           removed so only one playback choice remains persisted.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function load(context: Context): Session { /* decode or migrate */ }
    // ```
    /** Restores a session and atomically upgrades former playback settings. */
    fun load(context: Context): Session {
        /** Preferences handle reused for all reads and any migration write. */
        val preferences: SharedPreferences = prefs(context)
        /** Current-format text, or null when this store still uses the old schema. */
        val storedMode: String? = preferences.getString(KEY_PLAYBACK_MODE, null)
        /** Exactly one decoded playback behavior. */
        val playbackMode: PlaybackMode = if (storedMode == null) {
            PlaybackMode.fromLegacy(
                preferences.getString(LEGACY_KEY_SHUFFLE, null),
                preferences.getBoolean(LEGACY_KEY_REPEAT, false),
            )
        } else {
            PlaybackMode.fromStoredName(storedMode)
        }
        if (
            storedMode == null ||
            preferences.contains(LEGACY_KEY_SHUFFLE) ||
            preferences.contains(LEGACY_KEY_REPEAT)
        ) {
            preferences.edit {
                if (storedMode == null) {
                    putString(KEY_PLAYBACK_MODE, playbackMode.storedName)
                }
                remove(LEGACY_KEY_SHUFFLE)
                remove(LEGACY_KEY_REPEAT)
            }
        }
        return Session(
            selected = preferences.getString(KEY_SELECTED, null),
            positionSecs = Double.fromBits(preferences.getLong(KEY_POSITION, 0L)),
            volume = preferences.getFloat(KEY_VOLUME, 1.0f),
            playbackMode = playbackMode,
        )
    }

    // What:     `fun save(context, session)` batches primitive writes through an
    //           editor receiver. `toRawBits` preserves the 64-bit Double exactly.
    // Why:      New saves contain one playback mode and proactively erase stale old keys.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function save(context: Context, session: Session): void { /* batch writes */ }
    // ```
    /** Persists current state using only the four-state playback schema. */
    fun save(context: Context, session: Session) {
        prefs(context).edit {
            putString(KEY_SELECTED, session.selected)
            putLong(KEY_POSITION, session.positionSecs.toRawBits())
            putFloat(KEY_VOLUME, session.volume)
            putString(KEY_PLAYBACK_MODE, session.playbackMode.storedName)
            remove(LEGACY_KEY_SHUFFLE)
            remove(LEGACY_KEY_REPEAT)
        }
    }

    /** Loads saved style with Chromium first-install and radio unknown-value fallback. */
    internal fun loadPageControlStyle(context: Context): PageControlStyle {
        /** Persisted enum name, or null when no style was saved. */
        val storedName: String? = prefs(context).getString(KEY_PAGE_CONTROL_STYLE, null)
        return PageControlStyle.fromStoredName(storedName)
    }

    /** Persists one page-control style selection. */
    internal fun savePageControlStyle(context: Context, style: PageControlStyle) {
        prefs(context).edit {
            putString(KEY_PAGE_CONTROL_STYLE, style.name)
        }
    }

    // What:     `getSharedPreferences` opens one app-private named primitive store.
    // Why:      All operations must resolve the same file with private visibility.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function prefs(context: Context): SharedPreferences { /* open private store */ }
    // ```
    /** Opens the app-private session preference file. */
    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
