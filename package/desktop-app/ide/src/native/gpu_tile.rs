//! The code view and the minimap on the GPU:
//!  the textures the source tile,
//!  the gutter's wrap indicator,
//!  and the minimap's slice are drawn into,
//!  and the rendering notifier that draws them with one Vello renderer.
//!
//! Slint hands its wgpu device to the notifier only when the first frame is set up,
//!  so the Vello renderer and the textures are made there.
//! The window thread (or the tile worker) builds a Vello scene from the shaped rows and hands it over;
//!  the notifier renders it into a texture on Slint's own device just before Slint draws the frame,
//!  and the texture is shown as an ordinary image.
//! No pixel is filled by the CPU:
//!  the scene holds glyph outlines and paths,
//!  and the GPU turns them into pixels.

/// Reads of the textures for the native tests.
#[cfg(test)]
mod readback;
/// The minimap's slice, rendered in chunks.
mod slice;
/// A scene rendered without a window.
#[cfg(test)]
pub(super) use readback::render_scene;

/// The window the textures are shown in,
///  and the chaining of the debug frame records.
use super::{AppWindow, frame_trace};
/// The tile scene that is drawn into a texture.
use ide_app::tile_scene::TileScene;
/// Slint's own wgpu types,
/// the ones the window's device is made of.
use slint::wgpu_30::wgpu;
/// The window handle,
/// the rendering stages,
/// the graphics API,
/// and the image import.
use slint::{ComponentHandle, GraphicsAPI, Image, RenderingState};
/// Shared ownership of the GPU state on the window thread.
use std::{cell::RefCell, rc::Rc};
/// Vello's renderer and its settings.
use vello::{
    AaConfig, AaSupport, RenderParams, Renderer, RendererOptions, peniko::Color as VelloColor,
};

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
struct Target {
    /// The texture Vello renders into and Slint samples.
    texture: wgpu::Texture,
    /// Width in physical pixels.
    width: u32,
    /// Height in physical pixels.
    height: u32,
}

/// The pictures the GPU draws for the window.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Picture {
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
    fn slot(self) -> usize {
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
struct Outcome {
    /// Pictures that have a new texture to show.
    images: Vec<(Picture, Image)>,
    /// Where the minimap's slice stands, when one was drawn.
    minimap: Option<Placement>,
    /// Failures to show as the window's error.
    errors: Vec<String>,
}

/// Show what a step changed.
impl Outcome {
    /// Set the images and the last error on `window`.
    fn apply(self, window: &AppWindow) {
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

/// What:
///  Everything the notifier and the window thread share:
///  the device once Slint has one,
///  the renderer,
///  the three textures,
///  and the scenes waiting to be drawn.
/// Why:
///  The window thread hands a scene over at any time and the notifier draws it at the next frame,
///  so both reach the same state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Gpu = { device?: Device; renderer?: Renderer; targets: (Target | undefined)[]; pending: Scene[] };
/// ```
#[derive(Default)]
struct Inner {
    /// The device and queue of the first frame's setup.
    device: Option<(wgpu::Device, wgpu::Queue)>,
    /// Vello's renderer,
    /// made at setup.
    renderer: Option<Renderer>,
    /// The textures of the pictures,
    /// by [`Picture::slot`].
    targets: [Option<Target>; 3],
    /// A tile scene not drawn yet.
    pending_tile: Option<TileScene>,
    /// A wrap indicator scene not drawn yet.
    pending_sign: Option<TileScene>,
    /// The chunks of a minimap slice not drawn yet,
    /// with the row of the whole picture the slice's first row is.
    pending_minimap: Option<(Vec<TileScene>, u32)>,
    /// Small textures the chunks of a slice are rendered into before they are copied into the slice's texture.
    scratch: Vec<Target>,
    /// Tile scenes rendered into the texture so far.
    tiles_rendered: u64,
    /// Wrap indicator scenes rendered so far.
    signs_rendered: u64,
    /// Minimap slices rendered so far.
    minimaps_rendered: u64,
    /// Minimap chunks rendered so far.
    minimap_chunks_rendered: u64,
}

/// What:
///  The handle the window state holds:
///  a scene is handed to it,
/// and the notifier draws it.
/// Why:
///  The state lives next to the window on one thread,
///  so a shared,
/// checked borrow is all the sharing needs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class GpuTile { submitTile(scene: TileScene): void; submitSign(scene: TileScene): void }
/// ```
#[derive(Clone, Default)]
pub(super) struct GpuTile {
    /// The state the notifier also holds.
    inner: Rc<RefCell<Inner>>,
}

/// Hand scenes over and read what was drawn.
impl GpuTile {
    /// Make the tile scene the one to draw at the next frame;
    /// a scene not drawn yet is replaced.
    pub(super) fn submit_tile(&self, scene: TileScene) {
        self.inner.borrow_mut().pending_tile = Some(scene);
    }

    /// Make the scene of the wrap indicator the one to draw at the next frame.
    pub(super) fn submit_sign(&self, scene: TileScene) {
        self.inner.borrow_mut().pending_sign = Some(scene);
    }

    /// Make the slice of the minimap's picture,
    /// given as the scenes of its chunks from the top,
    /// whose first row is the row `top` of the whole picture,
    /// the one to draw at the next frame;
    /// a slice not drawn yet is replaced.
    pub(super) fn submit_minimap(&self, chunks: Vec<TileScene>, top: u32) {
        self.inner.borrow_mut().pending_minimap = Some((chunks, top));
    }

    /// Forget the minimap's texture and any slice waiting,
    /// so the next slice makes a new texture and a new image.
    /// The window calls this when it clears the image, for another file.
    pub(super) fn forget_minimap(&self) {
        let mut inner = self.inner.borrow_mut();
        inner.pending_minimap = None;
        inner.targets[Picture::Minimap.slot()] = None;
    }

    /// How many tile scenes the GPU has rendered into a texture,
    /// for the structural tests:
    /// scrolling inside the tile renders none.
    #[cfg(test)]
    pub(super) fn tiles_rendered(&self) -> u64 {
        return self.inner.borrow().tiles_rendered;
    }

    /// How many wrap indicator scenes the GPU has rendered.
    #[cfg(test)]
    pub(super) fn signs_rendered(&self) -> u64 {
        return self.inner.borrow().signs_rendered;
    }

    /// The tile's texture read back from the GPU as straight RGBA,
    /// row by row from the top,
    /// or nothing before a tile is drawn.
    /// A frame must have been rendered since the last scene was handed over.
    #[cfg(test)]
    pub(super) fn read_tile(&self) -> Option<slint::SharedPixelBuffer<slint::Rgba8Pixel>> {
        return self.inner.borrow().read(Picture::Tile);
    }

    /// The wrap indicator's texture read back from the GPU as straight RGBA,
    /// or nothing before it is drawn.
    #[cfg(test)]
    pub(super) fn read_sign(&self) -> Option<slint::SharedPixelBuffer<slint::Rgba8Pixel>> {
        return self.inner.borrow().read(Picture::Sign);
    }

    /// The minimap's texture read back from the GPU as straight RGBA,
    /// or nothing before a slice is drawn.
    #[cfg(test)]
    pub(super) fn read_minimap(&self) -> Option<slint::SharedPixelBuffer<slint::Rgba8Pixel>> {
        return self.inner.borrow().read(Picture::Minimap);
    }

    /// How many minimap slices the GPU has rendered into a texture,
    /// for the structural tests:
    /// a scroll inside the bands of the slice renders none.
    #[cfg(test)]
    pub(super) fn minimaps_rendered(&self) -> u64 {
        return self.inner.borrow().minimaps_rendered;
    }

    /// How many minimap chunks the GPU has rendered,
    /// for the structural tests:
    /// a tall slice is several renders.
    #[cfg(test)]
    pub(super) fn minimap_chunks_rendered(&self) -> u64 {
        return self.inner.borrow().minimap_chunks_rendered;
    }

    /// The size of the minimap's texture in physical pixels,
    /// or nothing before the first slice is drawn.
    #[cfg(test)]
    pub(super) fn minimap_size(&self) -> Option<(u32, u32)> {
        return self.inner.borrow().targets[Picture::Minimap.slot()]
            .as_ref()
            .map(|target| return (target.width, target.height));
    }

    /// The size of the tile's texture in physical pixels,
    /// or nothing before the first tile is drawn.
    #[cfg(test)]
    pub(super) fn tile_size(&self) -> Option<(u32, u32)> {
        return self.inner.borrow().targets[Picture::Tile.slot()]
            .as_ref()
            .map(|target| return (target.width, target.height));
    }

    /// Whether a scene waits for the next frame.
    #[cfg(test)]
    pub(super) fn has_pending(&self) -> bool {
        let inner = self.inner.borrow();
        return inner.pending_tile.is_some()
            || inner.pending_sign.is_some()
            || inner.pending_minimap.is_some();
    }
}

/// Set up,
/// draw,
/// and tear down on the renderer's calls.
impl Inner {
    /// What:
    ///  The uses of a picture's texture:
    ///  Vello writes it as a storage texture,
    ///  and Slint samples it.
    ///  A test build can also read it back.
    /// Why:
    ///  Reading a texture back is how the native tests look at the tile itself,
    ///  without the selection fills,
    /// caret,
    /// and minimap that the window draws around it.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function usage(): GPUTextureUsage;
    /// ```
    fn usage() -> wgpu::TextureUsages {
        let drawn = wgpu::TextureUsages::STORAGE_BINDING
            | wgpu::TextureUsages::TEXTURE_BINDING
            | wgpu::TextureUsages::RENDER_ATTACHMENT;
        if cfg!(test) {
            return drawn | wgpu::TextureUsages::COPY_SRC;
        }
        return drawn;
    }

    /// What:
    ///  Copy the texture of `picture` into a buffer on the GPU and read it,
    ///  for the native tests.
    /// Why:
    ///  This is a GPU readback like the window snapshot,
    ///  and it shows the tile alone,
    ///  with its alpha,
    ///  which a snapshot of the window composites away.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function read(picture: Picture): Pixels | undefined;
    /// ```
    #[cfg(test)]
    fn read(&self, picture: Picture) -> Option<slint::SharedPixelBuffer<slint::Rgba8Pixel>> {
        let (device, queue) = self.device.as_ref()?;
        let target = self.targets[picture.slot()].as_ref()?;
        return Some(readback::read_texture(
            device,
            queue,
            &target.texture,
            (target.width, target.height),
        ));
    }

    /// What:
    ///  Take the device of the first frame and make Vello's renderer for it.
    ///  The largest texture the device offers is recorded for the tile's height.
    /// Why:
    ///  Vello compiles its compute shaders here,
    /// once.
    ///  A device whose limit differs from the one the tiles were cut for is reported:
    ///  the launcher and the harness record the device's own limit before any window exists,
    ///  so a difference means another device was given to the window.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function setup(device: GPUDevice, queue: GPUQueue): Outcome;
    /// ```
    fn setup(&mut self, device: &wgpu::Device, queue: &wgpu::Queue) -> Outcome {
        let mut outcome = Outcome::default();
        let limit = device.limits().max_texture_dimension_2d;
        if limit != ide_app::shaped_text::texture_dimension() {
            tracing::warn!(
                limit,
                assumed = ide_app::shaped_text::texture_dimension(),
                "the window's device offers another texture size than the tiles were cut for"
            );
            ide_app::shaped_text::set_texture_dimension(limit);
        }
        match Renderer::new(
            device,
            RendererOptions {
                use_cpu: false,
                antialiasing_support: AaSupport::area_only(),
                num_init_threads: None,
                pipeline_cache: None,
            },
        ) {
            Ok(renderer) => {
                tracing::debug!(limit, "the GPU text renderer is ready");
                self.renderer = Some(renderer);
            }
            Err(error) => {
                tracing::error!(%error, "the GPU text renderer could not be made");
                outcome.errors.push(format!(
                    "Cannot draw source: the GPU text renderer could not start: {error}"
                ));
            }
        }
        self.device = Some((device.clone(), queue.clone()));
        return outcome;
    }

    /// Release the renderer and the textures before the device goes away.
    fn teardown(&mut self) {
        self.renderer = None;
        self.targets = [None, None, None];
        self.scratch = Vec::new();
        self.device = None;
    }

    /// What:
    ///  Draw the scenes that wait,
    /// if the renderer is ready.
    /// Why:
    ///  This runs just before Slint draws the frame,
    ///  so the textures hold the new scenes when the images that show them are sampled.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function drawPending(): Outcome;
    /// ```
    fn draw_pending(&mut self) -> Outcome {
        let mut outcome = Outcome::default();
        if self.renderer.is_none() || self.device.is_none() {
            return outcome;
        }
        if let Some(scene) = self.pending_tile.take() {
            self.draw(Picture::Tile, &scene, &mut outcome);
        }
        if let Some(scene) = self.pending_sign.take() {
            self.draw(Picture::Sign, &scene, &mut outcome);
        }
        if let Some((chunks, top)) = self.pending_minimap.take() {
            self.draw_slice(&chunks, top, &mut outcome);
        }
        return outcome;
    }

    /// What:
    ///  Render `scene` into the texture of `picture`,
    ///  making a new texture,
    /// and setting a new image on the window,
    /// when the size changed.
    /// Why:
    ///  Rendering into the same texture needs no new image,
    ///  and the frame that follows samples the new content.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function draw(picture: Picture, scene: TileScene, outcome: Outcome): void;
    /// ```
    fn draw(&mut self, picture: Picture, scene: &TileScene, outcome: &mut Outcome) {
        let Some((device, queue)) = self.device.clone() else {
            return;
        };
        let limit = device.limits().max_texture_dimension_2d;
        if scene.width == 0 || scene.height == 0 || scene.width > limit || scene.height > limit {
            tracing::error!(
                width = scene.width,
                height = scene.height,
                limit,
                ?picture,
                "a scene does not fit a texture of this device"
            );
            outcome.errors.push(format!(
                "Cannot draw source: a {}x{} picture does not fit a texture of this device (at most {limit} on a side)",
                scene.width, scene.height
            ));
            return;
        }
        let reusable = match &self.targets[picture.slot()] {
            Some(target) => target.width == scene.width && target.height == scene.height,
            None => false,
        };
        if !reusable {
            let texture = device.create_texture(&wgpu::TextureDescriptor {
                label: Some(match picture {
                    Picture::Tile => "ide source tile",
                    Picture::Sign => "ide wrap indicator",
                    Picture::Minimap => "ide minimap",
                }),
                size: wgpu::Extent3d {
                    width: scene.width,
                    height: scene.height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: Self::usage(),
                view_formats: &[],
            });
            match Image::try_from(texture.clone()) {
                Ok(image) => outcome.images.push((picture, image)),
                Err(error) => {
                    tracing::error!(%error, "the texture could not be shown as an image");
                    outcome.errors.push(format!("Cannot draw source: {error}"));
                    return;
                }
            }
            self.targets[picture.slot()] = Some(Target {
                texture,
                width: scene.width,
                height: scene.height,
            });
        }
        let Some(texture) = self.targets[picture.slot()]
            .as_ref()
            .map(|target| return target.texture.clone())
        else {
            return;
        };
        match self.render(&device, &queue, &texture, scene) {
            Ok(()) => match picture {
                Picture::Tile => self.tiles_rendered += 1,
                Picture::Sign => self.signs_rendered += 1,
                Picture::Minimap => {}
            },
            Err(error) => {
                tracing::error!(%error, ?picture, "the GPU could not render a scene");
                outcome.errors.push(format!("Cannot draw source: {error}"));
            }
        }
    }

    /// What:
    ///  Render `scene` into `texture` with the one Vello renderer.
    /// Why:
    ///  The tile, the wrap indicator,
    ///  and every chunk of the minimap share one renderer,
    ///  so the renderer's scratch buffers exist once.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function render(device: GPUDevice, queue: GPUQueue, texture: GPUTexture, scene: TileScene): void;
    /// ```
    fn render(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        texture: &wgpu::Texture,
        scene: &TileScene,
    ) -> Result<(), vello::Error> {
        let Some(renderer) = self.renderer.as_mut() else {
            return Ok(());
        };
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        return renderer.render_to_texture(
            device,
            queue,
            &scene.scene,
            &view,
            &RenderParams {
                base_color: VelloColor::from_rgba8(0, 0, 0, 0),
                width: scene.width,
                height: scene.height,
                antialiasing_method: AaConfig::Area,
            },
        );
    }
}

/// What:
///  Install the one rendering notifier of `window`:
///  it sets up Vello on the first frame,
///  draws the waiting scenes before each frame,
///  releases them at teardown,
///  and writes the debug frame records.
///  `gpu` is the handle the window state holds.
/// Why:
///  A window takes one notifier,
///  so the frame records and the drawing share it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bind(window: AppWindow, gpu: GpuTile): void;
/// ```
pub(super) fn bind(window: &AppWindow, gpu: &GpuTile) {
    let inner = Rc::clone(&gpu.inner);
    let weak = window.as_weak();
    let installed = window.window().set_rendering_notifier(move |state, api| {
        frame_trace::log_rendering_stage(&state);
        let GraphicsAPI::WGPU30 { device, queue, .. } = api else {
            tracing::error!("the window's renderer offers no wgpu 30 device");
            return;
        };
        let outcome = match state {
            RenderingState::RenderingSetup => inner.borrow_mut().setup(device, queue),
            RenderingState::BeforeRendering => inner.borrow_mut().draw_pending(),
            RenderingState::RenderingTeardown => {
                inner.borrow_mut().teardown();
                return;
            }
            _ => return,
        };
        if let Some(active) = weak.upgrade() {
            outcome.apply(&active);
        }
    });
    if let Err(error) = installed {
        tracing::error!(%error, "the source view cannot be drawn: the renderer takes no notifier");
        window.set_error_message(slint::SharedString::from(format!(
            "Cannot draw source: the window's renderer takes no rendering notifier ({error})"
        )));
    }
}
