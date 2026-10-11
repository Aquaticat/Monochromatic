//! Window binding for the Settings page and the template editor.
//!
//! What: opens and closes Settings and the editor, routes the editor's edits into `TemplateEditorState`,
//! and saves the applied templates to the session file when the editor closes.
//! Why: the editor rules live in `template_editor_state`; this module keeps the editor value in the screen
//! state while either page is open and applies the valid templates to the track rows and the deck.

use music_player::session::Session;
use music_player::template_editor_state::TemplateEditorState;
use music_player::template_editor::TemplateEditorEdit;
use music_player::template_model::TemplateKind;
use music_player::track_measure::lookup_by_name;
use slint::ComponentHandle;

use crate::ui_screen::{model_of, project, read_state, update_state};
use crate::ui_screen_view::{Route, ScreenState};
use crate::ui_settings_model::{editor_view, kind_of_index, settings_rows, EditorView, SettingsRow};
use crate::ui_templates::{editor_library, utf16_offset};
use crate::{AppWindow, EditorFieldRow, EditorPreviewRow, SettingsTemplateRow};

/// What: `wire` registers the Settings and editor callbacks and loads the saved templates into the state.
/// Why: the saved templates must be in the state before the first projection, so the rows show them.
pub(crate) fn wire(app: &AppWindow) {
    let (track_rows, playing) = Session::load_templates();
    update_state(|state| {
        state.track_rows_template = track_rows;
        state.playing_template = playing;
    });
    let open_weak = app.as_weak();
    app.on_open_settings(move || {
        if let Some(window) = open_weak.upgrade() {
            open_settings(&window);
        }
    });
    let template_weak = app.as_weak();
    app.on_settings_open_template(move |index| {
        if let Some(window) = template_weak.upgrade() {
            open_template(&window, index);
        }
    });
    let back_weak = app.as_weak();
    app.on_settings_back(move || {
        if let Some(window) = back_weak.upgrade() {
            settings_back(&window);
        }
    });
    wire_editor(app);
}

/// What: `wire_editor` registers the editor's text, focus, insert, reset and back callbacks.
/// Why: the editor reports every change, and each change is applied to the state and reprojected.
fn wire_editor(app: &AppWindow) {
    let text_weak = app.as_weak();
    app.on_editor_text_edited(move |text, start, end| {
        if let Some(window) = text_weak.upgrade() {
            edit_text(&window, text.as_str(), usize::try_from(start).unwrap_or(0), usize::try_from(end).unwrap_or(0));
        }
    });
    let focus_weak = app.as_weak();
    app.on_editor_focus_changed(move |focused| {
        if let Some(window) = focus_weak.upgrade() {
            update_editor(|editor| return editor.with_focus(focused));
            project(&window);
        }
    });
    let insert_weak = app.as_weak();
    app.on_editor_insert_field(move |index| {
        if let Some(window) = insert_weak.upgrade() {
            insert_field(&window, index);
        }
    });
    let reset_weak = app.as_weak();
    app.on_editor_reset(move || {
        if let Some(window) = reset_weak.upgrade() {
            update_editor(|editor| return editor.reset_to_default());
            project(&window);
        }
    });
    let back_weak = app.as_weak();
    app.on_editor_back(move || {
        if let Some(window) = back_weak.upgrade() {
            editor_back(&window);
        }
    });
}

/// What: `build_editor` starts the editor on the queue with the saved templates applied.
/// Why: a saved template that still applies becomes the editor's draft and applied text; others fall back to the default.
pub(crate) fn build_editor(state: &ScreenState) -> TemplateEditorState {
    let measures = lookup_by_name(&state.names, &state.paths, &state.measures);
    let mut editor = TemplateEditorState::initial(&editor_library(&state.names, &measures));
    for (kind, saved) in [
        (TemplateKind::TrackRows, state.track_rows_template.as_deref()),
        (TemplateKind::PlayingTrack, state.playing_template.as_deref()),
    ] {
        if let Some(text) = saved {
            let length = text.encode_utf16().count();
            editor = editor.open(kind).with_edit(TemplateEditorEdit {
                text: text.to_string(),
                selection_start: length,
                selection_end: length,
            });
        }
    }
    return editor.open(TemplateKind::TrackRows);
}

/// What: `open_settings` opens the Settings route with the template rows.
/// Why: Settings shows the applied line of each template, so the editor value is built from the saved texts.
pub(crate) fn open_settings(window: &AppWindow) {
    update_state(|state| {
        state.editor = Some(build_editor(state));
        state.route = Route::Settings;
    });
    project(window);
}

/// What: `open_template` opens the editor on the template of Settings row `index`.
/// Why: a tap on a Templates row opens that template's editor page.
fn open_template(window: &AppWindow, index: i32) {
    let Some(kind) = usize::try_from(index).ok().and_then(kind_of_index) else {
        return;
    };
    update_editor(|editor| return editor.open(kind));
    update_state(|state| {
        state.route = Route::TemplateEditor;
    });
    project(window);
}

/// What: `settings_back` returns from Settings to the player and drops the editor value.
/// Why: Settings holds no state of its own; the saved templates already live in the screen state.
fn settings_back(window: &AppWindow) {
    update_state(|state| {
        state.editor = None;
        state.route = Route::Player;
    });
    project(window);
}

/// What: `edit_text` applies one text edit with byte offsets from the editor.
/// Why: the editor reports byte offsets, and the template state expects UTF-16 code units; the callback also fires for caret moves, so a repeated report leaves the state unchanged.
fn edit_text(window: &AppWindow, text: &str, start_bytes: usize, end_bytes: usize) {
    update_editor(|editor| {
        return editor.with_edit(TemplateEditorEdit {
            text: text.to_string(),
            selection_start: utf16_offset(text, start_bytes),
            selection_end: utf16_offset(text, end_bytes),
        });
    });
    project(window);
}

/// What: `insert_field` inserts the call of the field row `index` at the caret.
/// Why: a tap on a field row inserts its call (D96).
fn insert_field(window: &AppWindow, index: i32) {
    let field_mode = read_state(|state| {
        let position = usize::try_from(index).ok()?;
        return state.editor.as_ref()?.fields().get(position).map(|field| return field.mode);
    });
    if let Some(mode) = field_mode {
        update_editor(|editor| return editor.insert_field(mode));
        project(window);
    }
}

/// What: `editor_back` saves the valid templates to the session file and returns to Settings.
/// Why: a template that does not apply keeps its previously applied text, so the rows never show a broken template.
fn editor_back(window: &AppWindow) {
    let saved = read_state(|state| {
        let editor = state.editor.as_ref()?;
        return Some((
            applied_text(editor, TemplateKind::TrackRows, state.track_rows_template.as_deref()),
            applied_text(editor, TemplateKind::PlayingTrack, state.playing_template.as_deref()),
        ));
    });
    let Some((track_rows, playing)) = saved else {
        return;
    };
    if let Err(error) = Session::save_templates(track_rows.as_deref(), playing.as_deref()) {
        tracing::warn!(?error, "failed to save the template texts");
    }
    update_state(|state| {
        state.track_rows_template = track_rows;
        state.playing_template = playing;
        state.editor = Some(build_editor(state));
        state.route = Route::Settings;
    });
    project(window);
}

/// What: `applied_text` gives the draft of `kind` when it applies, or the previously applied text otherwise.
/// Why: only texts that apply reach the track rows and the saved session.
fn applied_text(editor: &TemplateEditorState, kind: TemplateKind, previous: Option<&str>) -> Option<String> {
    let opened = editor.open(kind);
    if opened.is_valid() {
        return Some(opened.text().to_string());
    }
    return previous.map(str::to_string);
}

/// What: `update_editor` replaces the editor value in the state with the result of `change`.
/// Why: the editor is an immutable value, so every change builds the next value from the current one.
fn update_editor(change: impl FnOnce(&TemplateEditorState) -> TemplateEditorState) {
    update_state(|state| {
        if let Some(editor) = state.editor.as_ref() {
            state.editor = Some(change(editor));
        }
    });
}

/// What: `project_pages` pushes the Settings rows and every editor page value to the window.
/// Why: the pages take Slint structs, and the pure models supply the values in one state read.
pub(crate) fn project_pages(window: &AppWindow) {
    let (rows, view) = read_state(|state| {
        let rows: Vec<SettingsRow> = state.editor.as_ref().map_or_else(Vec::new, settings_rows);
        let view: Option<EditorView> = state.editor.as_ref().map(editor_view);
        return (rows, view);
    });
    window.set_settings_rows(model_of(
        rows.into_iter()
            .map(|row| return SettingsTemplateRow {
                label: row.label.as_str().into(),
                line: row.line.as_str().into(),
            })
            .collect(),
    ));
    let Some(page) = view else {
        return;
    };
    window.set_editor_title(page.title.as_str().into());
    window.set_editor_text(page.text.as_str().into());
    window.set_editor_preview_rows(model_of(
        page.preview
            .iter()
            .map(|(title, supporting)| return EditorPreviewRow {
                title: title.as_str().into(),
                supporting: supporting.as_str().into(),
            })
            .collect(),
    ));
    window.set_editor_mistakes(model_of(page.mistakes.iter().map(|line| return line.as_str().into()).collect()));
    window.set_editor_help_signature(page.help_signature.as_str().into());
    window.set_editor_help_description(page.help_description.as_str().into());
    window.set_editor_has_help(page.has_help);
    window.set_editor_fields(model_of(
        page.fields
            .iter()
            .map(|field| return EditorFieldRow {
                label: field.label.as_str().into(),
                insert: field.insert.as_str().into(),
                value: field.value.as_str().into(),
            })
            .collect(),
    ));
    window.set_editor_notes(model_of(page.notes.iter().map(|note| return note.as_str().into()).collect()));
    window.set_editor_can_reset(page.can_reset);
}
