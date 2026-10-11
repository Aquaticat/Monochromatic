//! Tests for the pure Settings and editor models in `ui_settings_model`.

use super::*;
use music_player::template_editor_state::TemplateEditorState;

#[test]
fn settings_lists_both_templates_in_kind_order() {
    let editor = TemplateEditorState::initial(&[]);
    let rows = settings_rows(&editor);
    assert_eq!(rows.len(), TemplateKind::all().len());
    assert_eq!(rows[0].label, TemplateKind::TrackRows.label());
    assert!(!rows[0].line.is_empty());
}

#[test]
fn kind_of_index_maps_the_settings_rows_back_to_templates() {
    assert_eq!(kind_of_index(0), Some(TemplateKind::TrackRows));
    assert_eq!(kind_of_index(9), None);
}

#[test]
fn editor_view_opens_on_the_track_rows_template_with_its_text() {
    let editor = TemplateEditorState::initial(&[]);
    let view = editor_view(&editor);
    assert_eq!(view.title, TemplateKind::TrackRows.label());
    assert_eq!(view.text, TemplateKind::TrackRows.default_template());
    assert!(!view.fields.is_empty());
    assert!(!view.can_reset);
}
