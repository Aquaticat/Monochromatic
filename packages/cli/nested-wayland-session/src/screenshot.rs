//! Screenshot capture: render one frame and read the framebuffer back as pixels.
//!
//! This runs on the main (GL-context) thread. It binds the winit framebuffer, composites
//! the current frame into it, and copies the framebuffer to CPU memory with the renderer's
//! `ExportMem` primitive. `read_frame` fills a caller-owned buffer (so the 60fps recorder
//! can reuse buffers instead of allocating each frame); `capture` builds on it to write a
//! single PNG. PNG encoding of the raw pixels lives in the `encoder` module, off this
//! thread, so the recorder's per-tick cost stays minimal.

/// What:     `use std::path::Path;`. Borrowed filesystem path.
/// Why:      `capture` writes to a caller-provided path.
use std::path::Path;

/// What:     Grouped `use` of the dmabuf `Fourcc` format tag, the render-element and
///           renderer types, the `ExportMem` readback trait, `render_output`, and the
///           `Rectangle`/`Buffer` geometry.
/// Why:      Everything the readback references. `ExportMem` is the trait that adds
///           `copy_framebuffer` / `map_texture` to the renderer.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Fourcc, WaylandSurfaceRenderElement, GlesRenderer, ExportMem, renderOutput, Rectangle } from "smithay";
/// ```
use smithay::{
    backend::{
        allocator::Fourcc,
        renderer::{element::surface::WaylandSurfaceRenderElement, gles::GlesRenderer, ExportMem},
    },
    desktop::space::render_output,
    utils::{Buffer, Rectangle},
};

/// What:     `use anyhow::{Context, Result};`. Error helpers.
/// Why:      The functions return `Result` and annotate each fallible step.
use anyhow::{Context, Result};

/// What:     `use crate::{encoder, render::CLEAR_COLOR, state::Compositor};`. Reuse the
///           PNG encoder, the shared clear colour, and the state.
/// Why:      Screenshots composite with the same background as the live frame and encode
///           through the same code path as the recorder.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as encoder from "./encoder";
/// import { CLEAR_COLOR } from "./render";
/// import { Compositor } from "./state";
/// ```
use crate::{encoder, render::CLEAR_COLOR, state::Compositor};

/// Number of bytes per pixel in the read-back `Abgr8888` framebuffer.
///
/// What:     `pub const BYTES_PER_PIXEL: usize = 4;`. `usize` because it multiplies a
///           pixel count to a byte count.
/// Why:      Shared by the readback size check and the recorder's buffer sizing.
pub const BYTES_PER_PIXEL: usize = 4;

/// Render the current frame and copy the framebuffer into `buffer` as raw RGBA pixels.
///
/// What:     `pub fn read_frame(state: &mut Compositor, buffer: &mut Vec<u8>) ->
///           Result<(u32, u32)>`. Mutably borrows the state and a caller-owned byte buffer
///           it fills; returns the frame's `(width, height)`. The pixels are bottom-up
///           (as `glReadPixels` returns them) and are NOT flipped here; the encoder flips
///           when writing, keeping this hot path to a bind, a render, and one copy.
/// Why:      The shared readback primitive for both single screenshots and the recorder.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function readFrame(state, buffer: Uint8Array): [number, number] { ... }
/// ```
///
/// @example
/// ```ts
/// const buf = [];
/// const [w, h] = readFrame(state, buf);
/// ```
pub fn read_frame(state: &mut Compositor, buffer: &mut Vec<u8>) -> Result<(u32, u32)> {
    // What:     `let size = state.backend.window_size();`. Framebuffer size.
    // Why:      Sets the readback region and the returned dimensions.
    let size = state.backend.window_size();

    // What:     `let width = size.w as u32; let height = size.h as u32;`. Unsigned dims.
    // Why:      The image dimensions are reported as `u32`.
    let width = size.w as u32;
    let height = size.h as u32;

    // What:     A block scoping the render/readback borrows so they end before returning.
    // Why:      `bind` borrows the backend mutably; release it after copying pixels out.
    {
        // What:     `let (renderer, mut framebuffer) = state.backend.bind().map_err(...)?;`.
        //           Bind the framebuffer for drawing; convert a bind error to `anyhow`.
        // Why:      Need the renderer and target to draw and then read back.
        let (renderer, mut framebuffer) = state
            .backend
            .bind()
            .map_err(|err| anyhow::anyhow!("binding the framebuffer for readback failed: {err:?}"))?;

        // What:     `render_output::<_, WaylandSurfaceRenderElement<GlesRenderer>, _, _>(...)
        //           .map_err(...)?;`. Composite the current committed client content.
        // Why:      The readback should reflect the latest frame.
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
        .map_err(|err| anyhow::anyhow!("rendering the frame for readback failed: {err:?}"))?;

        // What:     `let region: Rectangle<i32, Buffer> = Rectangle::from_size((size.w,
        //           size.h).into());`. The whole framebuffer in BUFFER coordinates.
        // Why:      `copy_framebuffer` reads a buffer-space region.
        let region: Rectangle<i32, Buffer> = Rectangle::from_size((size.w, size.h).into());

        // What:     `let mapping = renderer.copy_framebuffer(&framebuffer, region,
        //           Fourcc::Abgr8888).map_err(...)?;`. Copy into a CPU-readable mapping in
        //           `Abgr8888` (memory order R, G, B, A on little-endian, i.e. RGBA).
        // Why:      Move GPU pixels somewhere readable.
        let mapping = renderer
            .copy_framebuffer(&framebuffer, region, Fourcc::Abgr8888)
            .map_err(|err| anyhow::anyhow!("copy_framebuffer failed: {err:?}"))?;

        // What:     `let pixels = renderer.map_texture(&mapping).map_err(...)?;`. A
        //           read-only byte slice of the mapping (borrows the renderer).
        // Why:      Access the pixel bytes.
        let pixels = renderer
            .map_texture(&mapping)
            .map_err(|err| anyhow::anyhow!("map_texture failed: {err:?}"))?;

        // What:     `buffer.clear(); buffer.extend_from_slice(pixels);`. Empty the target
        //           buffer, then copy every pixel byte into it.
        // Why:      Hand the caller an owned copy so the renderer borrow can end.
        buffer.clear();
        buffer.extend_from_slice(pixels);
    }

    // What:     `let expected = width as usize * height as usize * BYTES_PER_PIXEL;`. The
    //           byte count a tightly packed RGBA frame should have.
    // Why:      Guard against an unexpected stride.
    let expected = width as usize * height as usize * BYTES_PER_PIXEL;

    // What:     `if buffer.len() != expected { return Err(...); }`. Reject a mismatch.
    // Why:      A stride mismatch would corrupt every downstream image.
    if buffer.len() != expected {
        return Err(anyhow::anyhow!(
            "readback size mismatch: got {} bytes, expected {expected}",
            buffer.len()
        ));
    }

    // What:     `Ok((width, height))`. Return the dimensions (tail expression).
    // Why:      The caller needs them to encode.
    Ok((width, height))
}

/// Render the current frame and write it to `path` as a single PNG.
///
/// What:     `pub fn capture(state: &mut Compositor, path: &Path) -> Result<()>`. Reads one
///           frame and encodes it synchronously (a single screenshot is not on a hot path).
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
    // What:     `let mut pixels = Vec::new();`. A fresh buffer for the one frame.
    // Why:      A single screenshot need not reuse buffers.
    let mut pixels = Vec::new();

    // What:     `let (width, height) = read_frame(state, &mut pixels)?;`. Read the frame.
    // Why:      Fill `pixels` and learn the dimensions.
    let (width, height) = read_frame(state, &mut pixels)?;

    // What:     `encoder::write_flipped(&pixels, width, height, path, encoder::Format::Png)
    //           .with_context(...)?;`. `read_frame` returns bottom-up pixels, so use the
    //           flip+encode helper (the same flip the recorder's workers apply) to write an
    //           upright PNG.
    // Why:      Single screenshots must be upright, matching the recorded frames.
    encoder::write_flipped(&pixels, width, height, path, encoder::Format::Png)
        .with_context(|| format!("writing screenshot to {}", path.display()))?;

    // What:     `Ok(())`. Success.
    // Why:      Signal the screenshot was written.
    Ok(())
}
