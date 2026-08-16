//! Focused tests for desktop page-control build availability.

use super::*;

/// Confirms current catalog drives Settings labels and stable persisted values together.
#[test]
fn settings_options_match_included_catalog_entries() {
    let options = settings_options(&BUILD_STYLES);
    let expected = BUILD_STYLES.iter().filter(|entry| entry.included).collect::<Vec<_>>();
    assert_eq!(options.len(), expected.len());
    for (option, entry) in options.iter().zip(expected) {
        assert_eq!(option.label.as_str(), entry.label);
        assert_eq!(option.style, entry.style.to_int());
    }
}

/// Confirms every independently excluded style follows deterministic fallback chain.
#[test]
fn each_excluded_style_resolves_without_renumbering() {
    for excluded_index in 0..BUILD_STYLES.len() {
        let catalog: [BuildStyle; BUILD_STYLES.len()] = std::array::from_fn(|index| BuildStyle {
            included: index != excluded_index,
            ..BUILD_STYLES[index]
        });
        let excluded = BUILD_STYLES[excluded_index].style;
        let expected = if excluded == PageControlStyle::ChromiumTabs {
            PageControlStyle::Radio
        } else {
            PageControlStyle::ChromiumTabs
        };
        assert_eq!(
            resolve_style(StyleResolution { requested: excluded, catalog: &catalog }),
            Some(expected),
        );
    }
}

/// Confirms builds without Chromium and radio use first included stable style.
#[test]
fn fallback_uses_first_included_style_after_chromium_and_radio() {
    let catalog: [BuildStyle; BUILD_STYLES.len()] = std::array::from_fn(|index| BuildStyle {
        included: matches!(BUILD_STYLES[index].style, PageControlStyle::Md1Tabs),
        ..BUILD_STYLES[index]
    });
    assert_eq!(
        resolve_style(StyleResolution {
            requested: PageControlStyle::LedSegmentedButtons,
            catalog: &catalog,
        }),
        Some(PageControlStyle::Md1Tabs),
    );
}

/// Confirms invalid build with no included style cannot resolve silently.
#[test]
fn empty_build_catalog_has_no_effective_style() {
    let catalog: [BuildStyle; BUILD_STYLES.len()] = std::array::from_fn(|index| BuildStyle {
        included: false,
        ..BUILD_STYLES[index]
    });
    assert_eq!(
        resolve_style(StyleResolution { requested: PageControlStyle::ChromiumTabs, catalog: &catalog }),
        None,
    );
    assert!(settings_options(&catalog).is_empty());
}
