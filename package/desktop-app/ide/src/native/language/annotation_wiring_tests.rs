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

/// The server's hints and diagnostics appear with no key, pointer, scroll, or reload after them:
/// the poll that stores a snapshot also repaints the source.
#[test]
fn server_hints_and_diagnostics_are_painted_by_the_poll_that_stored_them() {
    let fixture = project(&[("main.scripted", TEXT)]);
    let reader = reader(&fixture, "main.scripted", definitions(&[], None));
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
    let reader = reader(&fixture, "main.scripted", definitions(&[], None));
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
