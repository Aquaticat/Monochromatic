// What:     Unit tests for `theme_roles.rs`, pulled in by `#[cfg(test)] #[path = "theme_roles_tests.rs"] mod tests;`.
// Why:      The derivation promises AA contrast and in-range colors for ANY accent, so it is swept over hues every
//           10 degrees and a range of chromas in both schemes, and the baseline root is compared to the old fixed values.

use super::*;
use crate::oklch::{Oklch, delta_e_ok, is_in_gamut, oklch_to_linear, oklch_to_srgb8, srgb_to_oklch};

/// Hex shorthand for the expected values.
fn hex(value: u32) -> Srgb8 {
    return Srgb8 { red: ((value >> 16) & 0xFF) as u8, green: ((value >> 8) & 0xFF) as u8, blue: (value & 0xFF) as u8 };
}

/// What: the fixed values `ui/theme.slint` held before D108, per role, as `(name, dark, light)`.
/// Why:  the baseline root must reproduce them closely (the old captures are the visual reference).
fn old_fixed_values() -> Vec<(&'static str, u32, u32)> {
    return vec![
        ("canvas", 0x000000, 0xFFFFFF),
        ("deck", 0x0A0A0D, 0xF4F3FA),
        ("current-row", 0x121318, 0xF4F3FA),
        ("seam", 0x000000, 0xB0B1BC),
        ("on-surface", 0xE4E5F0, 0x30323B),
        ("on-surface-variant", 0xC5C6D0, 0x5C5E6A),
        ("outline", 0x8E9099, 0x757780),
        ("outline-variant", 0x44464F, 0xC5C6D0),
        ("primary", 0xBAC5EE, 0x4E5E8B),
        ("on-primary", 0x1F2D52, 0xFFFFFF),
        ("secondary-container", 0x353B4D, 0xDDE2F9),
        ("on-secondary-container", 0xDDE2F9, 0x161B2C),
        ("surface-high", 0x1E1F25, 0xE8E7EE),
        ("settings-page", 0x181920, 0xEEEDF6),
        ("settings-card", 0x2A2C34, 0xFAF8FE),
        ("back-tonal", 0x23252E, 0xE1E2ED),
        ("error", 0xFFB4AB, 0xBA1A1A),
        ("error-container", 0x8C1D18, 0xF9DEDC),
        ("on-error-container", 0xF9DEDC, 0x410E0B),
    ];
}

/// What: `named_roles(set)` lists every role of one scheme by its theme name.
/// Why:  lets a test walk all roles without repeating the field list.
fn named_roles(set: &RoleSet) -> Vec<(&'static str, Srgb8)> {
    return vec![
        ("canvas", set.canvas),
        ("deck", set.deck),
        ("current-row", set.current_row),
        ("seam", set.seam),
        ("surface-high", set.surface_high),
        ("settings-page", set.settings_page),
        ("settings-card", set.settings_card),
        ("back-tonal", set.back_tonal),
        ("on-surface", set.on_surface),
        ("on-surface-variant", set.on_surface_variant),
        ("outline", set.outline),
        ("outline-variant", set.outline_variant),
        ("primary", set.primary),
        ("on-primary", set.on_primary),
        ("secondary-container", set.secondary_container),
        ("secondary-container-hovered", set.secondary_container_hovered),
        ("secondary-container-pressed", set.secondary_container_pressed),
        ("on-secondary-container", set.on_secondary_container),
        ("match-fill", set.match_fill),
        ("error", set.error),
        ("error-container", set.error_container),
        ("on-error-container", set.on_error_container),
    ];
}

/// What: `lookup(set, name)` returns the role called `name`.
fn lookup(set: &RoleSet, name: &str) -> Srgb8 {
    for (role_name, color) in named_roles(set) {
        if role_name == name {
            return color;
        }
    }
    panic!("no role named {name}");
}

/// What: `swept_roots()` is every test root: hues every 10 degrees by a spread of chromas, plus grays and the
/// extremes (saturated red, yellow, green, blue, white, black).
/// Why:  the contrast guarantee must hold for any accent, including ones whose chroma the gamut cuts hard.
fn swept_roots() -> Vec<Srgb8> {
    let mut roots: Vec<Srgb8> = Vec::new();
    let mut hue: f64 = 0.0;
    while hue < 360.0 {
        for lightness in [0.3, 0.55, 0.8, 0.95] {
            for chroma in [0.0, 0.01, 0.03, 0.06, 0.1, 0.15, 0.2, 0.3] {
                roots.push(oklch_to_srgb8(Oklch { lightness, chroma, hue }));
            }
        }
        hue += 10.0;
    }
    for value in [0xFF0000, 0xFFD000, 0xFFFF00, 0x00FF00, 0x0000FF, 0x6060C0, 0x000000, 0xFFFFFF, 0x808080, 0x7F7F80] {
        roots.push(hex(value));
    }
    return roots;
}

/// What: `surfaces_of(set)` lists the seven surfaces text is drawn on.
fn surfaces_of(set: &RoleSet) -> Vec<Srgb8> {
    return vec![set.canvas, set.deck, set.current_row, set.surface_high, set.settings_page, set.settings_card, set.back_tonal];
}

/// What: `assert_text_contrast(label, foreground, background, minimum)` fails with the names in the message.
fn assert_ratio(label: &str, foreground: Srgb8, background: Srgb8, minimum: f64) {
    let ratio: f64 = contrast_ratio(foreground, background);
    assert!(ratio >= minimum, "{label}: {foreground:?} on {background:?} is {ratio:.3}, below {minimum}");
}

/// What: `check_scheme_contrast(label, set)` asserts every text pair of one scheme at AA (4.5, 3 for outlines).
fn check_scheme_contrast(label: &str, set: &RoleSet) {
    let surfaces: Vec<Srgb8> = surfaces_of(set);
    for surface in &surfaces {
        assert_ratio(&format!("{label} on-surface"), set.on_surface, *surface, 4.5);
        let pressed: Srgb8 = composite_over(set.on_surface, PRESSED_ALPHA, *surface);
        assert_ratio(&format!("{label} on-surface pressed"), set.on_surface, pressed, 4.5);
    }
    // Secondary and accent text sit on the six surfaces that carry text (the Back button fill carries an icon only),
    // at rest and under the hover layer. The pressed layer lasts only while the button is held.
    for surface in &surfaces[..6] {
        let hovered: Srgb8 = composite_over(set.on_surface, HOVER_ALPHA, *surface);
        assert_ratio(&format!("{label} on-surface-variant"), set.on_surface_variant, *surface, 4.5);
        assert_ratio(&format!("{label} on-surface-variant hovered"), set.on_surface_variant, hovered, 4.5);
        assert_ratio(&format!("{label} primary text"), set.primary, *surface, 4.5);
        assert_ratio(&format!("{label} primary hovered"), set.primary, hovered, 4.5);
    }
    for fill in [set.secondary_container, set.secondary_container_hovered, set.secondary_container_pressed] {
        assert_ratio(&format!("{label} on-secondary-container"), set.on_secondary_container, fill, 4.5);
    }
    // Primary text on the selected fill (the rail letter), at rest.
    assert_ratio(&format!("{label} primary on the selected fill"), set.primary, set.secondary_container, 4.5);
    assert_ratio(&format!("{label} on-primary"), set.on_primary, set.primary, 4.5);
    let primary_pressed: Srgb8 = composite_over(set.on_primary, PRESSED_ALPHA, set.primary);
    assert_ratio(&format!("{label} on-primary pressed"), set.on_primary, primary_pressed, 4.5);
    assert_ratio(&format!("{label} on-surface on the match fill"), set.on_surface, set.match_fill, 4.5);
    assert_ratio(&format!("{label} on-surface-variant on the match fill"), set.on_surface_variant, set.match_fill, 4.5);
    assert_ratio(&format!("{label} outline on the canvas"), set.outline, set.canvas, 3.0);
    assert_ratio(&format!("{label} outline on the deck"), set.outline, set.deck, 3.0);
    // The fixed error pairs hold too, so the guarantee covers every text pair in the window.
    assert_ratio(&format!("{label} on-error-container"), set.on_error_container, set.error_container, 4.5);
    assert_ratio(&format!("{label} error on the container"), set.error, set.error_container, 3.0);
    assert_ratio(&format!("{label} error text on the canvas"), set.error, set.canvas, 4.5);
}

#[test]
fn every_swept_root_keeps_aa_contrast_in_both_schemes() {
    let roots: Vec<Srgb8> = swept_roots();
    assert!(roots.len() > 1000, "the sweep is too small: {}", roots.len());
    for root in roots {
        let palette: ThemePalette = derive_roles(Some(root));
        check_scheme_contrast(&format!("dark root {root:?}"), &palette.dark);
        check_scheme_contrast(&format!("light root {root:?}"), &palette.light);
    }
}

#[test]
fn the_baseline_needs_no_contrast_adjustment() {
    // With the baseline root the targets alone pass, so the fit never moved lightness: every role is the plain
    // resolution of its table row.
    let terms: RootTerms = root_terms(None);
    for (scheme, spec) in [(Scheme::Dark, DARK_SPEC), (Scheme::Light, LIGHT_SPEC)] {
        let set: RoleSet = derive_scheme(terms, scheme);
        assert_eq!(set.primary, resolve_srgb(spec.primary, terms), "{scheme:?} primary moved");
        assert_eq!(set.on_surface, resolve_srgb(spec.on_surface, terms), "{scheme:?} on-surface moved");
        assert_eq!(set.on_surface_variant, resolve_srgb(spec.on_surface_variant, terms), "{scheme:?} variant moved");
        assert_eq!(set.outline, resolve_srgb(spec.outline, terms), "{scheme:?} outline moved");
        assert_eq!(set.on_primary, resolve_srgb(spec.on_primary, terms), "{scheme:?} on-primary moved");
        assert_eq!(
            set.on_secondary_container,
            resolve_srgb(spec.on_secondary_container, terms),
            "{scheme:?} on-secondary-container moved"
        );
    }
}

#[test]
fn the_fit_moves_lightness_when_a_target_fails_a_positive_control() {
    // A start that fails 4.5 on white must come back darker and passing, proving `fit_lightness` can act.
    let white: Srgb8 = hex(0xFFFFFF);
    let start: Oklch = Oklch { lightness: 0.85, chroma: 0.05, hue: 250.0 };
    let fitted: Oklch = fit_lightness("control", start, 0.0, &|candidate| {
        return contrast_ratio(candidate, white) >= 4.6;
    });
    assert!(fitted.lightness < start.lightness);
    assert_eq!(fitted.hue, start.hue);
    assert!(contrast_ratio(oklch_to_srgb8(fitted), white) >= 4.6);
}

#[test]
fn the_fit_returns_the_endpoint_when_nothing_can_pass() {
    let start: Oklch = Oklch { lightness: 0.5, chroma: 0.0, hue: 0.0 };
    let fitted: Oklch = fit_lightness("impossible", start, 0.0, &|_candidate| {
        return false;
    });
    assert_eq!(fitted.lightness, 0.0);
}

#[test]
fn no_accent_and_the_baseline_color_derive_the_same_palette() {
    assert_eq!(derive_roles(None), derive_roles(Some(BASELINE_ROOT)));
}

#[test]
fn the_baseline_stays_close_to_the_old_fixed_values() {
    // ΔE (OKLab times 100): about 1 is a just-noticeable difference. The measured maximum is 0 (the table is fitted to the captures); the bound
    // leaves room for a deliberate small retune and fails on a real drift.
    let palette: ThemePalette = derive_roles(None);
    let mut largest: f64 = 0.0;
    let mut largest_name: String = String::new();
    for (name, dark, light) in old_fixed_values() {
        for (scheme_name, set, old) in [("dark", &palette.dark, dark), ("light", &palette.light, light)] {
            let delta: f64 = delta_e_ok(lookup(set, name), hex(old));
            if delta > largest {
                largest = delta;
                largest_name = format!("{scheme_name} {name}");
            }
        }
    }
    println!("largest baseline delta-E vs the old fixed values: {largest:.3} ({largest_name})");
    assert!(largest < 0.5, "baseline drifted: {largest:.3} at {largest_name}");
}

#[test]
fn fixed_roles_do_not_follow_the_accent() {
    for root in swept_roots() {
        let palette: ThemePalette = derive_roles(Some(root));
        assert_eq!(palette.dark.canvas, hex(0x000000), "D41 black canvas under {root:?}");
        assert_eq!(palette.dark.deck, hex(0x0A0A0D), "D41 deck under {root:?}");
        assert_eq!(palette.dark.seam, hex(0x000000));
        assert_eq!(palette.light.canvas, hex(0xFFFFFF), "D34 white canvas under {root:?}");
        assert_eq!(palette.light.on_primary, hex(0xFFFFFF), "white on-primary under {root:?}");
        assert_eq!(palette.dark.error, hex(0xFFB4AB));
        assert_eq!(palette.light.error_container, hex(0xF9DEDC));
    }
}

#[test]
fn accent_roles_keep_the_root_hue_instead_of_clipping() {
    // Roles with enough chroma keep root hue plus their offset within 4 degrees. 8-bit rounding limits the
    // hue accuracy of low-chroma roles, and clipping instead of chroma reduction would blow far past 4.
    let mut checked: usize = 0;
    let mut hue: f64 = 0.0;
    while hue < 360.0 {
        let root: Srgb8 = oklch_to_srgb8(Oklch { lightness: 0.6, chroma: 0.15, hue });
        let root_hue: f64 = srgb_to_oklch(root).hue;
        let palette: ThemePalette = derive_roles(Some(root));
        for (set, spec) in [(&palette.dark, DARK_SPEC), (&palette.light, LIGHT_SPEC)] {
            let terms: RootTerms = root_terms(Some(root));
            for (name, color, role) in [
                ("secondary-container", set.secondary_container, spec.secondary_container),
                ("primary", set.primary, spec.primary),
            ] {
                let lch: Oklch = srgb_to_oklch(color);
                if lch.chroma < 0.03 {
                    continue;
                }
                let spec_hue_offset: f64 = match role {
                    Role::Accent(role_spec) | Role::Neutral(role_spec) => role_spec.hue_offset,
                    Role::Fixed(_) => 0.0,
                };
                let expected: f64 = (terms.hue + spec_hue_offset).rem_euclid(360.0);
                let difference: f64 = (lch.hue - expected + 540.0).rem_euclid(360.0) - 180.0;
                assert!(difference.abs() < 4.0, "{name} hue {} vs {expected} for root hue {root_hue}", lch.hue);
                checked += 1;
            }
        }
        hue += 10.0;
    }
    assert!(checked > 40, "the hue check ran on only {checked} roles");
}

#[test]
fn derived_targets_before_quantizing_are_inside_the_gamut_after_mapping() {
    let terms: RootTerms = root_terms(Some(hex(0xFFD000)));
    for spec in [DARK_SPEC, LIGHT_SPEC] {
        for role in [spec.primary, spec.secondary_container, spec.on_primary, spec.on_secondary_container] {
            let mapped: Oklch = crate::oklch::gamut_map(resolve_oklch(role, terms));
            assert!(is_in_gamut(mapped));
            for channel in oklch_to_linear(mapped) {
                assert!((-1e-6..=1.0 + 1e-6).contains(&channel), "channel {channel}");
            }
        }
    }
}

#[test]
fn a_vivid_root_does_not_tint_the_neutral_surfaces_beyond_the_baseline() {
    let baseline: ThemePalette = derive_roles(None);
    let vivid: ThemePalette = derive_roles(Some(hex(0xFF0000)));
    // Chroma of the settings card under a saturated red root is the baseline's, only the hue differs.
    let baseline_chroma: f64 = srgb_to_oklch(baseline.dark.settings_card).chroma;
    let vivid_chroma: f64 = srgb_to_oklch(vivid.dark.settings_card).chroma;
    assert!((vivid_chroma - baseline_chroma).abs() < 0.004, "{vivid_chroma} vs {baseline_chroma}");
}

#[test]
fn a_gray_root_yields_gray_roles_and_the_baseline_hue_is_the_defined_fallback() {
    let gray: Srgb8 = hex(0x808080);
    let terms: RootTerms = root_terms(Some(gray));
    assert_eq!(terms.hue, srgb_to_oklch(BASELINE_ROOT).hue);
    assert!(terms.scale < 0.01);
    let palette: ThemePalette = derive_roles(Some(gray));
    for set in [&palette.dark, &palette.light] {
        for (name, color) in named_roles(set) {
            // The error roles are semantic constants and the dark deck is the fixed D41 neutral #0A0A0D.
            if name.starts_with("error") || name.ends_with("error-container") || (name == "deck" && set == &palette.dark) {
                continue;
            }
            let spread: u8 = color.red.max(color.green).max(color.blue) - color.red.min(color.green).min(color.blue);
            assert!(spread <= 2, "{name} {color:?} is not gray");
        }
    }
}

#[test]
fn a_more_vivid_accent_gives_a_more_vivid_primary_up_to_the_cap() {
    let muted: f64 = srgb_to_oklch(derive_roles(Some(hex(0x7A7F9A))).dark.primary).chroma;
    let vivid: f64 = srgb_to_oklch(derive_roles(Some(hex(0x6060C0))).dark.primary).chroma;
    assert!(vivid > muted, "{vivid} vs {muted}");
    // Past the cap a more vivid root changes nothing: a neon blue and a saturated red share one scale.
    let cap_scale: f64 = ROOT_CHROMA_CAP / srgb_to_oklch(BASELINE_ROOT).chroma;
    assert!((root_terms(Some(hex(0x4000FF))).scale - cap_scale).abs() < 1e-12);
    assert!((root_terms(Some(hex(0xFF0000))).scale - cap_scale).abs() < 1e-12);
}

#[test]
fn the_selected_fill_layers_step_toward_the_content_color() {
    for root in [None, Some(hex(0x6060C0))] {
        let palette: ThemePalette = derive_roles(root);
        for set in [&palette.dark, &palette.light] {
            let base: Oklch = srgb_to_oklch(set.secondary_container);
            let content: Oklch = srgb_to_oklch(set.on_secondary_container);
            let hovered: Oklch = srgb_to_oklch(set.secondary_container_hovered);
            let pressed: Oklch = srgb_to_oklch(set.secondary_container_pressed);
            let toward: f64 = (content.lightness - base.lightness).signum();
            assert!((hovered.lightness - base.lightness) * toward > 0.0, "hover does not move toward the content");
            assert!((pressed.lightness - hovered.lightness) * toward > 0.0, "pressed is not past hover");
        }
    }
}

#[test]
fn the_match_fill_is_darker_than_primary_in_dark_and_lighter_in_light() {
    let palette: ThemePalette = derive_roles(Some(hex(0x6060C0)));
    assert!(srgb_to_oklch(palette.dark.match_fill).lightness < srgb_to_oklch(palette.dark.primary).lightness);
    assert!(srgb_to_oklch(palette.light.match_fill).lightness > srgb_to_oklch(palette.light.primary).lightness);
}

#[test]
fn the_new_derived_roles_stay_near_what_the_old_srgb_layering_showed() {
    // Old look: the selected segment's hover and pressed fills were the container blended in sRGB with its content
    // color at 8 and 12 percent, and the match fill was the primary at 30 percent alpha over the row. These roles are
    // now OKLCH-derived (D108); the distance to the old rendering is measured here and bounded, and printed for the
    // report. The match fill is a deliberate change that mirrors Android's `searchMatchFill` (A3, D59).
    let palette: ThemePalette = derive_roles(None);
    let mut segment_largest: f64 = 0.0;
    let mut match_largest: f64 = 0.0;
    for (label, set) in [("dark", &palette.dark), ("light", &palette.light)] {
        let hovered_old: Srgb8 = composite_over(set.on_secondary_container, HOVER_ALPHA, set.secondary_container);
        let pressed_old: Srgb8 = composite_over(set.on_secondary_container, PRESSED_ALPHA, set.secondary_container);
        let hovered_delta: f64 = delta_e_ok(set.secondary_container_hovered, hovered_old);
        let pressed_delta: f64 = delta_e_ok(set.secondary_container_pressed, pressed_old);
        let over_canvas: Srgb8 = composite_over(set.primary, 0.3, set.canvas);
        let over_row: Srgb8 = composite_over(set.primary, 0.3, set.current_row);
        let canvas_delta: f64 = delta_e_ok(set.match_fill, over_canvas);
        let row_delta: f64 = delta_e_ok(set.match_fill, over_row);
        println!(
            "{label}: segment hover {hovered_delta:.2}, pressed {pressed_delta:.2}; match fill vs old over canvas {canvas_delta:.2}, over row {row_delta:.2}"
        );
        segment_largest = segment_largest.max(hovered_delta).max(pressed_delta);
        match_largest = match_largest.max(canvas_delta).max(row_delta);
    }
    assert!(segment_largest < 1.5, "segment layers drifted from the old look by {segment_largest:.2}");
    assert!(match_largest < 12.0, "match fill drifted from the old look by {match_largest:.2}");
}

#[test]
fn every_swept_root_keeps_accent_roles_in_gamut_with_the_hue_kept_not_clipped() {
    // Chroma reduction keeps the hue (a clip would shift it), so wherever a target keeps enough chroma its hue must
    // equal root hue plus the role's offset. Run over the whole sweep, both schemes, every table role.
    let mut checked: usize = 0;
    for root in swept_roots() {
        let terms: RootTerms = root_terms(Some(root));
        for spec in [DARK_SPEC, LIGHT_SPEC] {
            for role in [
                spec.current_row, spec.surface_high, spec.settings_page, spec.settings_card, spec.back_tonal, spec.on_surface,
                spec.on_surface_variant, spec.outline, spec.outline_variant, spec.primary, spec.on_primary,
                spec.secondary_container, spec.on_secondary_container, spec.deck, spec.seam,
            ] {
                let wanted: Oklch = resolve_oklch(role, terms);
                let mapped: Oklch = crate::oklch::gamut_map(wanted);
                assert!(is_in_gamut(mapped), "{wanted:?} for root {root:?} maps outside sRGB");
                assert_eq!(mapped.lightness, wanted.lightness);
                assert_eq!(mapped.hue, wanted.hue);
                let quantized: Oklch = srgb_to_oklch(oklch_to_srgb8(wanted));
                if mapped.chroma >= 0.03 && wanted.lightness > 0.1 && wanted.lightness < 0.97 {
                    let difference: f64 = (quantized.hue - wanted.hue + 540.0).rem_euclid(360.0) - 180.0;
                    assert!(difference.abs() < 4.0, "hue {} vs {} for {wanted:?}, root {root:?}", quantized.hue, wanted.hue);
                    checked += 1;
                }
            }
        }
    }
    assert!(checked > 1000, "the hue check ran on only {checked} roles");
}
