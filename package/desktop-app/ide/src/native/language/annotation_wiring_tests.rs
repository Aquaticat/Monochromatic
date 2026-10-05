//! The language poll and the annotation renderer working together through real window events:
//! hints and diagnostics from the server are painted by the poll that stored them,
//! and the caret's problem card yields to the language popup.

/// Fixtures, the scripted server, and real key events.
use super::test_support::{
    caret, definitions, escape, eventually, hover, popup, project, reader, ready,
};
/// What: `Model` is the trait that gives a Slint list its `row_count`; in Rust a trait must be
///       imported before its methods can be called on a value.
/// Why: The tests count painted severity markers and hint boxes.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // No import: a TS array already has `.length`.
/// ```
use slint::Model;

/// Two lines. The scripted server warns about the first character of the first line
/// and returns one hint after `alpha`.
const TEXT: &str = "alpha beta\ngamma delta\n";

/// What: The scripted server's setting that makes it push its warning on every publish;
///       `&[(&str, &str)]` is a borrowed list of borrowed name and value pairs.
/// Why: The shared test definitions turn pushed diagnostics off unless a test names `PUSH`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const PUSHED: [string, string][] = [['PUSH', '1']];
/// ```
const PUSHED: &[(&str, &str)] = &[("PUSH", "1")];

/// What: The pushed warning, from a server that starts answering only three seconds after it was started.
/// Why: The source refresh repaints once, when the file's first highlighting answer arrives. A server that
///      answers after that leaves the language poll as the only thing that can paint its hints and warning.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const LATE: [string, string][] = [['PUSH', '1'], ['INIT_DELAY_MS', '3000']];
/// ```
const LATE: &[(&str, &str)] = &[("PUSH", "1"), ("INIT_DELAY_MS", "3000")];

/// The server's hints and diagnostics appear with no key, pointer, scroll, reload, or highlighting
/// answer after them: the poll that stores a snapshot also repaints the source.
#[test]
fn server_hints_and_diagnostics_are_painted_by_the_poll_that_stored_them() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader(&fixture, "main.scripted", definitions(LATE, None));
    // What: `borrow()` lends the shared source state for reading; `Some(revision)` is the present
    //       value the highlighting revision is compared with.
    // Why: The source refresh asks for highlighting until an answer for the displayed revision was
    //      applied, and repaints when it applies one. After this wait it repaints nothing more.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // await eventually(() => source.current.syntaxRevision === source.current.document.revision());
    // ```
    eventually("the first highlighting answer was not applied", || {
        let current = reader.source.borrow();
        return current.syntax_revision == Some(current.document.revision());
    });
    // The order this test depends on: nothing from the delayed server was painted by that repaint.
    assert!(
        reader.window.get_source_markers().row_count() == 0
            && reader.window.get_hint_boxes().row_count() == 0,
        "the delayed server answered before highlighting settled; the repaints cannot be told apart"
    );
    ready(&reader);
    eventually(
        "accepted hints and diagnostics were stored but never painted",
        || {
            return reader.window.get_source_markers().row_count() > 0
                && reader.window.get_hint_boxes().row_count() > 0;
        },
    );
}

/// The caret's problem card hides while the hover popup is shown beside the same line and
/// returns when the popup is dismissed; the problems stay in the accessible description.
#[test]
fn caret_problem_card_yields_to_the_hover_popup() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader(&fixture, "main.scripted", definitions(PUSHED, None));
    ready(&reader);
    eventually("the server's diagnostic was not painted", || {
        return reader.window.get_source_markers().row_count() > 0;
    });
    // The scripted warning covers the first character of the first line.
    caret(&reader, 0);
    eventually("the caret's problem card did not appear", || {
        return reader.window.get_problem_card_visible();
    });
    hover(&reader);
    eventually("the hover popup did not appear", || {
        return !popup(&reader).is_empty();
    });
    assert!(
        !reader.window.get_problem_card_visible(),
        "the problem card stayed under the hover popup"
    );
    assert!(
        reader.window.get_caret_problems().contains("TEXT:"),
        "the problems left the description while the popup was shown"
    );
    escape(&reader);
    eventually(
        "the problem card did not return after the popup was dismissed",
        || {
            return popup(&reader).is_empty() && reader.window.get_problem_card_visible();
        },
    );
}
