// Debug builds log every disk read, disk write and network call that runs on the main thread, so main-thread I/O shows
// up in logcat under the tag `StrictMode` (S2 and M6 of the polish review).

// What:     `package dev.monochromatic.musicplayer` places the debug application beside the app's other classes.
// Why:      The debug manifest names it as the application class of debug builds only.
//
// In TS you'd write (pseudocode):
// ```ts
// // Module identity comes from the file path.
// ```
package dev.monochromatic.musicplayer

import android.app.Application
import android.os.StrictMode
import android.util.Log

// What:     `class DebugApplication : Application()` installs StrictMode policies when the process starts.
// Why:      The thread policy reports blocking calls on the main thread with a stack trace and the VM policy reports
//           closable objects that were never closed. Both only log, so a violation never changes behavior.
//
// In TS you'd write (pseudocode):
// ```ts
// class DebugApplication extends Application { onCreate() { strictMode.detectAll().penaltyLog(); } }
// ```
/** Application class of debug builds: turns on StrictMode logging for the main thread and for leaked closables. */
class DebugApplication : Application() {
    /** Installs the StrictMode policies before any activity or service starts. */
    override fun onCreate() {
        super.onCreate()
        StrictMode.setThreadPolicy(StrictMode.ThreadPolicy.Builder().detectAll().penaltyLog().build())
        StrictMode.setVmPolicy(StrictMode.VmPolicy.Builder().detectLeakedClosableObjects().penaltyLog().build())
        Log.i("DebugApplication", "StrictMode logging is on")
    }
}
