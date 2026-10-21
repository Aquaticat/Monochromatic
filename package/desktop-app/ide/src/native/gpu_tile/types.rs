//! The small types the code view and the minimap share on the GPU:
//!  a texture with its size,
//!  the pictures that have one,
//!  where the minimap's textures stand,
//!  and what a step of the notifier changed for the window.

/// The window the outcome is applied to,
/// and the markup's record of one texture of the minimap.
use crate::native::{AppWindow, ui::MinimapSlice};
/// The image import,
/// and the shared list the window shows the minimap's textures from.
use slint::{Image, ModelRc, VecModel};
/// The list is shared with the window.
use std::rc::Rc;
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

/// The pictures the GPU draws for the window into one texture each.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Picture {
    /// The source tile.
    Tile,
    /// The gutter's wrap indicator.
    Sign,
}

/// Where a picture's texture is kept.
impl Picture {
    /// The place of this picture's texture among the targets.
    pub(super) fn slot(self) -> usize {
        return match self {
            Self::Tile => 0,
            Self::Sign => 1,
        };
    }
}

/// What:
///  One texture of the minimap's picture:
///  the texture,
///  and the image that shows it.
/// Why:
///  A picture taller than the device's texture limit is several of these.
///  The image is kept so a texture that is drawn into again is shown without a new image.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type MinimapTexture = { target: Target; image: Image };
/// ```
pub(super) struct MinimapTexture {
    /// The texture and its size.
    pub(super) target: Target,
    /// The image that shows the texture.
    pub(super) image: Image,
}

/// What:
///  Where the minimap's picture stands in the whole picture:
///  its width,
///  its first row,
///  and the textures that stack to make it.
/// Why:
///  The window places the images with these numbers in the same step that shows the textures,
///  so a new picture never appears at the old picture's place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Placement = { width: number; top: number; slices: { image: Image; top: number; height: number }[] };
/// ```
pub(super) struct Placement {
    /// Width of every texture in physical pixels.
    pub(super) width: u32,
    /// The row of the whole picture the first texture's first row is.
    pub(super) top: u32,
    /// The textures from the top,
    /// each starting on the row where the one before ends.
    pub(super) slices: Vec<MinimapSlice>,
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
    /// Where the minimap's textures stand,
    /// when a picture was drawn.
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
            }
        }
        if let Some(place) = self.minimap {
            let height: f32 = place.slices.iter().map(|slice| return slice.height).sum();
            window.set_minimap_slices(ModelRc::from(Rc::new(VecModel::from(place.slices))));
            window.set_minimap_picture_width(place.width as f32);
            window.set_minimap_picture_height(height);
            window.set_minimap_picture_top(place.top as f32);
        }
        if let Some(message) = self.errors.last() {
            window.set_error_message(slint::SharedString::from(message.as_str()));
        }
    }
}
