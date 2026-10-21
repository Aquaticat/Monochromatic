//! The slices of the picture:
//!  the bands the picture is cut into,
//!  the rows of the whole picture that a run of bands makes up,
//!  and the chunks a slice is rendered in.

/// A texture's bytes are bounded as the source tile's are.
use crate::shaped_text::MAX_RASTER_BYTES;
/// The bands are counted along the text's height.
use std::ops::Range;

/// What:
///  Least display scale the picture is built at.
/// Why:
///  A scale of zero or less would make every texture empty;
///  no real display is this small.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const MIN_SCALE = 0.25;
/// ```
pub const MIN_SCALE: f32 = 0.25;

/// What:
///  Most rows of the picture one render of the GPU draws.
/// Why:
///  Vello 0.11 sizes its scratch buffers with fixed constants,
///  and a scene that needs more than they hold renders blank without an error
///  (`doc/planning/ide-vello-buffer-sizes.md`):
///  the densest text the editor can show overflows them in one render of 2,048 rows and fits in 1,024
///  (`src/native/minimap_dense_tests.rs`).
///  A slice is therefore drawn in chunks of at most this many rows,
///  which keeps the densest text a factor of two inside the buffers.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const CHUNK_ROWS = 512;
/// ```
pub const CHUNK_ROWS: u32 = 512;

/// What:
///  The rows of the chunks a slice of `rows` is drawn in,
///  each at most [`CHUNK_ROWS`] tall,
///  from the slice's first row.
/// Why:
///  The worker builds one scene for each chunk and the GPU renders them one after another
///  into the one texture of the slice,
///  so the cuts must be whole picture rows that two builds of the same slice agree on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function chunkRows(rows: [number, number]): [number, number][];
/// ```
pub fn chunk_rows(rows: &Range<usize>) -> Vec<Range<usize>> {
    let mut chunks = Vec::new();
    let mut start = rows.start;
    while start < rows.end {
        let end = (start + CHUNK_ROWS as usize).min(rows.end);
        chunks.push(start..end);
        start = end;
    }
    return chunks;
}

/// What:
///  The most rows one texture of the minimap's picture may have when it is `width` pixels wide,
///  on a device whose textures are at most `limit` pixels on a side:
///  the side limit,
///  or fewer when the bytes of the texture would pass the rule the source tile keeps
///  ([`MAX_RASTER_BYTES`]).
/// Why:
///  Vello 0.11 renders a texture of more than about 128 MiB wrong without any error
///  (`doc/troubleshooting/vello-silent-blank-or-corrupt-frames-at-fixed-buffer-limits.md`),
///  so the picture is stacked from textures that stay well inside that,
///  whatever the device's limit allows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function textureRows(width: number, limit: number): number;
/// ```
pub fn texture_rows(width: u32, limit: u32) -> u32 {
    let by_bytes = MAX_RASTER_BYTES / 4 / u64::from(width.max(1));
    return u64::from(limit).min(by_bytes).min(u64::from(u32::MAX)) as u32;
}

/// What:
///  How the chunks of a picture, given by their `heights` from the top, are grouped into the textures that are
///  stacked to show it:
///  the chunk numbers of each texture,
///  top first,
///  each texture at most [`texture_rows`] tall for a picture `width` pixels wide on a device of `limit`.
///  A chunk taller than that is a texture of its own,
///  which the GPU then refuses with a message.
/// Why:
///  A texture is made of whole chunks, because the GPU renders and copies a chunk as it was built,
///  and a stack of textures that abut shows the same rows as one texture would,
///  so the cut between two textures is a cut between two chunks, which is already seamless.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function textureRuns(heights: number[], width: number, limit: number): [number, number][];
/// ```
pub fn texture_runs(heights: &[u32], width: u32, limit: u32) -> Vec<Range<usize>> {
    let most = u64::from(texture_rows(width, limit));
    let mut runs = Vec::new();
    let mut start = 0;
    let mut rows: u64 = 0;
    for (index, height) in heights.iter().enumerate() {
        if index > start && rows + u64::from(*height) > most {
            runs.push(start..index);
            start = index;
            rows = 0;
        }
        rows += u64::from(*height);
    }
    if start < heights.len() {
        runs.push(start..heights.len());
    }
    return runs;
}

/// What:
///  How tall a band of the text is,
///  in logical pixels of the text:
///  thirty-two code rows,
///  which are 128 rows of the picture at its fixed scale.
/// Why:
///  The window names the bands the track shows and the worker draws the lines they hold,
///  so a scroll that stays inside the same bands moves the picture in the markup and draws nothing;
///  the cuts stand at multiples of this from the top of the text,
///  so scrolling moves the window over them and never a cut.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const BAND = 768;
/// ```
pub const BAND: f32 = 768.0;

/// What:
///  How many bands of `step` logical pixels cover a text `height` logical pixels tall.
/// Why:
///  The window thread and the worker count the bands the same way,
///  so a range of band numbers means the same bands to both.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function bandCount(height: number, step: number): number;
/// ```
pub fn band_count(height: f32, step: f32) -> usize {
    if height <= 0.0 || step <= 0.0 {
        return 0;
    }
    return (height / step).ceil() as usize;
}

/// What:
///  How many bands of the picture fit in one texture `limit` pixels tall,
///  at display `scale` and `ratio` rows of the picture for each logical pixel of the text.
///  Never under one.
/// Why:
///  The texture a slice is drawn into is bounded by the device,
///  so the window never asks for more bands than one texture can hold.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function mostBands(limit: number, scale: number, ratio: number): number;
/// ```
pub fn most_bands(limit: u32, scale: f32, ratio: f64) -> usize {
    let rows = f64::from(BAND) * f64::from(scale.max(MIN_SCALE)) * ratio;
    return ((f64::from(limit) / rows).floor() as usize).max(1);
}

/// What:
///  The rows of the whole picture of a text `height` logical pixels tall,
///  at display `scale` and `ratio` rows of the picture for each logical pixel of the text.
/// Why:
///  The picture is as tall as the text at its fixed scale,
///  rounded up to whole pixels with a margin for the float error of the product.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function pictureRows(height: number, scale: number, ratio: number): number;
/// ```
pub fn picture_rows(height: f32, scale: f32, ratio: f64) -> usize {
    return ((f64::from(height) * f64::from(scale) * ratio) - 1e-3)
        .ceil()
        .max(0.0) as usize;
}

/// What:
///  The rows of the whole picture that the bands `window` make up:
///  from the first row of the first band to the first row of the band after the last,
///  and to the end of the picture when the window reaches the text's end.
/// Why:
///  The edges are whole picture rows and the same for every slice,
///  so two slices that share a band agree on where it stands.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function sliceRows(window: [number, number], height: number, scale: number, ratio: number): [number, number];
/// ```
pub fn slice_rows(window: &Range<usize>, height: f32, scale: f32, ratio: f64) -> Range<usize> {
    let total = picture_rows(height, scale, ratio);
    let per_band = f64::from(BAND) * f64::from(scale.max(MIN_SCALE)) * ratio;
    let start = ((window.start as f64 * per_band).round() as usize).min(total);
    let end = if window.end >= band_count(height, BAND) {
        total
    } else {
        ((window.end as f64 * per_band).round() as usize).min(total)
    };
    return start.min(end)..end;
}
