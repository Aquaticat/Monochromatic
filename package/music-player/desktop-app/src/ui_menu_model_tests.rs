//! Tests for the pure track menu model in `ui_menu_model`.

use super::*;

#[test]
fn menu_has_the_seven_actions_in_order_with_their_icons() {
    let items = menu_items(None);
    let icons: Vec<i32> = items.iter().map(|item| return item.icon).collect();
    assert_eq!(icons, vec![0, 1, 2, 3, 4, 5, 6]);
    assert_eq!(items[0].label, "Play");
    assert_eq!(items[6].label, "Move to trash");
}

#[test]
fn only_move_to_trash_is_destructive() {
    let items = menu_items(None);
    let destructive: Vec<&str> = items
        .iter()
        .filter(|item| return item.destructive)
        .map(|item| return item.label.as_str())
        .collect();
    assert_eq!(destructive, vec!["Move to trash"]);
}

#[test]
fn details_row_carries_the_size_value_and_no_other_row_does() {
    let items = menu_items(Some("4.2 MB"));
    assert_eq!(items[2].value, "4.2 MB");
    let others: Vec<&str> = items
        .iter()
        .enumerate()
        .filter(|(index, _)| return *index != 2)
        .map(|(_, item)| return item.value.as_str())
        .collect();
    assert!(others.iter().all(|value| return value.is_empty()));
}

#[test]
fn human_size_uses_kb_mb_and_gb_steps() {
    assert_eq!(human_size(512), "0.5 KB");
    assert_eq!(human_size(3 * 1024 * 1024 + 512 * 1024), "3.5 MB");
    assert_eq!(human_size(2 * 1024 * 1024 * 1024), "2.0 GB");
}
