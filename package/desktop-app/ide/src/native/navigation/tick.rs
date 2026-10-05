//! Nonblocking navigation replies and lazy directory refresh scheduling.

/// Toolkit callbacks retain only UI-thread owners and immutable worker replies.
use super::{AppWindow, Navigation, State, open, present};
/// Queue failures remain actionable diagnostics with their affected directory path.
use anyhow::Result;
/// Timed retry/refresh bounds avoid reading an inaccessible folder on every UI tick.
use std::{cell::RefCell, rc::Rc, time::{Duration, Instant}};

/// Consume the sole directory reply and retain its error until that same target recovers.
fn directory_reply(navigation: &mut Navigation) -> bool {
    if !navigation.reader_available { return false; }
    let was_busy = navigation.reader.is_busy();
    match navigation.reader.poll(&mut navigation.tree) {
        Ok(changed) => {
            if was_busy && !navigation.reader.is_busy() {
                let completed = navigation.reading.take();
                if changed && navigation.directory_error.as_ref().is_some_and(|(path, _message)| return Some(path) == completed.as_ref()) {
                    navigation.directory_error = None;
                    return true;
                }
            }
            return changed && navigation.tree.rows() != navigation.rows;
        }
        Err(error) => {
            // A normal read failure consumed its reply; an unexpected disconnect leaves no usable reader.
            if navigation.reader.is_busy() || navigation.reading.is_none() {
                navigation.reader_available = false;
            }
            let path = navigation.reading.take().unwrap_or_else(|| return navigation.workspace.root().to_path_buf());
            let message = format!("{error:#}. The last directory snapshot is retained. Restore access to this directory or restart the application.");
            if navigation.directory_error.as_ref() == Some(&(path.clone(), message.clone())) { return false; }
            tracing::warn!(path = %path.display(), %error, "project directory read failed");
            navigation.directory_error = Some((path, message));
            return true;
        }
    }
}

/// Fill one available read slot; lazy expansions take priority over round-robin visible-folder refresh.
fn schedule(navigation: &mut Navigation) -> Result<()> {
    if !navigation.reader_available || navigation.reader.is_busy() { return Ok(()); }
    let cooling = navigation.last_read.is_some_and(|time| return time.elapsed() < Duration::from_millis(500));
    let missing = navigation.tree.missing_listings();
    let next_missing = missing.iter().find(|path| {
        return !cooling || !navigation.directory_error.as_ref().is_some_and(|(failed, _message)| return failed == *path);
    });
    let target = if let Some(path) = next_missing {
        path.clone()
    } else {
        if cooling { return Ok(()); }
        let mut directories = vec![navigation.workspace.root().to_path_buf()];
        for row in &navigation.rows {
            if row.entry.is_directory && row.expanded {
                directories.push(row.entry.path.clone());
            }
        }
        navigation.refresh_index %= directories.len();
        let path = directories[navigation.refresh_index].clone();
        navigation.refresh_index += 1;
        path
    };
    if navigation.reader.request(&mut navigation.tree, &target)? {
        navigation.reading = Some(target);
        navigation.last_read = Some(Instant::now());
    }
    return Ok(());
}

/// Apply current results before scheduling more work, keeping source selection independent of tree reads.
pub(super) fn update(window: &AppWindow, source: &Rc<RefCell<State>>, shared: &Rc<RefCell<Navigation>>) {
    let mut navigation = shared.borrow_mut();
    let changed = directory_reply(&mut navigation);
    if navigation.opener.has_pending() {
        match navigation.opener.poll() {
            Ok(Some(opened)) => {
                if let Err(error) = open::apply(window, source, &mut navigation, opened) {
                    open::failed(window, source, format!("{error:#}"));
                }
            }
            Ok(None) => {}
            Err(error) => {
                open::failed(window, source, format!("{error:#}. Choose a readable UTF-8 file inside this project."));
            }
        }
    }
    // A missing reveal target waits for a directory change, not another identical model every 20ms.
    // Initial opens and explicit shortcuts already publish once at their action boundary.
    if changed {
        present::update(window, source, &mut navigation);
    }
    if let Err(error) = schedule(&mut navigation) {
        tracing::warn!(%error, "cannot schedule project directory read");
        navigation.reader_available = false;
        navigation.directory_error = Some((navigation.workspace.root().to_path_buf(), format!("{error:#}. Restart the application to resume directory reads.")));
        present::update(window, source, &mut navigation);
    }
}
