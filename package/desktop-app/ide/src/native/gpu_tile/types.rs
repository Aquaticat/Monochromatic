//! The small types the code view and the minimap share on the GPU:
//!  a texture with its size,
//!  the pictures that have one,
//!  where the minimap's slice stands,
//!  and what a step of the notifier changed for the window.

/// The window the outcome is applied to.
use crate::native::AppWindow;
/// The image import.
use slint::Image;
/// Slint's own wgpu types.
use slint::wgpu_30::wgpu;

/// What:
///  One texture and the size it was made with.
/// Why:
///  A texture is reused while the scene it receives has the same size,
///  and replaced,
/// with a new image on the window,
/// when it has not.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Target = { texture: GPUTexture; width: number; height: number };
/// ```
pub(super) struct Target {
    /// The texture Vello renders into and Slint samples.
    pub(super) texture: wgpu::Texture,
    /// Width in physical pixels.
    pub(super) width: u32,
    /// Height in physical pixels.
    pub(super) height: u32,
}

/// The pictures the GPU draws for the window.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Picture {
    /// The source tile.
    Tile,
    /// The gutter's wrap indicator.
    Sign,
    /// The minimap's slice of the picture of the whole text.
    Minimap,
}

/// Where a picture's texture is kept.
impl Picture {
    /// The place of this picture's texture among the targets.
    pub(super) fn slot(self) -> usize {
        return match self {
            Self::Tile => 0,
            Self::Sign => 1,
            Self::Minimap => 2,
        };
    }
}

/// What:
///  Where the minimap's texture stands in the whole picture:
///  its size and its first row.
/// Why:
///  The window places the image with these numbers in the same step that shows the texture,
///  so a new slice never appears at the old slice's place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Placement = { width: number; height: number; top: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Placement {
    /// Width of the texture in physical pixels.
    pub(super) width: u32,
    /// Height of the texture in physical pixels.
    pub(super) height: u32,
    /// The row of the whole picture the texture's first row is.
    pub(super) top: u32,
}

/// What:
///  What a step of the notifier changed for the window:
///  new images to show and messages to display.
/// Why:
///  The window's setters run after the shared state is released,
///  so a setter that reaches back into the application cannot find it borrowed.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Outcome = { images: [Picture, Image][]; minimap?: Placement; errors: string[] };
/// ```
#[derive(Default)]
pub(super) struct Outcome {
    /// Pictures that have a new texture to show.
    pub(super) images: Vec<(Picture, Image)>,
    /// Where the minimap's slice stands,
    /// when one was drawn.
    pub(super) minimap: Option<Placement>,
    /// Failures to show as the window's error.
    pub(super) errors: Vec<String>,
}

/// Show what a step changed.
impl Outcome {
    /// Set the images and the last error on `window`.
    pub(super) fn apply(self, window: &AppWindow) {
        for (picture, image) in self.images {
            match picture {
                Picture::Tile => window.set_source_image(image),
                Picture::Sign => window.set_wrap_sign(image),
                Picture::Minimap => window.set_minimap_image(image),
            }
        }
        if let Some(place) = self.minimap {
            window.set_minimap_picture_width(place.width as f32);
            window.set_minimap_picture_height(place.height as f32);
            window.set_minimap_picture_top(place.top as f32);
        }
        if let Some(message) = self.errors.last() {
            window.set_error_message(slint::SharedString::from(message.as_str()));
        }
    }
}
