//! What the native tests ask of the GPU state:
//!  how much was rendered,
//!  how big the textures are,
//!  and the textures read back as pixels.

/// The readback of one texture.
use super::readback::read_texture;
/// The handle the window state holds,
/// the state behind it,
/// and the pictures with one texture each.
use super::{GpuTile, Inner, Picture};
/// The pixels of a read.
use slint::{Rgba8Pixel, SharedPixelBuffer};

/// Counts,
/// sizes,
/// and reads for the structural tests.
impl GpuTile {
    /// How many tile scenes the GPU has rendered into a texture,
    /// for the structural tests:
    /// scrolling inside the tile renders none.
    pub(in crate::native) fn tiles_rendered(&self) -> u64 {
        return self.inner.borrow().tiles_rendered;
    }

    /// How many wrap indicator scenes the GPU has rendered.
    pub(in crate::native) fn signs_rendered(&self) -> u64 {
        return self.inner.borrow().signs_rendered;
    }

    /// The tile's texture read back from the GPU as straight RGBA,
    /// row by row from the top,
    /// or nothing before a tile is drawn.
    /// A frame must have been rendered since the last scene was handed over.
    pub(in crate::native) fn read_tile(&self) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
        return self.inner.borrow().read(Picture::Tile);
    }

    /// The wrap indicator's texture read back from the GPU as straight RGBA,
    /// or nothing before it is drawn.
    pub(in crate::native) fn read_sign(&self) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
        return self.inner.borrow().read(Picture::Sign);
    }

    /// The minimap's textures read back from the GPU as straight RGBA and stacked into one buffer,
    /// row by row from the top of the picture,
    /// or nothing before a picture is drawn.
    pub(in crate::native) fn read_minimap(&self) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
        return self.inner.borrow().read_stack();
    }

    /// How many minimap pictures the GPU has rendered into textures,
    /// for the structural tests:
    /// a scroll inside the bands of the picture renders none.
    pub(in crate::native) fn minimaps_rendered(&self) -> u64 {
        return self.inner.borrow().minimaps_rendered;
    }

    /// How many minimap chunks the GPU has rendered,
    /// for the structural tests:
    /// a tall picture is several renders.
    pub(in crate::native) fn minimap_chunks_rendered(&self) -> u64 {
        return self.inner.borrow().minimap_chunks_rendered;
    }

    /// The width and height in physical pixels of each texture of the minimap's picture,
    /// top first,
    /// or nothing before the first picture is drawn.
    pub(in crate::native) fn minimap_texture_sizes(&self) -> Vec<(u32, u32)> {
        let inner = self.inner.borrow();
        let mut sizes = Vec::with_capacity(inner.minimap.len());
        for texture in &inner.minimap {
            sizes.push((texture.target.width, texture.target.height));
        }
        return sizes;
    }

    /// The size of the tile's texture in physical pixels,
    /// or nothing before the first tile is drawn.
    pub(in crate::native) fn tile_size(&self) -> Option<(u32, u32)> {
        let inner = self.inner.borrow();
        let target = inner.targets[Picture::Tile.slot()].as_ref()?;
        return Some((target.width, target.height));
    }

    /// Whether a scene waits for the next frame.
    pub(in crate::native) fn has_pending(&self) -> bool {
        let inner = self.inner.borrow();
        return inner.pending_tile.is_some()
            || inner.pending_sign.is_some()
            || inner.pending_minimap.is_some();
    }
}

/// Reads of the textures.
impl Inner {
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
    fn read(&self, picture: Picture) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
        let (device, queue) = self.device.as_ref()?;
        let target = self.targets[picture.slot()].as_ref()?;
        return Some(read_texture(
            device,
            queue,
            &target.texture,
            (target.width, target.height),
        ));
    }

    /// The minimap's textures read back from the GPU and stacked into one buffer of their common width,
    /// or nothing when there is no texture or the textures differ in width.
    fn read_stack(&self) -> Option<SharedPixelBuffer<Rgba8Pixel>> {
        let (device, queue) = self.device.as_ref()?;
        let first = self.minimap.first()?;
        let width = first.target.width;
        let mut height = 0;
        for texture in &self.minimap {
            height += texture.target.height;
        }
        let mut stacked = SharedPixelBuffer::<Rgba8Pixel>::new(width, height);
        let mut row = 0;
        for texture in &self.minimap {
            if texture.target.width != width {
                return None;
            }
            let part = read_texture(
                device,
                queue,
                &texture.target.texture,
                (width, texture.target.height),
            );
            let start = row as usize * width as usize;
            let slots = stacked.make_mut_slice();
            slots[start..start + part.as_slice().len()].copy_from_slice(part.as_slice());
            row += texture.target.height;
        }
        return Some(stacked);
    }
}
