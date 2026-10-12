// What:     Unit tests for `ui_notices.rs`, pulled in by `#[cfg(test)] #[path = "ui_notices_tests.rs"] mod tests;`.
// Why:      The messages name the file, collapse many failures to a count, and avoid developer words.

use super::*;

#[test]
fn one_unplayable_file_is_named_without_its_folder() {
    assert_eq!(unplayable_message(&[PathBuf::from("/lib/Broken/01 Corrupt.wav")]), "01 Corrupt.wav can't be played.");
}

#[test]
fn several_unplayable_files_collapse_to_a_count_naming_the_first() {
    let paths = [PathBuf::from("/a/one.wav"), PathBuf::from("/a/two.wav"), PathBuf::from("/a/three.wav")];
    assert_eq!(unplayable_message(&paths), "3 files can't be played, including one.wav.");
}

#[test]
fn no_unplayable_files_give_no_message() {
    assert_eq!(unplayable_message(&[]), "");
}

#[test]
fn a_removed_playing_file_says_playback_stopped() {
    assert_eq!(file_gone_message(Path::new("/lib/Tiny/02.wav"), true), "02.wav was removed from the folder, so playback stopped.");
}

#[test]
fn a_removed_idle_file_does_not_claim_a_stop() {
    assert_eq!(file_gone_message(Path::new("/lib/Tiny/02.wav"), false), "02.wav was removed from the folder.");
}

#[test]
fn a_path_without_a_file_name_is_shown_whole() {
    assert_eq!(file_gone_message(Path::new("/"), false), "/ was removed from the folder.");
}
