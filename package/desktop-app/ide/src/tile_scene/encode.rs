//! Paint items to a Vello scene:
//!  the one place a scene is written.

/// The items to write.
use super::Item;
/// Vello's scene,
/// shapes,
/// and brushes.
use vello::{
    Scene,
    kurbo::{Affine, Cap, Join, Rect, Stroke},
    peniko::{Color, Fill},
};

/// What:
///  A straight-alpha brush color from four bytes.
/// Why:
///  Inks are straight RGBA bytes everywhere in the application,
///  and Vello's transparent output is straight alpha too.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function brush([red, green, blue, alpha]: Rgba): Color;
/// ```
fn brush(ink: [u8; 4]) -> Color {
    return Color::from_rgba8(ink[0], ink[1], ink[2], ink[3]);
}

/// What:
///  Write `items` to a new scene for a texture `height` pixels tall.
///  A clip item clips to its two x positions and the texture's full height.
/// Why:
///  The window thread and the tile worker both end a build here,
///  so the scene of a tile does not depend on which of them built it.
///  Glyphs are drawn unhinted at their fractional positions,
/// as the layout placed them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function encode(items: Item[], height: number): Scene;
/// ```
pub fn encode(items: &[Item], height: f32) -> Scene {
    let mut scene = Scene::new();
    for item in items {
        match item {
            Item::Glyphs(run) => {
                scene
                    .draw_glyphs(&run.font)
                    .font_size(run.size)
                    .transform(Affine::translate((
                        f64::from(run.origin.0),
                        f64::from(run.origin.1),
                    )))
                    .normalized_coords(&run.coords)
                    .hint(false)
                    .brush(brush(run.ink))
                    .draw(Fill::NonZero, run.glyphs.iter().copied());
            }
            Item::Clip { left, right } => {
                scene.push_clip_layer(
                    Fill::NonZero,
                    Affine::IDENTITY,
                    &Rect::new(f64::from(*left), 0.0, f64::from(*right), f64::from(height)),
                );
            }
            Item::Unclip => scene.pop_layer(),
            Item::Fill {
                left,
                top,
                right,
                bottom,
                ink,
            } => {
                scene.fill(
                    Fill::NonZero,
                    Affine::IDENTITY,
                    brush(*ink),
                    None,
                    &Rect::new(
                        f64::from(*left),
                        f64::from(*top),
                        f64::from(*right),
                        f64::from(*bottom),
                    ),
                );
            }
            Item::Stroke(line) => {
                let mut style = Stroke::new(f64::from(line.width));
                if line.round {
                    style = style.with_caps(Cap::Round).with_join(Join::Round);
                } else {
                    style = style.with_caps(Cap::Butt).with_join(Join::Miter);
                }
                if !line.dash.is_empty() {
                    style = style.with_dashes(0.0, line.dash.iter().copied());
                }
                scene.stroke(&style, Affine::IDENTITY, brush(line.ink), None, &line.path);
            }
        }
    }
    return scene;
}
