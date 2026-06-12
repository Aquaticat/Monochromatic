package dev.monochromatic.musicplayer

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

/** Tag for the logcat lines the on-device verification reads back. */
const val LOG_TAG = "MusicPlayer"

/** Single-activity host; the whole UI is the Compose tree set in [onCreate]. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(LOG_TAG, "MainActivity.onCreate flavor=${BuildConfig.FLAVOR}")
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PlayerScreen()
                }
            }
        }
    }
}

/**
 * Skeleton player screen: lists the audio files pushed into the app's external files dir and
 * plays the tapped one through the flavor's [AudioEngine]. This proves the engine decodes real
 * audio on the device; the full queue, pagination, and true-peak UI port over later.
 */
@Composable
fun PlayerScreen() {
    val context = LocalContext.current
    val engine = remember { createAudioEngine(context) }
    var state by remember { mutableStateOf(EngineState("idle", null)) }

    DisposableEffect(Unit) {
        engine.setOnState { next ->
            Log.i(LOG_TAG, "state -> ${next.status} (${next.nowPlaying ?: "none"})")
            state = next
        }
        onDispose { engine.release() }
    }

    val files = remember {
        context.getExternalFilesDir(null)
            ?.listFiles()
            ?.filter { it.isFile }
            ?.sortedBy { it.name }
            ?: emptyList()
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Music Player — ${BuildConfig.FLAVOR} engine", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text("State: ${state.status}   ${state.nowPlaying ?: ""}")
        Spacer(Modifier.height(8.dp))
        Row {
            Button(onClick = { engine.pause() }) { Text("Pause") }
            Spacer(Modifier.width(8.dp))
            Button(onClick = { engine.stop() }) { Text("Stop") }
        }
        Spacer(Modifier.height(16.dp))
        if (files.isEmpty()) {
            Text("No files in app external files dir. adb push audio there to test.")
        } else {
            LazyColumn {
                items(files) { file ->
                    Text(
                        text = file.name,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                Log.i(LOG_TAG, "tap play ${file.name}")
                                engine.play(file.absolutePath)
                            }
                            .padding(12.dp),
                    )
                }
            }
        }
    }
}
