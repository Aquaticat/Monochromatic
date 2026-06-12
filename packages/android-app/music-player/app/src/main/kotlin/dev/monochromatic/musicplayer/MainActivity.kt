package dev.monochromatic.musicplayer

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.monochromatic.musicplayer.core.ShuffleMode
import kotlinx.coroutines.delay

/** Tag for the logcat lines the on-device verification reads back. */
const val LOG_TAG = "MusicPlayer"

/** Seconds per minute, for the `m:ss` time labels. */
private const val SECONDS_PER_MINUTE: Int = 60

/** Position-poll cadence for the seek bar, in milliseconds (the desktop emits every 0.1s). */
private const val POSITION_POLL_MS: Long = 200L

/**
 * Single-activity host. The player lives in [PlaybackService] so audio outlives this activity, so the
 * UI binds to that service for a direct handle to the service-owned [PlayerController] and drives it
 * (single process, one brain). Binding with [Context.BIND_AUTO_CREATE] also creates the service,
 * which builds the [androidx.media3.session.MediaSession] and goes foreground on play.
 */
class MainActivity : ComponentActivity() {
    /** Service-owned brain, observable so the Compose tree swaps off the loading state once bound. */
    private val boundController = mutableStateOf<PlayerController?>(null)

    /** Live binder for the post-grant library-load signal; null while unbound. */
    private var binder: PlaybackService.LocalBinder? = null

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val local = service as PlaybackService.LocalBinder
            binder = local
            boundController.value = local.controller
            Log.i(LOG_TAG, "bound to PlaybackService")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            binder = null
            boundController.value = null
            Log.i(LOG_TAG, "PlaybackService disconnected")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(LOG_TAG, "MainActivity.onCreate flavor=${BuildConfig.FLAVOR}")
        // Draw edge to edge (the platform default on targetSdk 35+) and let the
        // Scaffold apply the system-bar insets.
        enableEdgeToEdge()
        setContent {
            val colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()
            MaterialTheme(colorScheme = colorScheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val controller = boundController.value
                    if (controller == null) {
                        StartingGate()
                    } else {
                        AppRoot(controller = controller, onAudioGranted = { binder?.ensureLibraryLoaded() })
                    }
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val intent = Intent(this, PlaybackService::class.java).setAction(PlaybackService.ACTION_LOCAL_BIND)
        bindService(intent, connection, Context.BIND_AUTO_CREATE)
    }

    override fun onStop() {
        super.onStop()
        // Unbind only; the service stays alive on its own (foreground while playing) so audio keeps
        // going. Never release the controller here: it belongs to the service, not this activity.
        unbindService(connection)
        binder = null
        boundController.value = null
    }
}

/**
 * The audio-permission gate and library trigger over a bound [controller]: requests audio access
 * once, shows [PermissionGate] until granted, and on grant signals the service to load the library
 * (the service owns the query); once access is held it shows [PlayerScreen].
 *
 * @param controller Service-owned brain to render and drive.
 * @param onAudioGranted Invoked when audio access is (re)confirmed, to trigger the service-side load.
 */
@Composable
private fun AppRoot(controller: PlayerController, onAudioGranted: () -> Unit) {
    val context = LocalContext.current
    var hasAudioAccess by remember { mutableStateOf(hasAudioPermission(context)) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        Log.i(LOG_TAG, "audio permission granted=$granted")
        hasAudioAccess = granted
    }
    // Ask once on first launch; the gate's button re-asks if the user declined.
    LaunchedEffect(Unit) {
        if (!hasAudioAccess) {
            permissionLauncher.launch(audioPermission())
        }
    }
    // On (re)confirmed access, tell the service to load the library (it owns the brain + query).
    LaunchedEffect(hasAudioAccess) {
        if (hasAudioAccess) {
            onAudioGranted()
        }
    }
    if (hasAudioAccess) {
        PlayerScreen(controller)
    } else {
        PermissionGate(onGrant = { permissionLauncher.launch(audioPermission()) })
    }
}

/** Brief placeholder shown while the activity binds to [PlaybackService]. */
@Composable
private fun StartingGate() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Starting Music Player...")
    }
}

/**
 * The player screen, the desktop's narrow (single-column) layout: a seek bar, a volume slider, a
 * wrapping control row (shuffle / transport / repeat), the page-tab grid, and the selected page's
 * track list. Tap a track to play it; tap the playing track to pause or resume.
 *
 * @param controller Drives the queue, pagination, and playback; its `uiState` is observed here.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PlayerScreen(controller: PlayerController) {
    val state = controller.uiState
    var position by remember { mutableDoubleStateOf(0.0) }
    var duration by remember { mutableDoubleStateOf(0.0) }

    LaunchedEffect(Unit) {
        while (true) {
            position = controller.positionSec()
            duration = controller.durationSec()
            delay(POSITION_POLL_MS)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Music Player") }) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SeekRow(position = position, duration = duration, onSeek = { controller.seek(it) })
            VolumeRow(volume = state.volume, onVolume = { controller.setVolume(it) })
            ControlRow(state = state, controller = controller)
            if (state.pageLabels.isNotEmpty()) {
                PageTabs(state = state, onSelectPage = { controller.selectPage(it) })
            }
            TrackList(state = state, controller = controller)
        }
    }
}

/** Seek bar: elapsed time, a position slider over the track duration, and total time. */
@Composable
private fun SeekRow(position: Double, duration: Double, onSeek: (Double) -> Unit) {
    val maxValue = if (duration > 0.0) duration.toFloat() else 1.0f
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(formatTime(position))
        Slider(
            value = position.toFloat().coerceIn(0.0f, maxValue),
            onValueChange = { onSeek(it.toDouble()) },
            valueRange = 0.0f..maxValue,
            modifier = Modifier
                .weight(1.0f)
                .padding(horizontal = 8.dp),
        )
        Text(formatTime(duration))
    }
}

/** Volume row: a "Volume" label and a 0..1 gain slider. */
@Composable
private fun VolumeRow(volume: Float, onVolume: (Float) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Volume")
        Slider(
            value = volume,
            onValueChange = onVolume,
            valueRange = 0.0f..1.0f,
            modifier = Modifier
                .weight(1.0f)
                .padding(start = 8.dp),
        )
    }
}

/** Wrapping control row: the three-state shuffle radios, the transport buttons, and repeat-track. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ControlRow(state: PlayerUiState, controller: PlayerController) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Shuffle")
            ShuffleOption("Off", state.shuffle == ShuffleMode.OFF) { controller.setShuffle(ShuffleMode.OFF) }
            ShuffleOption("Within page", state.shuffle == ShuffleMode.WITHIN_PAGE) {
                controller.setShuffle(ShuffleMode.WITHIN_PAGE)
            }
            ShuffleOption("All", state.shuffle == ShuffleMode.ALL) { controller.setShuffle(ShuffleMode.ALL) }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { controller.prev() }) { Text("Prev") }
            Button(onClick = { controller.togglePlay() }) { Text(if (state.playing) "Pause" else "Play") }
            Button(onClick = { controller.next() }) { Text("Next") }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = state.repeatTrack, onCheckedChange = { controller.setRepeatTrack(it) })
            Text("Repeat track")
        }
    }
}

/** One shuffle radio: a Material3 radio and its label, the whole pair clickable. */
@Composable
private fun ShuffleOption(label: String, selected: Boolean, onSelect: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clickable { onSelect() },
    ) {
        RadioButton(selected = selected, onClick = onSelect)
        Text(label)
    }
}

/** Page-tab grid: one button per page, the active page filled, the rest outlined. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PageTabs(state: PlayerUiState, onSelectPage: (Int) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        state.pageLabels.forEachIndexed { page, label ->
            if (page == state.selectedPage) {
                Button(onClick = { onSelectPage(page) }) { Text(label) }
            } else {
                OutlinedButton(onClick = { onSelectPage(page) }) { Text(label) }
            }
        }
    }
}

/** The selected page's track rows; the current track is highlighted, tap plays / toggles. */
@Composable
private fun ColumnScope.TrackList(state: PlayerUiState, controller: PlayerController) {
    if (state.queueSize == 0) {
        Text("No music found in your audio library.")
        return
    }
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1.0f, fill = true),
    ) {
        items(state.pageItems) { item ->
            val isCurrent = item.index == state.currentIndex
            val rowBackground = if (isCurrent) MaterialTheme.colorScheme.primary else Color.Transparent
            val rowColor = if (isCurrent) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurface
            }
            Text(
                text = item.name,
                color = rowColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(rowBackground)
                    .clickable {
                        Log.i(LOG_TAG, "tap row ${item.index} (current=${state.currentIndex})")
                        if (item.index == state.currentIndex) {
                            controller.togglePlay()
                        } else {
                            controller.playIndex(item.index)
                        }
                    }
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            )
        }
    }
}

/**
 * Format a seconds value as `m:ss`.
 *
 * @param seconds Time in seconds.
 * @return `m:ss` string, e.g. `3:07`.
 */
private fun formatTime(seconds: Double): String {
    val total = seconds.toInt()
    val minutes = total / SECONDS_PER_MINUTE
    val secs = total % SECONDS_PER_MINUTE
    return "%d:%02d".format(minutes, secs)
}

/**
 * Shown until audio access is granted: a one-line rationale and a button that re-requests the
 * permission, so a user who declined the first prompt still has a way back in.
 *
 * @param onGrant Invoked when the user taps the button; launches the permission request.
 */
@Composable
private fun PermissionGate(onGrant: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Music Player needs access to your audio library to list your music.")
        Button(onClick = onGrant) { Text("Grant access") }
    }
}
