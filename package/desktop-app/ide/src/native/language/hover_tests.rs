//! Hover by Ctrl+Q and by the resting pointer: content, placement, and every dismissal.

/// Fixtures and real key and pointer events.
use super::test_support::{
    LanguageReader, caret, caret_x, definitions, escape, eventually, hover, idle, move_to, point,
    popup, project, reader, ready,
};
/// Key events and a tree-row lookup shared with the other window tests.
use crate::native::{find_tests::key, navigation_tests::row};
/// Encoded keys and window points.
use slint::{LogicalPosition, platform::Key};

/// Forty lines: words on even lines, blank odd lines.
fn sample() -> String {
    let mut text = String::new();
    for index in 0..40 {
        if index % 2 == 0 {
            text.push_str(&format!("alpha{index:02} beta\n"));
        } else {
            text.push('\n');
        }
    }
    return text;
}

/// Character offset of the start of `line` in `sample()`: even lines have 13 characters.
fn start(line: usize) -> usize {
    return (line / 2) * 14 + (line % 2) * 13;
}

/// A reader of `sample()` with the default scripted hover answers.
fn sample_reader() -> (super::test_support::Project, LanguageReader) {
    let fixture = project(&[("main.scripted", &sample()), ("other.scripted", "other\n")]);
    let opened = reader(&fixture, "main.scripted", definitions(&[], None));
    ready(&opened);
    return (fixture, opened);
}

/// Ctrl+Q shows the server's text below the caret line; Escape removes it.
#[test]
fn control_q_shows_hover_below_the_caret_line_and_escape_dismisses_it() {
    let (_fixture, reader) = sample_reader();
    caret(&reader, start(2) + 8);
    hover(&reader);
    eventually("the hover did not appear", || {
        return popup(&reader) == "line=alpha02 beta char=b";
    });
    assert!(!reader.window.get_language_popup_note());
    assert!(reader.window.get_language_popup_below());
    let top = reader.window.get_language_anchor_top();
    assert!(
        reader.window.get_language_popup_y() >= top + 24.0,
        "the hover covers its line"
    );
    escape(&reader);
    assert_eq!(popup(&reader), "");
    assert!(reader.window.get_source_has_focus());
}

/// Near the bottom of the view the hover goes above its line instead of covering it.
#[test]
fn hover_near_the_bottom_is_placed_above_its_line() {
    let (_fixture, reader) = sample_reader();
    let lines = (reader.window.get_viewport_height() / 24.0).floor() as usize;
    // The last fully visible even line.
    let line = (lines - 1) & !1;
    caret(&reader, start(line) + 1);
    hover(&reader);
    eventually("the hover did not appear", || {
        return popup(&reader).starts_with("line=alpha");
    });
    assert!(!reader.window.get_language_popup_below());
    let bottom = reader.window.get_language_popup_y() + reader.window.get_language_popup_height();
    assert!(
        bottom <= reader.window.get_language_anchor_top(),
        "the hover covers its line"
    );
}

/// Caret movement, scrolling, and a file switch each dismiss the hover.
#[test]
fn hover_is_dismissed_by_caret_movement_scrolling_and_a_file_switch() {
    let (_fixture, reader) = sample_reader();
    eventually("the tree did not show the files", || {
        return row(&reader.window, "other.scripted").is_some();
    });
    caret(&reader, start(0) + 2);
    hover(&reader);
    eventually("the hover did not appear", || {
        return !popup(&reader).is_empty();
    });
    key(&reader.window, Key::RightArrow);
    eventually("caret movement did not dismiss the hover", || {
        return popup(&reader).is_empty();
    });
    hover(&reader);
    eventually("the hover did not appear again", || {
        return !popup(&reader).is_empty();
    });
    reader.window.set_scroll_y(-48.0);
    eventually("scrolling did not dismiss the hover", || {
        return popup(&reader).is_empty();
    });
    reader.window.set_scroll_y(0.0);
    caret(&reader, start(0) + 2);
    hover(&reader);
    eventually("the hover did not appear a third time", || {
        return !popup(&reader).is_empty();
    });
    reader
        .window
        .invoke_tree_activate(row(&reader.window, "other.scripted").expect("other row"));
    eventually("the file switch did not dismiss the hover", || {
        return popup(&reader).is_empty();
    });
}

/// A reload of the displayed file dismisses the hover, whose positions describe the old text.
#[test]
fn hover_is_dismissed_when_the_file_reloads() {
    let (fixture, reader) = sample_reader();
    caret(&reader, start(0) + 2);
    hover(&reader);
    eventually("the hover did not appear", || {
        return !popup(&reader).is_empty();
    });
    let revision = reader.source.borrow().document.revision();
    // The change lies after the caret, so neither the caret nor the view moves.
    std::fs::write(fixture.root.join("main.scripted"), sample() + "appended\n")
        .expect("external change");
    eventually("the reload did not arrive", || {
        return reader.source.borrow().document.revision() != revision;
    });
    eventually("the reload did not dismiss the hover", || {
        return popup(&reader).is_empty();
    });
}

/// A resting pointer shows the hover of the character under it; leaving the source hides it,
/// and so does resting where there is no character.
#[test]
fn resting_pointer_shows_hover_and_leaving_or_resting_on_nothing_hides_it() {
    let (_fixture, reader) = sample_reader();
    let x = caret_x(&reader, start(4) + 8) + 2.0;
    move_to(&reader.window, point(&reader.window, 4, x));
    eventually("the pointer hover did not appear", || {
        return popup(&reader) == "line=alpha04 beta char=b";
    });
    move_to(&reader.window, LogicalPosition::new(100.0, 300.0));
    eventually("leaving the source did not hide the hover", || {
        return popup(&reader).is_empty();
    });
    move_to(&reader.window, point(&reader.window, 4, x));
    eventually("the pointer hover did not appear again", || {
        return !popup(&reader).is_empty();
    });
    move_to(&reader.window, point(&reader.window, 4, 600.0));
    eventually("resting past the line's end did not hide the hover", || {
        return popup(&reader).is_empty();
    });
    // A blank line has no character: resting there asks nothing.
    move_to(&reader.window, point(&reader.window, 5, 4.0));
    idle(600);
    assert_eq!(popup(&reader), "");
}

/// Ctrl+Q where the server has nothing explains that; a resting pointer stays silent.
#[test]
fn empty_hover_is_explained_for_ctrl_q_only() {
    let (_fixture, reader) = sample_reader();
    caret(&reader, start(1));
    hover(&reader);
    eventually("the empty hover was not explained", || {
        return popup(&reader) == "No hover information at this position.";
    });
    assert!(reader.window.get_language_popup_note());
    escape(&reader);
    assert_eq!(popup(&reader), "");
}
