// What:     Unit tests for `session.rs`, pulled in by
//           `#[cfg(test)] #[path = "session_tests.rs"] mod tests;` at
//           the bottom of `session.rs`. Compiles only under
//           `cargo nextest run` / `cargo test`; reaches the module items
//           (including private ones) via `use super::*` because this file is
//           the `tests` CHILD of session.
// Why:      Keep the tests beside the code without inflating
//           `session.rs` or its max-lines budget (sibling
//           `*_tests.rs` files are exempt from the linter).
// TS map:   `session.unit.test.ts` beside `session.ts`.

// What:     `use super::*;` bring the module's items into the test scope.
// Why:      Tests need `Session`, etc.
// TS map:   `import * as parent from "./session";`
use super::*;

#[test]
fn json_round_trip_preserves_fields() {
    // What:     build a non-default session literal.
    // Why:      Exercise serialization of every field.
    // TS map:   `const original = { ... };`
    let original = Session {
        // What:     `vec![PathBuf::from("/a.flac"), PathBuf::from("/b.opus")]`
        //           the `vec!` macro builds a `Vec` from listed elements;
        //           `PathBuf::from` wraps each string literal as a path.
        // Why:      Two sample tracks.
        // TS map:   `["/a.flac", "/b.opus"]`.
        tracks: vec![PathBuf::from("/a.flac"), PathBuf::from("/b.opus")],
        current: Some(1),
        position_secs: 12.5,
        volume: 0.7,
        shuffle: ShuffleMode::WithinPage,
        repeat_track: true,
    };
    // What:     `serde_json::to_string(&original).unwrap()` serializes to JSON.
    //           `.unwrap()` extracts the `Ok` value and PANICS on `Err` (fine
    //           in a test).
    // Why:      Produce the wire form.
    // TS map:   `const json = JSON.stringify(original);`
    let json = serde_json::to_string(&original).unwrap();
    // What:     `serde_json::from_str::<Session>(&json).unwrap()` parses it back.
    // Why:      Round-trip the value.
    // TS map:   `const back = JSON.parse(json) as Session;`
    let back = serde_json::from_str::<Session>(&json).unwrap();
    // What:     `assert_eq!(original, back)` fails unless they are equal (uses
    //           the derived `PartialEq`).
    // Why:      No field is lost or altered by the round-trip.
    // TS map:   `expect(back).toEqual(original);`
    assert_eq!(original, back);
}

#[test]
fn prune_drops_missing_and_remaps_current() {
    // What:     `std::env::temp_dir()` returns the OS temp directory `PathBuf`.
    // Why:      We create one real file there so `exists()` is true for it.
    // TS map:   `const dir = os.tmpdir();`
    let dir = std::env::temp_dir();
    // What:     `dir.join("player_prune_test_present.wav")` build a real path.
    // Why:      This file will actually be created.
    // TS map:   `const present = join(dir, "...present.wav");`
    let present = dir.join("player_prune_test_present.wav");
    // What:     `std::fs::write(&present, b"x").unwrap();` writes one byte.
    //           `b"x"` is a BYTE-STRING literal (`&[u8]`), not a text `&str`.
    // Why:      Make the file exist on disk.
    // TS map:   `writeFileSync(present, "x");`
    std::fs::write(&present, b"x").unwrap();
    // What:     a path that does not exist.
    // Why:      Should be pruned.
    // TS map:   `const missing = join(dir, "...missing.wav");`
    let missing = dir.join("player_prune_test_missing_xyz.wav");
    // What:     session with [missing, present], current = 1 (the present one).
    // Why:      After pruning, only `present` survives and current must remap
    //           from index 1 to index 0.
    // TS map:   `{ tracks: [missing, present], current: 1, ... }`.
    let mut session = Session {
        tracks: vec![missing.clone(), present.clone()],
        current: Some(1),
        position_secs: 5.0,
        volume: 1.0,
        shuffle: ShuffleMode::Off,
        repeat_track: false,
    };
    // What:     run the prune.
    // Why:      The behaviour under test.
    // TS map:   `session.pruneUnplayable();`
    session.prune_unplayable();
    // What:     only one track remains.
    // Why:      The missing one was dropped.
    // TS map:   `expect(session.tracks.length).toBe(1);`
    assert_eq!(session.tracks.len(), 1);
    // What:     the survivor is `present`.
    // Why:      Correct file kept.
    // TS map:   `expect(session.tracks[0]).toBe(present);`
    assert_eq!(session.tracks[0], present);
    // What:     current remapped from 1 to 0.
    // Why:      The cursor must follow the surviving track.
    // TS map:   `expect(session.current).toBe(0);`
    assert_eq!(session.current, Some(0));
    // What:     `std::fs::remove_file(&present).ok();` clean up the temp file.
    //           `.ok()` converts the `Result` to `Option`, discarding any error.
    // Why:      Do not leave test droppings; ignore failure to delete.
    // TS map:   `try { unlinkSync(present); } catch {}`
    std::fs::remove_file(&present).ok();
}

#[test]
fn prune_clears_position_when_current_track_gone() {
    // What:     session whose only track is missing and is current.
    // Why:      Position must reset because the resume target is gone.
    // TS map:   `{ tracks: [missing], current: 0, positionSecs: 9, ... }`.
    let mut session = Session {
        tracks: vec![PathBuf::from("/definitely/not/here_404.flac")],
        current: Some(0),
        position_secs: 9.0,
        volume: 1.0,
        shuffle: ShuffleMode::Off,
        repeat_track: false,
    };
    session.prune_unplayable();
    // What:     queue now empty.
    // Why:      The only track was missing.
    // TS map:   `expect(session.tracks.length).toBe(0);`
    assert_eq!(session.tracks.len(), 0);
    // What:     current cleared.
    // Why:      Nothing to resume.
    // TS map:   `expect(session.current).toBe(null);`
    assert_eq!(session.current, None);
    // What:     position reset to 0.0.
    // Why:      No track to resume into.
    // TS map:   `expect(session.positionSecs).toBe(0);`
    assert_eq!(session.position_secs, 0.0);
}

#[test]
fn prune_drops_present_non_audio_and_remaps_current() {
    // What:     `let dir = std::env::temp_dir();`. The OS temp directory.
    // Why:      We create real files so `exists()` is true for both.
    // TS map:   `const dir = os.tmpdir();`
    let dir = std::env::temp_dir();
    // What:     a present NON-audio file (cover art) and a present audio file.
    // Why:      Both exist, so only the audio-extension test separates them.
    // TS map:   `const junk = join(dir, "...cover.jpg"); const audio = join(dir, "...song.flac");`
    let junk = dir.join("player_prune_cover_xyz.jpg");
    let audio = dir.join("player_prune_song_xyz.flac");
    // What:     `std::fs::write(&junk, b"x").unwrap();`. Create each file with one
    //           byte. `b"x"` is a BYTE-STRING literal (`&[u8]`), not text.
    // Why:      Make both paths exist on disk.
    // TS map:   `writeFileSync(junk, "x"); writeFileSync(audio, "x");`
    std::fs::write(&junk, b"x").unwrap();
    std::fs::write(&audio, b"x").unwrap();
    // What:     session with [junk, audio], current = 1 (the audio one).
    // Why:      After pruning, only `audio` survives and current must remap from
    //           index 1 to index 0.
    // TS map:   `{ tracks: [junk, audio], current: 1, ... }`.
    let mut session = Session {
        tracks: vec![junk.clone(), audio.clone()],
        current: Some(1),
        position_secs: 3.0,
        volume: 1.0,
        shuffle: ShuffleMode::Off,
        repeat_track: false,
    };
    // What:     run the prune.
    // Why:      The behaviour under test.
    // TS map:   `session.pruneUnplayable();`
    session.prune_unplayable();
    // What:     `assert_eq!(session.tracks, vec![audio.clone()]);`. Only the audio
    //           file remains.
    // Why:      The present non-audio file was dropped.
    // TS map:   `expect(session.tracks).toEqual([audio]);`
    assert_eq!(session.tracks, vec![audio.clone()]);
    // What:     current remapped from 1 to 0.
    // Why:      The cursor must follow the surviving audio track.
    // TS map:   `expect(session.current).toBe(0);`
    assert_eq!(session.current, Some(0));
    // What:     `std::fs::remove_file(...).ok();` clean up both temp files;
    //           `.ok()` discards any deletion error.
    // Why:      Leave no test droppings.
    // TS map:   `try { unlinkSync(junk); unlinkSync(audio); } catch {}`
    std::fs::remove_file(&junk).ok();
    std::fs::remove_file(&audio).ok();
}
