package dev.monochromatic.musicplayer

import android.content.Context
import android.util.Log
import dev.monochromatic.musicplayer.core.PeakCache
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Process-wide persistent peak cache: the one [PeakCache] every part of the app shares, backed by an
 * app-private JSON file. It is the Android home for the desktop's `Arc<Mutex<PeakCache>>` plus its
 * `from_path`/`save` I/O, which the pure core port deliberately left out. The foreground measure-on-
 * miss path ([Media3Engine]) and the background sweep ([androidx.work] worker) both read and write
 * this single instance, so it is a singleton guarded by a coroutine [Mutex]: without one shared,
 * locked store the two would race on the map and the file and last-writer-wins would drop entries.
 *
 * Persistence is privacy-preserving exactly as on the desktop: the JSON maps the opaque
 * [dev.monochromatic.musicplayer.core.fingerprint] hex key to a measured peak, so no path, name, or
 * tag is ever written. The file is loaded lazily on first access and written atomically (temp file
 * then rename). Following the desktop's `flush_pending`, [flush] serializes a snapshot while holding
 * the lock but writes to disk with the lock released, so a slow write never blocks a track load.
 */
object PeakCacheStore {
    /** Logcat tag shared with the rest of the peak-cache code. */
    private const val STORE_TAG: String = "PeakCache"

    /** App-private file the cache persists to. */
    private const val FILE_NAME: String = "peaks.json"

    /** Temp file the atomic write stages into before renaming onto [FILE_NAME]. */
    private const val TEMP_FILE_NAME: String = "peaks.json.tmp"

    /** Guards [cache] and the [loaded] flag against the concurrent foreground and sweep callers. */
    private val mutex: Mutex = Mutex()

    /** The shared in-memory cache; the pure core map this store persists. */
    private val cache: PeakCache = PeakCache()

    /** Whether [ensureLoaded] has read the file yet; the load happens once, on first access. */
    private var loaded: Boolean = false

    /**
     * Cached peak for [key], or `null` on a miss. Loads the file on first access.
     *
     * @param context Resolves the app-private file directory.
     * @param key Opaque fingerprint from [dev.monochromatic.musicplayer.core.fingerprint].
     * @return Memoized true peak, or `null` when never measured.
     */
    suspend fun get(context: Context, key: String): Float? = mutex.withLock {
        ensureLoaded(context)
        cache.get(key)
    }

    /**
     * Memoize [peak] for [key] in memory. Does not write to disk; the caller calls [flush] when it
     * wants the change durable (immediately for a single foreground measurement, batched for a sweep).
     *
     * @param context Resolves the app-private file directory (and triggers the lazy load).
     * @param key Opaque fingerprint from [dev.monochromatic.musicplayer.core.fingerprint].
     * @param peak Measured true peak to memoize.
     */
    suspend fun put(context: Context, key: String, peak: Float) {
        mutex.withLock {
            ensureLoaded(context)
            cache.insert(key, peak)
        }
    }

    /**
     * Persist the current cache to disk atomically. The snapshot is serialized while the lock is held
     * (fast, in memory) and written with the lock released (slow, off the audio/track-load path), so
     * a track load that needs [get] is never blocked by the write.
     *
     * @param context Resolves the app-private file directory.
     */
    suspend fun flush(context: Context) {
        val json: String = mutex.withLock {
            ensureLoaded(context)
            serialize(cache.snapshot())
        }
        writeAtomic(context, json)
    }

    /**
     * Read the file into [cache] once. Subsequent calls are no-ops. Called under [mutex] by every
     * accessor, so the load races nothing; a corrupt or unreadable file is logged and treated as an
     * empty cache rather than failing the load.
     *
     * @param context Resolves the app-private file directory.
     */
    private suspend fun ensureLoaded(context: Context) {
        if (loaded) {
            return
        }
        val text: String? = withContext(Dispatchers.IO) {
            val file = File(context.filesDir, FILE_NAME)
            if (file.exists()) file.readText() else null
        }
        if (text != null) {
            runCatching { parseInto(text, cache) }
                .onFailure { failure ->
                    Log.w(STORE_TAG, "could not parse $FILE_NAME; starting from an empty cache", failure)
                }
        }
        loaded = true
    }

    /**
     * Insert every `fingerprint -> peak` entry from a persisted JSON object into [target].
     *
     * @param text JSON text previously written by [serialize].
     * @param target Cache to populate.
     */
    private fun parseInto(text: String, target: PeakCache) {
        val obj = JSONObject(text)
        obj.keys().forEach { key -> target.insert(key, obj.getDouble(key).toFloat()) }
    }

    /**
     * Serialize a cache snapshot to a flat JSON object of `fingerprint -> peak`.
     *
     * @param entries Snapshot from [PeakCache.snapshot].
     * @return JSON text for [writeAtomic].
     */
    private fun serialize(entries: Map<String, Float>): String {
        val obj = JSONObject()
        entries.forEach { (key, peak) -> obj.put(key, peak.toDouble()) }
        return obj.toString()
    }

    /**
     * Write [json] to [FILE_NAME] atomically: stage into [TEMP_FILE_NAME], then rename onto the
     * target so a crash mid-write never leaves a half-written cache. Runs on [Dispatchers.IO] with no
     * lock held.
     *
     * @param context Resolves the app-private file directory.
     * @param json Serialized cache to persist.
     */
    private suspend fun writeAtomic(context: Context, json: String) {
        withContext(Dispatchers.IO) {
            val temp = File(context.filesDir, TEMP_FILE_NAME)
            val target = File(context.filesDir, FILE_NAME)
            temp.writeText(json)
            // renameTo does not overwrite on every filesystem, so drop the old target first on a
            // second attempt; a final failure is logged, leaving the previous file intact.
            if (!temp.renameTo(target)) {
                target.delete()
                if (!temp.renameTo(target)) {
                    Log.w(STORE_TAG, "could not persist $FILE_NAME; cache stays in memory only")
                }
            }
        }
    }
}
