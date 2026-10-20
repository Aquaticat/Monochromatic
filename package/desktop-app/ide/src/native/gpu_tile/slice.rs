//! The minimap's slice:
//!  rendered in chunks of at most 512 rows,
//!  each into a small scratch texture and then copied into the one texture of the slice.
//!
//! Vello 0.11 sizes its scratch buffers with fixed constants,
//!  and a scene that needs more than they hold renders blank without an error
//!  (`doc/planning/ide-vello-buffer-sizes.md`),
//!  so a tall slice is never one render.
//! The copy is a GPU command; no pixel is touched by the CPU.

/// The device,
/// the textures,
/// and the outcome the window applies.
use super::{Inner, Outcome, Picture, Placement, Target};
/// The scene of a chunk and the size of its region.
use ide_app::tile_scene::TileScene;
/// The image import.
use slint::Image;
/// Slint's own wgpu types.
use slint::wgpu_30::wgpu;

/// The scratch textures kept at most;
/// the chunks of a slice are all one size but the last.
const SCRATCH_KEPT: usize = 4;

/// Draw the slice.
impl Inner {
    /// What:
    ///  The uses of the slice's texture:
    ///  the picture's usual uses,
    ///  and the chunks are copied into it.
    /// Why:
    ///  Slint's image import asks for the uses of every texture it shows,
    ///  and Vello never renders into this one.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function sliceUsage(): GPUTextureUsage;
    /// ```
    fn slice_usage() -> wgpu::TextureUsages {
        return Self::usage() | wgpu::TextureUsages::COPY_DST;
    }

    /// What:
    ///  The scratch texture a chunk of `width` by `height` is rendered into:
    ///  the one kept from an earlier chunk of that size,
    ///  or a new one.
    /// Why:
    ///  The chunks of a slice are one size but the last,
    ///  and the next slice's are the same,
    ///  so a few small textures serve every slice.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function scratch(device: GPUDevice, width: number, height: number): GPUTexture;
    /// ```
    fn scratch(&mut self, device: &wgpu::Device, width: u32, height: u32) -> wgpu::Texture {
        if let Some(kept) = self
            .scratch
            .iter()
            .find(|target| return target.width == width && target.height == height)
        {
            return kept.texture.clone();
        }
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("ide minimap chunk"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        if self.scratch.len() >= SCRATCH_KEPT {
            self.scratch.remove(0);
        }
        self.scratch.push(Target {
            texture: texture.clone(),
            width,
            height,
        });
        return texture;
    }

    /// What:
    ///  Render the chunks of the minimap's slice,
    ///  top first,
    ///  into the slice's texture,
    ///  making a new texture and a new image when the slice's size changed,
    ///  and say where the slice stands in the whole picture.
    /// Why:
    ///  The chunks stack without a gap,
    ///  so the slice is as wide as they are and as tall as they are together.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function drawSlice(chunks: TileScene[], top: number, outcome: Outcome): void;
    /// ```
    pub(super) fn draw_slice(&mut self, chunks: &[TileScene], top: u32, outcome: &mut Outcome) {
        let Some((device, queue)) = self.device.clone() else {
            return;
        };
        let Some(first) = chunks.first() else {
            return;
        };
        let width = first.width;
        let height: u32 = chunks.iter().map(|chunk| return chunk.height).sum();
        let limit = device.limits().max_texture_dimension_2d;
        let ragged = chunks.iter().any(|chunk| return chunk.width != width);
        if ragged || width == 0 || height == 0 || width > limit || height > limit {
            tracing::error!(
                width,
                height,
                limit,
                ragged,
                "a minimap slice does not fit a texture of this device"
            );
            outcome.errors.push(format!(
                "Cannot draw source: a {width}x{height} minimap does not fit a texture of this device \
                 (at most {limit} on a side)"
            ));
            return;
        }
        let reusable = match &self.targets[Picture::Minimap.slot()] {
            Some(target) => target.width == width && target.height == height,
            None => false,
        };
        if !reusable {
            let texture = device.create_texture(&wgpu::TextureDescriptor {
                label: Some("ide minimap slice"),
                size: wgpu::Extent3d {
                    width,
                    height,
                    depth_or_array_layers: 1,
                },
                mip_level_count: 1,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format: wgpu::TextureFormat::Rgba8Unorm,
                usage: Self::slice_usage(),
                view_formats: &[],
            });
            match Image::try_from(texture.clone()) {
                Ok(image) => outcome.images.push((Picture::Minimap, image)),
                Err(error) => {
                    tracing::error!(%error, "the minimap texture could not be shown as an image");
                    outcome.errors.push(format!("Cannot draw source: {error}"));
                    return;
                }
            }
            self.targets[Picture::Minimap.slot()] = Some(Target {
                texture,
                width,
                height,
            });
        }
        let Some(slice) = self.targets[Picture::Minimap.slot()]
            .as_ref()
            .map(|target| return target.texture.clone())
        else {
            return;
        };
        let mut row = 0;
        for chunk in chunks {
            let scratch = self.scratch(&device, width, chunk.height);
            if let Err(error) = self.render(&device, &queue, &scratch, chunk) {
                tracing::error!(%error, row, "the GPU could not render a chunk of the minimap");
                outcome.errors.push(format!("Cannot draw source: {error}"));
                return;
            }
            let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("ide minimap chunk copy"),
            });
            encoder.copy_texture_to_texture(
                wgpu::TexelCopyTextureInfo {
                    texture: &scratch,
                    mip_level: 0,
                    origin: wgpu::Origin3d::ZERO,
                    aspect: wgpu::TextureAspect::All,
                },
                wgpu::TexelCopyTextureInfo {
                    texture: &slice,
                    mip_level: 0,
                    origin: wgpu::Origin3d { x: 0, y: row, z: 0 },
                    aspect: wgpu::TextureAspect::All,
                },
                wgpu::Extent3d {
                    width,
                    height: chunk.height,
                    depth_or_array_layers: 1,
                },
            );
            queue.submit(std::iter::once(encoder.finish()));
            row += chunk.height;
            self.minimap_chunks_rendered += 1;
        }
        self.minimaps_rendered += 1;
        outcome.minimap = Some(Placement { width, height, top });
    }
}
