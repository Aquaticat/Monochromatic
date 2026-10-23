# Music player on Android pauses for a notification sound instead of ducking

## Symptom

The human reported (2026-10-22, in Chinese) that other apps lower their volume for about a second when a message
sound plays, while the music player pauses, plays only the message sound, and resumes after it ends.

## Cause found by reading the source

Not reproduced on a device: the Pixel 6 was not connected when this was written.
Two pieces of `package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/RustEngine.kt`
produce the pause, and both are needed for it:

- The focus request is built with `.setWillPauseWhenDucked(true)`, whose comment says a music player prefers a clean
  pause over playing quietly.
  Android documents that setting as telling the system to use the app's callback instead of ducking the app by itself.
- `onFocusChange` handles `AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK` in the same arm as `AUDIOFOCUS_LOSS_TRANSIENT`: it
  remembers whether it was playing, calls `nativeEnginePause`, and resumes on `AUDIOFOCUS_GAIN`.

A notification sound asks for transient focus that may duck, so the app receives the can-duck loss and pauses.

## What the platform documents

From the Android audio focus guide (`developer.android.com/media/optimize/audio-focus`, fetched 2026-10-22):

- Automatic ducking (Android 8.0 and later) applies when the app that has focus is not playing speech, did not set
  `setWillPauseWhenDucked(true)`, and another app requests transient focus that may duck.
  The system then lowers the first app's players and restores them when the second app abandons focus.
- In that case the first app "does not usually receive an `onAudioFocusChange()` callback".
- Without automatic ducking, the guide says the app "should duck ... or pause" on a transient can-duck loss.

## Options for a fix

Not applied; the human asked for an investigation.

- Drop `setWillPauseWhenDucked(true)` and keep the listener.
  The system ducks by itself for notification sounds, as other apps behave.
  The listener still handles a real transient loss (a call, a navigation voice) by pausing.
- Also stop pausing on the can-duck loss in the listener, and lower the native engine volume there instead.
  This is the fallback for a device that still sends the callback, and it needs a volume path in the native engine.

Verification needs the phone: play a track, send a notification sound, and listen for a duck without a pause.
