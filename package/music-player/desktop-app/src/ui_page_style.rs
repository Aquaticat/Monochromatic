//! Wires build-available page-control styles between Slint and desktop session persistence.

/// Imports generated application, style-option, and component-handle types.
use crate::{AppWindow, PageControlStyleOption};

/// Imports named persisted page-control variants and session record.
use music_player::session::{PageControlStyle, Session};

/// Imports Slint model and shared-string adapters.
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};

/// Describes one stable page-control style and its one-line build toggle.
#[derive(Clone, Copy, Debug)]
struct BuildStyle {
    /// Stable persisted style variant.
    style: PageControlStyle,
    /// Human-readable Settings label.
    label: &'static str,
    /// Whether current build exposes and resolves to this style.
    included: bool,
}

/// Central page-control build catalog. Change only `included` on one line to toggle a style.
const BUILD_STYLES: [BuildStyle; 6] = [
    BuildStyle { style: PageControlStyle::Radio, label: "Radio controls", included: true },
    BuildStyle { style: PageControlStyle::Md1Tabs, label: "Multi-row MD1 tabs", included: true },
    BuildStyle { style: PageControlStyle::RoundedButtons, label: "Rounded buttons", included: true },
    BuildStyle { style: PageControlStyle::SegmentedButtons, label: "Segmented buttons", included: true },
    BuildStyle { style: PageControlStyle::ChromiumTabs, label: "Chromium-like tabs", included: true },
    BuildStyle {
        style: PageControlStyle::LedSegmentedButtons,
        label: "Super fun LED segmented buttons",
        included: true,
    },
];

/// Groups requested style with build catalog used to resolve it.
#[derive(Clone, Copy, Debug)]
struct StyleResolution<'catalog> {
    /// Style decoded from first-install or persisted state.
    requested: PageControlStyle,
    /// Catalog whose availability controls effective result.
    catalog: &'catalog [BuildStyle],
}

/// Resolves requested style through Chromium, radio, then first-included fallback chain.
fn resolve_style(options: StyleResolution<'_>) -> Option<PageControlStyle> {
    if options.catalog.iter().any(|entry| entry.included && entry.style == options.requested) {
        return Some(options.requested);
    }
    for fallback in [PageControlStyle::ChromiumTabs, PageControlStyle::Radio] {
        if options.catalog.iter().any(|entry| entry.included && entry.style == fallback) {
            return Some(fallback);
        }
    }
    options.catalog.iter().find(|entry| entry.included).map(|entry| entry.style)
}

/// Builds Settings model from styles included by current build catalog.
fn settings_options(catalog: &[BuildStyle]) -> Vec<PageControlStyleOption> {
    catalog
        .iter()
        .filter(|entry| entry.included)
        .map(|entry| PageControlStyleOption {
            label: SharedString::from(entry.label),
            style: entry.style.to_int(),
        })
        .collect()
}

/// Restores effective style, supplies Settings options, and persists later selections.
pub(crate) fn apply(app: &AppWindow) {
    let restored = Session::load().page_control_style;
    let resolved = resolve_style(StyleResolution { requested: restored, catalog: &BUILD_STYLES })
        .expect("at least one BUILD_STYLES entry must set included: true");
    let options = settings_options(&BUILD_STYLES);
    app.set_page_control_style(resolved.to_int());
    app.set_page_control_style_options(ModelRc::new(VecModel::from(options)));

    let weak = app.as_weak();
    app.on_set_page_control_style(move |style| {
        let requested = PageControlStyle::from_int(style);
        let resolved = resolve_style(StyleResolution { requested, catalog: &BUILD_STYLES })
            .expect("at least one BUILD_STYLES entry must set included: true");
        if resolved != requested {
            if let Some(app) = weak.upgrade() {
                app.set_page_control_style(resolved.to_int());
            }
        }
        let mut session = Session::load();
        session.page_control_style = resolved;
        if let Err(error) = session.save() {
            tracing::warn!(%error, "page-control style save failed");
        }
    });
}

/// Verifies catalog filtering and disabled-style resolution.
#[cfg(test)]
#[path = "ui_page_style_tests.rs"]
mod tests;
