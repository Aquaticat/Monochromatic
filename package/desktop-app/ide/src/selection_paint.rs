//! Clip selected foreground at character geometry, even when one glyph spans several characters.

/// Return the portion of a physical pixel covered by non-overlapping selection intervals.
/// Fractional origins retain coverage instead of snapping source during smooth scrolling.
pub(crate) fn coverage(x: i32, intervals: &[(f32, f32)]) -> f32 {
    let left = x as f32;
    let right = left + 1.0;
    let mut covered = 0.0;
    // What: & borrows each endpoint pair without moving the interval list.
    // Why: Every glyph pixel uses the same geometry as the visible selection background.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const [start, end] of intervals) covered += overlap(pixel, [start, end]);
    // ```
    for &(start, end) in intervals {
        covered += (right.min(end) - left.max(start)).max(0.0);
    }
    return covered.min(1.0);
}

/// Apply glyph coverage to straight color while preserving the existing integer rounding.
fn masked(mut color: [u8; 4], alpha: u8) -> [u8; 4] {
    color[3] = ((u32::from(color[3]) * u32::from(alpha) + 127) / 255) as u8;
    return color;
}

/// Blend foregrounds by clipped pixel area, not by the first character's glyph brush.
/// Alpha-weighted color interpolation keeps partially transparent theme colors coherent.
pub(crate) fn ink(ordinary: [u8; 4], selected: [u8; 4], coverage: f32, mask: u8) -> [u8; 4] {
    if coverage <= 0.0 { return masked(ordinary, mask); }
    if coverage >= 1.0 { return masked(selected, mask); }
    let ordinary_alpha = f32::from(ordinary[3]) * (1.0 - coverage);
    let selected_alpha = f32::from(selected[3]) * coverage;
    let alpha = ordinary_alpha + selected_alpha;
    if alpha == 0.0 { return [0; 4]; }
    let mut color = [0, 0, 0, (alpha * f32::from(mask) / 255.0).round() as u8];
    for channel in 0..3 {
        color[channel] = ((f32::from(ordinary[channel]) * ordinary_alpha
            + f32::from(selected[channel]) * selected_alpha) / alpha).round() as u8;
    }
    return color;
}
