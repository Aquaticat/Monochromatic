// What:     Controller tests for `controller_flow.rs`: Play with nothing selected, the stop at the end of a folder, and
//           the report of files that could not be played. Each test builds a silent controller (no audio device, a
//           degraded cache that touches no disk) over a disposable library under the system temp directory.
// Why:      EM2, PB4 and PB1 of the second polish review; each decision must hold in the controller, not only in the queue.

use super::*;
use crate::command::{Command, PlaybackMode, Update};
use crate::peakcache::CacheHandle;
use std::sync::{Arc, Mutex};

/// What: `Library` is a disposable folder of fixture tracks and the updates a controller over it has emitted.
/// Why: every test needs both, and the folder is removed when the value drops.
struct Library {
    root: PathBuf,
    seen: Arc<Mutex<Vec<String>>>,
}

/// Methods of `Library`.
impl Library {
    /// What: `new` makes a folder holding the given relative files, copying `fixture/tone.flac` for each name that ends
    /// in `.flac` and writing bytes that cannot be decoded for each name that ends in `.wav`.
    /// Why: tests choose which files play and which cannot be opened.
    fn new(tag: &str, files: &[&str]) -> Library {
        let nanos: u128 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |elapsed| return elapsed.as_nanos());
        let root = std::env::temp_dir().join(format!("music-player-flow-{}-{nanos}-{tag}", std::process::id()));
        for file in files {
            let path = root.join(file);
            std::fs::create_dir_all(path.parent().expect("a file has a folder")).expect("the folder is created");
            if file.ends_with(".flac") {
                std::fs::copy("fixture/tone.flac", &path).expect("the fixture is copied");
            } else {
                std::fs::write(&path, b"not audio").expect("the broken file is written");
            }
        }
        return Library { root, seen: Arc::new(Mutex::new(Vec::new())) };
    }

    /// What: `controller` builds a silent controller that records a short text for every update it emits.
    /// Why: the tests read the updates the window would receive.
    fn controller(&self) -> Controller {
        let sink = Arc::clone(&self.seen);
        return Controller::new(
            Box::new(move |update| {
                let text = match &update {
                    Update::Playing(on) => format!("playing {on}"),
                    Update::Unplayable(paths) => format!("unplayable {}", paths.len()),
                    Update::FileGone { path, was_playing } => format!("gone {} {was_playing}", path.display()),
                    Update::Reading { name } => format!("reading {name}"),
                    Update::SourceRoot(name) => format!("root {name:?}"),
                    Update::NowPlaying { index, .. } => format!("now {index:?}"),
                    Update::Queue(names) => format!("queue {}", names.join("|")),
                    _ => return,
                };
                sink.lock().expect("the sink is not poisoned").push(text);
            }),
            None,
            CacheHandle::open_degraded(),
        );
    }

    /// What: `updates` lists the recorded updates.
    /// Why: tests compare it with what the window must receive.
    fn updates(&self) -> Vec<String> {
        return self.seen.lock().expect("the sink is not poisoned").clone();
    }
}

/// Removes the library folder when the test ends.
impl Drop for Library {
    /// What: `drop` removes the folder.
    /// Why: tests leave no files behind.
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.root).ok();
    }
}

/// What: `open` opens the library without selecting anything and without playing.
/// Why: this is how a launch or the folder dialog opens a folder.
fn open(controller: &mut Controller, library: &Library) {
    controller.handle_command(Command::OpenRoot { root: library.root.clone(), select: None, play: false });
}

#[test]
fn play_with_nothing_selected_starts_the_first_track() {
    let library = Library::new("play-first", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    assert_eq!(controller.queue.current_path(), None, "a plain open selects nothing");
    controller.handle_command(Command::Play);
    assert!(controller.playing, "Play starts something");
    assert_eq!(controller.queue.current_index(), Some(0));
    assert!(controller.source.is_some(), "the first track is loaded");
    assert!(library.updates().contains(&"now Some(0)".to_string()));
}

#[test]
fn play_with_nothing_selected_starts_the_first_track_of_the_displayed_page() {
    let library = Library::new("play-page", &["A/1.flac", "B/1.flac", "B/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SetPageScope(vec![1, 2]));
    controller.handle_command(Command::TogglePlay);
    assert!(controller.playing);
    assert_eq!(controller.queue.current_index(), Some(1), "the first track of the page on screen, not of the queue");
}

#[test]
fn play_with_an_empty_queue_stays_paused_and_says_so() {
    let library = Library::new("play-empty", &[]);
    let mut controller = library.controller();
    controller.handle_command(Command::Play);
    assert!(!controller.playing);
    assert_eq!(library.updates(), vec!["playing false".to_string()], "the window is told the truth, so its button flips back");
    controller.handle_command(Command::TogglePlay);
    assert!(!controller.playing);
}

#[test]
fn toggle_pauses_a_playing_track_and_resumes_it_without_reloading() {
    let library = Library::new("toggle", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SelectIndex(1));
    controller.handle_command(Command::Play);
    assert_eq!(controller.queue.current_index(), Some(1));
    controller.handle_command(Command::TogglePlay);
    assert!(!controller.playing);
    controller.handle_command(Command::TogglePlay);
    assert!(controller.playing);
    assert_eq!(controller.queue.current_index(), Some(1), "resuming keeps the track");
}

#[test]
fn in_order_stops_at_the_end_of_the_folder_and_play_starts_the_folder_again() {
    let library = Library::new("in-order-stop", &["A/1.flac", "A/2.flac", "B/1.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SetPlaybackMode(PlaybackMode::InOrder));
    controller.handle_command(Command::SelectIndex(1));
    controller.handle_command(Command::Play);
    assert!(controller.playing);
    controller.on_track_end();
    assert!(!controller.playing, "the last track of the folder ended, so playback stops");
    assert_eq!(controller.queue.current_index(), Some(0), "the cursor is back on the first track of the folder");
    assert!(controller.source.is_some(), "the first track is loaded and waiting");
    assert!(library.updates().contains(&"playing false".to_string()));
    controller.handle_command(Command::Play);
    assert!(controller.playing, "Play starts the folder again");
    assert_eq!(controller.queue.current_index(), Some(0));
}

#[test]
fn in_order_keeps_going_inside_the_folder() {
    let library = Library::new("in-order-go", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SetPlaybackMode(PlaybackMode::InOrder));
    controller.handle_command(Command::SelectIndex(0));
    controller.handle_command(Command::Play);
    controller.on_track_end();
    assert!(controller.playing);
    assert_eq!(controller.queue.current_index(), Some(1));
}

#[test]
fn a_manual_next_at_the_end_still_wraps_and_keeps_playing() {
    let library = Library::new("next-wrap", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SetPlaybackMode(PlaybackMode::InOrder));
    controller.handle_command(Command::SelectIndex(1));
    controller.handle_command(Command::Play);
    controller.handle_command(Command::Next);
    assert!(controller.playing);
    assert_eq!(controller.queue.current_index(), Some(0));
}

#[test]
fn repeat_never_stops_at_the_end() {
    let library = Library::new("repeat-go", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SetPlaybackMode(PlaybackMode::Repeat));
    controller.handle_command(Command::SelectIndex(1));
    controller.handle_command(Command::Play);
    controller.on_track_end();
    assert!(controller.playing);
    assert_eq!(controller.queue.current_index(), Some(1));
}

#[test]
fn a_file_that_cannot_be_opened_is_reported_and_the_next_one_plays() {
    let library = Library::new("unplayable", &["A/1 Corrupt.wav", "A/2 Fine.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SelectIndex(0));
    assert_eq!(controller.queue.current_index(), Some(1), "the broken file was skipped");
    assert!(library.updates().contains(&"unplayable 1".to_string()), "and the window is told which file");
}

#[test]
fn a_library_where_nothing_can_be_opened_reports_every_file_and_stays_paused() {
    let library = Library::new("all-broken", &["A/1.wav", "A/2.wav"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::Play);
    assert!(!controller.playing, "nothing loaded, so nothing plays");
    assert!(library.updates().contains(&"unplayable 2".to_string()));
}

#[test]
fn a_playable_library_reports_nothing_unplayable() {
    let library = Library::new("all-fine", &["A/1.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SelectIndex(0));
    assert!(!library.updates().iter().any(|text| return text.starts_with("unplayable")));
}

#[test]
fn removing_the_selected_file_reports_it_and_stops_playback() {
    let library = Library::new("file-gone", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SelectIndex(1));
    controller.handle_command(Command::Play);
    let gone = library.root.join("A/2.flac");
    std::fs::remove_file(&gone).expect("the selected file is removed");
    controller.handle_command(Command::Rescan);
    assert!(!controller.playing);
    assert!(library.updates().contains(&format!("gone {} true", gone.display())));
}

#[test]
fn opening_a_folder_says_it_is_being_read_before_the_queue_arrives() {
    let library = Library::new("reading", &["A/1.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    let updates = library.updates();
    let reading = updates.iter().position(|text| return text.starts_with("reading ")).expect("a reading update is sent");
    let queue = updates.iter().position(|text| return text.starts_with("queue ")).expect("the queue update is sent");
    assert!(reading < queue, "reading comes first: {updates:?}");
}

#[test]
fn no_library_command_says_no_folder_is_open() {
    let library = Library::new("no-library", &[]);
    let mut controller = library.controller();
    controller.handle_command(Command::NoLibrary);
    assert_eq!(library.updates(), vec!["root None".to_string()]);
}

#[test]
fn a_library_with_one_top_level_folder_keeps_the_folder_in_every_name_it_sends() {
    let library = Library::new("single-folder", &["Only Artist/Take 2.flac", "Only Artist/Take 10.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    assert!(
        library.updates().contains(&"queue Only Artist/Take 2.flac|Only Artist/Take 10.flac".to_string()),
        "the names are relative to the opened folder, in natural order: {:?}",
        library.updates(),
    );
}

#[test]
fn a_restored_selected_track_starts_on_the_toggle_the_row_click_sends() {
    let library = Library::new("restored-toggle", &["A/1.flac", "A/2.flac"]);
    let mut controller = library.controller();
    controller.handle_command(Command::OpenRoot { root: library.root.clone(), select: Some(library.root.join("A/2.flac")), play: false });
    assert_eq!(controller.queue.current_index(), Some(1), "the saved track is the current one");
    assert!(!controller.playing, "a restored track waits paused");
    controller.handle_command(Command::TogglePlay);
    assert!(controller.playing, "the toggle a click on the current row sends starts it");
    assert_eq!(controller.queue.current_index(), Some(1), "and keeps the track");
}

#[test]
fn selecting_a_row_loads_it_paused_and_stops_the_playing_track() {
    let library = Library::new("select-pauses", &["A/1.flac", "A/2.flac", "A/3.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SelectIndex(0));
    controller.handle_command(Command::Play);
    assert!(controller.playing);
    controller.handle_command(Command::SelectIndex(2));
    assert_eq!(controller.queue.current_index(), Some(2), "the clicked row is current");
    assert!(!controller.playing, "selecting never starts playback and stops the playing track");
    assert!(controller.source.is_some(), "the selected track is loaded, so the next toggle resumes it");
}

#[test]
fn selecting_a_row_that_cannot_be_opened_is_reported_and_the_current_track_is_recorded() {
    let library = Library::new("select-unreadable", &["A/1.flac", "A/2.wav", "A/3.flac"]);
    let mut controller = library.controller();
    open(&mut controller, &library);
    controller.handle_command(Command::SelectIndex(1));
    assert!(!controller.playing, "nothing plays after the select");
    assert!(library.updates().iter().any(|text| return text.starts_with("unplayable ")), "the file is named as unplayable: {:?}", library.updates());
    // What the window shows as current after a select of an unreadable row is the controller's choice, written down here.
    assert_eq!(controller.queue.current_index(), Some(2), "load_current skips the unreadable file to the next playable one");
}
