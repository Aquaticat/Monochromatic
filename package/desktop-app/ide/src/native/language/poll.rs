//! One language tick: synchronize, read status, send due requests, apply replies, store snapshots.

/// The state, the request record, and the steps of a tick.
use super::{Action, Language, Pending, guard, message, outcome, surface, sync};
/// The window, the source, and the navigation that opens other files.
use crate::native::{AppWindow, State, navigation::Navigation};
/// The identity of the displayed text and the requests the worker takes.
use ide_app::language::{identity::DocumentStamp, reply::PositionRequest};
/// What: `Rc<RefCell<T>>` is the window's shared, borrow-checked state.
/// Why: A tick reads the displayed document and changes the popup, the list, and the caret.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Shared<T> = { current: T };
/// ```
use std::{cell::RefCell, rc::Rc};

/// What: Turn language support off after the worker stopped, keeping the reason for later notes.
/// Why: A stopped worker must never take the window down; a waiting explicit action is
///      answered with the reason at once.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function stop(window, source, language, error: Error): void
/// ```
pub(super) fn stop(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    language: &mut Language,
    error: &anyhow::Error,
) {
    tracing::error!(?error, "language support stopped");
    let reason = format!("{error:#}");
    language.worker = None;
    language.failure = Some(reason.clone());
    language.hover = None;
    source.borrow_mut().language_reload = None;
    // `take` moves the waiting action out; it is answered with the reason.
    if let Some(pending) = language.action.take()
        && pending.action.explicit()
    {
        language.shown = surface::popup(
            window,
            source,
            pending.position,
            &message::stopped(&reason),
            (true, false),
        );
    }
}

/// What: Send a request that is not queued yet. `Ok(())` also when the queue was full; it is
///       sent again next tick.
/// Why: Requests go out only for the text the worker holds.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function send(language: Language, slot: Pending | undefined, displayed: DocumentStamp): void
/// ```
fn send(language: &mut Language, hover: bool, displayed: DocumentStamp) -> anyhow::Result<()> {
    if language.synced != Some(displayed) {
        return Ok(());
    }
    let Some(worker) = language.worker.as_mut() else {
        return Ok(());
    };
    // `as_mut` lends the chosen slot's request for modification.
    let slot = if hover {
        language.hover.as_mut()
    } else {
        language.action.as_mut()
    };
    let Some(pending) = slot else {
        return Ok(());
    };
    if pending.number.is_some() || pending.stamp != displayed {
        return Ok(());
    }
    let number = worker.request(PositionRequest {
        stamp: pending.stamp,
        kind: pending.action.kind(),
        position: pending.position,
    })?;
    if let Some(sent) = number {
        tracing::debug!(action = ?pending.action, number = sent, position = pending.position, "sent a language request");
    }
    pending.number = number;
    return Ok(());
}

/// What: Drop a waiting request whose text is no longer displayed.
/// Why: The worker drops it too and never replies; a reload of the same file is explained,
///      because the user is still looking at the place they asked about.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function cancelStale(window, source, language, displayed: DocumentStamp): void
/// ```
fn cancel_stale(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    language: &mut Language,
    displayed: DocumentStamp,
) {
    if language
        .hover
        .as_ref()
        .is_some_and(|pending| return pending.stamp != displayed)
    {
        language.hover = None;
    }
    let Some(pending) = language.action.take_if(|pending| return pending.stamp != displayed)
    else {
        return;
    };
    tracing::debug!(action = ?pending.action, ?displayed, "dropped a language request for text no longer displayed");
    if pending.stamp.file == displayed.file && pending.action.explicit() {
        let sentence = message::changed(pending.action);
        let position = source.borrow().document.position().head;
        language.shown = surface::popup(window, source, position, &sentence, (true, false));
    }
}

/// What: Read every reply now waiting and attach the admitted ones to their requests.
/// Why: All replies are drained before any request is finished, because answers needing no
///      server traffic arrive together.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function replies(language: Language, displayed: DocumentStamp): void
/// ```
fn replies(language: &mut Language, displayed: DocumentStamp) -> anyhow::Result<()> {
    loop {
        let Some(worker) = language.worker.as_mut() else {
            return Ok(());
        };
        let Some(reply) = worker.try_take_reply()? else {
            return Ok(());
        };
        let mut admitted = false;
        // `[...]` builds a fixed two-element array of the two slots, walked in order.
        for slot in [&mut language.action, &mut language.hover] {
            let Some(pending) = slot.as_mut() else {
                continue;
            };
            let verdict = guard::verdict(pending, displayed, &reply);
            if verdict != guard::Verdict::Apply {
                tracing::debug!(?verdict, request = reply.request, action = ?pending.action, "language reply not applied to this request");
                continue;
            }
            admitted = true;
            pending.complete = reply.remaining == 0;
            // `push` records the server's answer with the server that gave it.
            pending.outcomes.push((reply.server.clone(), reply.outcome.clone()));
        }
        if !admitted {
            tracing::debug!(request = reply.request, stamp = ?reply.stamp, "dropped a language reply no request waits for");
        }
    }
}

/// Finish whichever requests are complete.
fn finish(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    navigation: &Rc<RefCell<Navigation>>,
    language: &mut Language,
) {
    // `take_if` moves the request out only when its last answer arrived.
    if let Some(pending) = language.hover.take_if(|pending| return pending.complete) {
        outcome::finish(window, source, navigation, language, pending);
    }
    if let Some(pending) = language.action.take_if(|pending| return pending.complete) {
        outcome::finish(window, source, navigation, language, pending);
    }
}

/// What: Store new hints and diagnostics that describe the displayed text.
/// Why: The source renderer reads them from `State`; this module does not draw them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function snapshots(language: Language, source: Shared<State>, displayed: DocumentStamp): void
/// ```
fn snapshots(
    language: &mut Language,
    source: &Rc<RefCell<State>>,
    displayed: DocumentStamp,
) -> anyhow::Result<()> {
    let Some(worker) = language.worker.as_mut() else {
        return Ok(());
    };
    let hints = worker.try_take_hints()?;
    let diagnostics = worker.try_take_diagnostics()?;
    let mut current = source.borrow_mut();
    if let Some(snapshot) = hints
        && current.annotations.accept_hints(displayed, snapshot)
    {
        // The accessor the renderer uses reports what was stored.
        let count = current
            .annotations
            .hints(displayed)
            .map_or(0, |stored| return stored.hints.len());
        tracing::debug!(count, ?displayed, "stored inlay hints for the displayed text");
    }
    if let Some(snapshot) = diagnostics
        && current.annotations.accept_diagnostics(displayed, snapshot)
    {
        let groups = current
            .annotations
            .diagnostics(displayed)
            .map_or(0, |stored| return stored.groups.len());
        tracing::debug!(groups, ?displayed, "stored diagnostics for the displayed text");
    }
    return Ok(());
}

/// What: Ask for hover information where the pointer has rested long enough.
/// Why: Nothing is asked while the list, the search overlay, or a note is shown.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rest(window, source, language, displayed: DocumentStamp): void
/// ```
fn rest(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    language: &mut Language,
    displayed: DocumentStamp,
) {
    let blocked = window.get_search_open()
        || matches!(
            language.shown,
            surface::Shown::List { .. } | surface::Shown::Popup { note: true, .. }
        );
    if blocked {
        return;
    }
    if language.rest.idle()
        && matches!(language.shown, surface::Shown::Popup { pointer: true, .. })
    {
        language.shown = surface::dismiss(window, &language.shown, "the pointer rests over no character");
    }
    let Some(character) = language.rest.due() else {
        return;
    };
    language.rest.asked = true;
    // A character outside the displayed text cannot be asked about.
    if character > source.borrow().document.text().len_chars() {
        return;
    }
    language.hover = Some(Pending {
        action: Action::PointerHover,
        stamp: displayed,
        position: character,
        number: None,
        outcomes: Vec::new(),
        complete: false,
    });
}

/// What: One tick. Every worker error turns language support off for the rest of the session.
/// Why: Order matters: the worker is told about the displayed text before anything is asked,
///      and status is read before replies so a reply's explanation sees the newest states.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function tick(window, source, navigation, language): void
/// ```
pub(super) fn tick(
    window: &AppWindow,
    source: &Rc<RefCell<State>>,
    navigation: &Rc<RefCell<Navigation>>,
    language: &mut Language,
) {
    if language.worker.is_none() {
        // Nothing will send the record; dropping it keeps the source state small.
        source.borrow_mut().language_reload = None;
        return;
    }
    let displayed = surface::displayed(&source.borrow());
    // A closure returning `anyhow::Result<()>` lets `?` stop the steps at the first worker error.
    let mut steps = || -> anyhow::Result<()> {
        sync::update(language, source)?;
        // A status for an earlier file generation is ignored.
        if let Some(worker) = language.worker.as_mut()
            && let Some(status) = worker.try_take_status()?
            && status.file == Some(displayed.file)
        {
            language.status = status;
        }
        cancel_stale(window, source, language, displayed);
        rest(window, source, language, displayed);
        send(language, false, displayed)?;
        send(language, true, displayed)?;
        replies(language, displayed)?;
        finish(window, source, navigation, language);
        // A references request made by a finished definition goes out in the same tick.
        send(language, false, displayed)?;
        snapshots(language, source, displayed)?;
        if language.synced == Some(displayed) {
            sync::hints(language, window, displayed)?;
        }
        return Ok(());
    };
    if let Err(error) = steps() {
        stop(window, source, language, &error);
        return;
    }
    let state = source.borrow();
    let reason = surface::stale(window, &state, &language.shown, language.rest.over());
    drop(state);
    if let Some(why) = reason {
        language.shown = surface::dismiss(window, &language.shown, why);
    }
}
