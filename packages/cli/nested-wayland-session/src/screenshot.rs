//! Screenshot capture: render one frame and read the framebuffer back as a PNG.
//!
//! This runs on the main (GL-context) thread. It binds the winit framebuffer, composites
//! the current frame into it, copies the framebuffer to CPU memory with the renderer's
//! `ExportMem` primitive, and encodes the pixels as a PNG with the `image` crate.

// What:     `use std::path::Path;`. Borrowed filesystem path.
// Why:      `capture` writes to a caller-provided path.
use std::path::Path;

// What:     Grouped `use` of the dmabuf `Fourcc` format tag, the render-element and
//           renderer types, the `ExportMem` readback trait, `render_output`, and the
//           `Rectangle` geometry.
// Why:      Everything `capture` references. `ExportMem` is the trait that adds
//           `copy_framebuffer` / `map_texture` to the renderer.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Fourcc, WaylandSurfaceRenderElement, GlesRenderer, ExportMem, renderOutput, Rectangle } from "smithay";
// ```
use smithay::{
    backend::{
        allocator::Fourcc,
        renderer::{element::surface::WaylandSurfaceRenderElement, gles::GlesRenderer, ExportMem},
    },
    desktop::space::render_output,
    utils::{Buffer, Rectangle},
};

// What:     `use anyhow::{Context, Result};`. Error helpers.
// Why:      `capture` returns `Result` and annotates each fallible step.
use anyhow::{Context, Result};

// What:     `use crate::{render::CLEAR_COLOR, state::Compositor};`. Reuse the shared clear
//           colour and operate on the state.
// Why:      Screenshots composite with the same background as the live frame.
//
// In TS you'd write (pseudocode):
// ```ts
// import { CLEAR_COLOR } from "./render";
// import { Compositor } from "./state";
// ```
use crate::{render::CLEAR_COLOR, state::Compositor};

/// Number of bytes per pixel in the read-back `Abgr8888` framebuffer.
///
/// What:     `const BYTES_PER_PIXEL: usize = 4;`. `usize` because it multiplies a pixel
///           count to a byte count for the length check.
/// Why:      Named so the size sanity check reads clearly.
const BYTES_PER_PIXEL: usize = 4;

/// Render the current frame and write it to `path` as a PNG.
///
/// What:     `pub fn capture(state: &mut Compositor, path: &Path) -> Result<()>`. Mutably
///           borrows the state (rendering + readback need `&mut` on the backend), reads
///           the destination path.
/// Why:      The `screenshot` control command's implementation.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function capture(state, path): void { ... }
/// ```
///
/// @example
/// ```ts
/// capture(state, "/tmp/frame.png");
/// ```
pub fn capture(state: &mut Compositor, path: &Path) -> Result<()> {
    // What:     `let size = state.backend.window_size();`. Framebuffer size
    //           (`Size<i32, Physical>`).
    // Why:      Sets the readback region and the output image dimensions.
    let size = state.backend.window_size();

    // What:     `let width = size.w as u32; let height = size.h as u32;`. Cast the signed
    //           dimensions to the unsigned type the `image` crate wants.
    // Why:      `RgbaImage::from_raw` takes `u32` width/height.
    let width = size.w as u32;
    let height = size.h as u32;

    // What:     `let pixels = { ... };`. A block whose value is the owned pixel bytes. The
    //           render borrows live only inside this block.
    // Why:      Release the backend/renderer borrows before encoding + writing the file.
    let pixels = {
        // What:     `let (renderer, mut framebuffer) = state.backend.bind().map_err(...)?;`.
        //           Bind the framebuffer for drawing; convert a bind error to `anyhow`.
        // Why:      Need the renderer and target to draw and then read back.
        let (renderer, mut framebuffer) = state
            .backend
            .bind()
            .map_err(|err| anyhow::anyhow!("binding the framebuffer for screenshot failed: {err:?}"))?;

        // What:     `render_output::<_, WaylandSurfaceRenderElement<GlesRenderer>, _, _>(...)
        //           .map_err(...)?;`. Composite the current frame so the readback captures
        //           what would be shown. Same arguments as the live `redraw`.
        // Why:      A screenshot should reflect the latest committed client content.
        render_output::<_, WaylandSurfaceRenderElement<GlesRenderer>, _, _>(
            &state.output,
            renderer,
            &mut framebuffer,
            1.0,
            0,
            [&state.space],
            &[],
            &mut state.damage_tracker,
            CLEAR_COLOR,
        )
        .map_err(|err| anyhow::anyhow!("rendering the frame for screenshot failed: {err:?}"))?;

        // What:     `let region: Rectangle<i32, Buffer> = Rectangle::from_size((size.w,
        //           size.h).into());`. The whole framebuffer, expressed in BUFFER
        //           coordinates (not the `Physical` space `size` is in). `copy_framebuffer`
        //           reads back a buffer-space region, so we rebuild the rectangle with the
        //           `Buffer` coordinate marker from the same pixel dimensions.
        // Why:      Match the exact coordinate space `copy_framebuffer` expects.
        let region: Rectangle<i32, Buffer> = Rectangle::from_size((size.w, size.h).into());

        // What:     `let mapping = renderer.copy_framebuffer(&framebuffer, region,
        //           Fourcc::Abgr8888).map_err(...)?;`. Copy the framebuffer into a CPU-
        //           readable mapping in `Abgr8888` format (memory order R, G, B, A on
        //           little-endian, matching the `image` crate's RGBA).
        // Why:      Move the GPU pixels somewhere we can read them.
        let mapping = renderer
            .copy_framebuffer(&framebuffer, region, Fourcc::Abgr8888)
            .map_err(|err| anyhow::anyhow!("copy_framebuffer failed: {err:?}"))?;

        // What:     `let bytes = renderer.map_texture(&mapping).map_err(...)?;`. Get a
        //           read-only byte slice of the mapping. The slice borrows the renderer.
        // Why:      Access the pixel bytes.
        let bytes = renderer
            .map_texture(&mapping)
            .map_err(|err| anyhow::anyhow!("map_texture failed: {err:?}"))?;

        // What:     `bytes.to_vec()`. Copy the borrowed bytes into an owned `Vec<u8>`
        //           (tail expression of the block).
        // Why:      Own the pixels so the borrows can end before file I/O.
        bytes.to_vec()
    };

    // What:     `let expected = width as usize * height as usize * BYTES_PER_PIXEL;`. The
    //           byte count a tightly packed RGBA image should have.
    // Why:      Guard against an unexpected stride before handing the buffer to `image`.
    let expected = width as usize * height as usize * BYTES_PER_PIXEL;

    // What:     `if pixels.len() != expected { return Err(...); }`. Reject a mismatched
    //           buffer.
    // Why:      `RgbaImage::from_raw` would silently return `None`; a clear error is better.
    if pixels.len() != expected {
        return Err(anyhow::anyhow!(
            "screenshot readback size mismatch: got {} bytes, expected {expected}",
            pixels.len()
        ));
    }

    // What:     `let image = image::RgbaImage::from_raw(width, height, pixels)
    //           .context(...)?;`. Wrap the bytes as an RGBA image; `from_raw` returns
    //           `Option`, and `.context(msg)?` turns `None` into an error.
    // Why:      Build the encodable image.
    let image = image::RgbaImage::from_raw(width, height, pixels)
        .context("constructing the screenshot image from raw pixels failed")?;

    // What:     `let image = image::imageops::flip_vertical(&image);`. Flip rows top-to-
    //           bottom. `glReadPixels` returns the framebuffer bottom-up, so the raw
    //           readback is vertically mirrored relative to the displayed image.
    // Why:      Produce an upright PNG.
    let image = image::imageops::flip_vertical(&image);

    // What:     `image.save(path).with_context(|| format!("writing screenshot to {}",
    //           path.display()))?;`. Encode as PNG (inferred from the extension) and write.
    //           `path.display()` formats the path for the message.
    // Why:      Persist the frame to disk.
    image
        .save(path)
        .with_context(|| format!("writing screenshot to {}", path.display()))?;

    // What:     `Ok(())`. Success (tail expression).
    // Why:      Signal the screenshot was written.
    Ok(())
}
