package dev.monochromatic.musicplayer

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Fast JVM unit tests for [sweepTracksInParallel], the concurrency skeleton shared by the foreground
 * [PeakSweepService] and the background [PeakSweepWorker]. Everything Android (the per-track decode,
 * the cache flush, the progress notification) is injected, so these run off-device with fakes and
 * deterministically exercise the cursor, the flush cadence, the bound, the tallies, and cancellation,
 * none of which an on-device run could cover once the device cache is already warm.
 */
class PeakSweepCoordinatorTest {
    /** The lock-free cursor must hand each index to exactly one worker: no skips, no duplicates. */
    @Test
    fun parallelWorkersProcessEveryItemExactlyOnce() = runBlocking {
        val items = (0 until ITEM_COUNT).toList()
        val seen = ConcurrentHashMap.newKeySet<Int>()
        val calls = AtomicInteger(0)
        val tally = sweepTracksInParallel(
            items = items,
            workers = MANY_WORKERS,
            dispatcher = Dispatchers.Default,
            flushBatch = FLUSH_BATCH,
            notifyEvery = NOTIFY_EVERY,
            maxTracks = Int.MAX_VALUE,
            process = { item ->
                calls.incrementAndGet()
                seen.add(item)
                SweepOutcome.MEASURED
            },
            onFlush = { },
            onProgress = { _, _ -> },
        )
        assertEquals("every item is claimed once", ITEM_COUNT, calls.get())
        assertEquals("the same set of items is covered", items.toSet(), seen)
        assertEquals(ITEM_COUNT, tally.processed)
        assertEquals(ITEM_COUNT, tally.measured)
        assertEquals(ITEM_COUNT, tally.total)
    }

    /** maxTracks caps the sweep to a slice (how a test or a bounded run stays short). */
    @Test
    fun honorsMaxTracksBound() = runBlocking {
        val seen = ConcurrentHashMap.newKeySet<Int>()
        val tally = sweepTracksInParallel(
            items = (0 until ITEM_COUNT).toList(),
            workers = FEW_WORKERS,
            dispatcher = Dispatchers.Default,
            flushBatch = FLUSH_BATCH,
            notifyEvery = NOTIFY_EVERY,
            maxTracks = SLICE,
            process = { item ->
                seen.add(item)
                SweepOutcome.MEASURED
            },
            onFlush = { },
            onProgress = { _, _ -> },
        )
        assertEquals(SLICE, tally.processed)
        assertEquals(SLICE, seen.size)
        assertEquals(ITEM_COUNT, tally.total)
    }

    /** Each outcome kind lands in its own tally counter. */
    @Test
    fun talliesEachOutcomeKind() = runBlocking {
        val cycle = listOf(
            SweepOutcome.MEASURED,
            SweepOutcome.CACHED,
            SweepOutcome.UNFINGERPRINTABLE,
            SweepOutcome.FAILED,
        )
        val tally = sweepTracksInParallel(
            items = (0 until OUTCOME_ITEMS).toList(),
            workers = FEW_WORKERS,
            dispatcher = Dispatchers.Default,
            flushBatch = Int.MAX_VALUE,
            notifyEvery = Int.MAX_VALUE,
            maxTracks = Int.MAX_VALUE,
            process = { item -> cycle[item % cycle.size] },
            onFlush = { },
            onProgress = { _, _ -> },
        )
        val perKind = OUTCOME_ITEMS / cycle.size
        assertEquals(perKind, tally.measured)
        assertEquals(perKind, tally.cached)
        assertEquals(perKind, tally.unfingerprintable)
        assertEquals(perKind, tally.failed)
        assertEquals(OUTCOME_ITEMS, tally.processed)
    }

    /** A flush fires once per [flushBatch] measurements plus a final flush, regardless of interleaving. */
    @Test
    fun flushesEveryBatchPlusFinal() = runBlocking {
        val flushes = AtomicInteger(0)
        sweepTracksInParallel(
            items = (0 until FLUSH_ITEMS).toList(),
            workers = FEW_WORKERS,
            dispatcher = Dispatchers.Default,
            flushBatch = FLUSH_EVERY,
            notifyEvery = Int.MAX_VALUE,
            maxTracks = Int.MAX_VALUE,
            process = { SweepOutcome.MEASURED },
            onFlush = { flushes.incrementAndGet() },
            onProgress = { _, _ -> },
        )
        // FLUSH_ITEMS / FLUSH_EVERY periodic flushes, plus the one guaranteed final flush.
        assertEquals(FLUSH_ITEMS / FLUSH_EVERY + 1, flushes.get())
    }

    /** Cancelling the calling scope stops the workers promptly and still runs the final flush. */
    @Test
    fun cancellationStopsWorkAndStillRunsFinalFlush() = runBlocking {
        val started = AtomicInteger(0)
        val flushes = AtomicInteger(0)
        val job = launch {
            sweepTracksInParallel(
                items = (0 until HUGE_COUNT).toList(),
                workers = FEW_WORKERS,
                dispatcher = Dispatchers.Default,
                flushBatch = Int.MAX_VALUE,
                notifyEvery = Int.MAX_VALUE,
                maxTracks = Int.MAX_VALUE,
                process = {
                    started.incrementAndGet()
                    delay(PER_ITEM_MS)
                    SweepOutcome.MEASURED
                },
                onFlush = { flushes.incrementAndGet() },
                onProgress = { _, _ -> },
            )
        }
        delay(SETTLE_MS)
        val before = started.get()
        job.cancelAndJoin()
        delay(SETTLE_MS)
        val after = started.get()
        assertTrue(
            "workers must stop claiming after cancel (before=$before after=$after)",
            after - before <= FEW_WORKERS,
        )
        assertTrue("the final flush must run even on cancellation", flushes.get() >= 1)
    }

    /** A single worker is the serial upkeep sweep: it still covers everything, in order. */
    @Test
    fun singleWorkerSerialCoversAllInOrder() = runBlocking {
        val seen = mutableListOf<Int>()
        val tally = sweepTracksInParallel(
            items = (0 until SERIAL_COUNT).toList(),
            workers = 1,
            dispatcher = Dispatchers.Default,
            flushBatch = FLUSH_EVERY,
            notifyEvery = Int.MAX_VALUE,
            maxTracks = Int.MAX_VALUE,
            process = { item ->
                seen.add(item)
                SweepOutcome.MEASURED
            },
            onFlush = { },
            onProgress = { _, _ -> },
        )
        assertEquals(SERIAL_COUNT, tally.processed)
        assertEquals((0 until SERIAL_COUNT).toList(), seen)
    }

    private companion object {
        private const val ITEM_COUNT = 500
        private const val MANY_WORKERS = 8
        private const val FEW_WORKERS = 4
        private const val FLUSH_BATCH = 32
        private const val NOTIFY_EVERY = 16
        private const val SLICE = 50
        private const val OUTCOME_ITEMS = 400
        private const val FLUSH_ITEMS = 40
        private const val FLUSH_EVERY = 8
        private const val HUGE_COUNT = 10_000
        private const val SERIAL_COUNT = 30
        private const val PER_ITEM_MS = 20L
        private const val SETTLE_MS = 80L
    }
}
