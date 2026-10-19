//! The minimap's picture:
//!  the window's own rendering of the bands of the text near the visible part of the picture,
//!  band by band,
//!  reduced to the minimap's width and the track's scale by area averaging,
//!  and put together without a seam.

/// The units a build keeps from the last picture.
use super::cache::{Cache, Slot};
/// The reduction of a rendered band.
use super::downscale::{Picture, Reduced, Reducer, Reduction, Strip};
/// The geometry of the track the picture covers.
use super::geometry::Geometry;
/// The width of the text the picture covers.
use super::horizontal::text_span;
/// What the units of a picture are valid for.
use super::key::{Shared, UnitKey, key_of};
/// The bands.
use super::plan::{Band, MIN_SCALE, columns_of, plan};
/// Rendering one band as the window renders a tile.
use super::render::{Rendered, Scene, render};
/// Work in the units of `line_work`.
use crate::shaped_text::{TextShaper, line_work};
/// The painter whose glyph cache the bands share.
use crate::text_raster::TextRaster;
use anyhow::{Result, bail};
/// The bands to build are a range of numbers.
use std::ops::Range;

/// What:
///  Work,
///  in the units of `line_work`,
///  a picture may spend rendering lines.
/// Why:
///  A picture renders only the bands near the visible part of the picture,
///  so ordinary text costs a small part of this;
///  a band whose lines cost more than what is left is left to the rows the last picture holds.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const BUILD_WORK = 5_000_000;
/// ```
pub const BUILD_WORK: usize = 5_000_000;

/// What:
///  The question a build asks between two bands:
///  whether its result is still wanted.
/// Why:
///  A newer request or a closed window makes the rest of the build wasted work,
///  and the build ends early with nothing.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// interface Cancel { isCancelled(): boolean }
/// ```
pub trait Cancel {
    /// Whether the build should stop.
    fn is_cancelled(&self) -> bool;
}

/// What:
///  What a build reads:
///  the scene,
///  the sizes,
///  and the bands to build.
/// Why:
///  Every field is borrowed from a snapshot the worker owns,
///  so a build never touches window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Input = { scene: Scene; view: number; width: number; window: [number, number] };
/// ```
#[derive(Clone)]
pub struct Input<'a> {
    /// What the bands are rendered from.
    pub scene: Scene<'a>,
    /// Height of the view,
    /// in logical pixels,
    /// which is the most the picture can be.
    pub view: f32,
    /// Width of the picture,
    /// in logical pixels.
    pub width: f32,
    /// The numbers of the bands to build,
    /// counted from the top of the text.
    pub window: Range<usize>,
}

/// What:
///  What one build cost and what it left out.
/// Why:
///  The worker logs it and the tests assert the bounds from it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Stats = { units: number; rendered: number; reused: number; skipped: number; failed: number; lines: number; work: number };
/// ```
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Stats {
    /// Units of the picture.
    pub units: usize,
    /// Units rendered in this build.
    pub rendered: usize,
    /// Units taken from the cache.
    pub reused: usize,
    /// Units the work budget could not pay for.
    pub skipped: usize,
    /// Units that could not be rendered.
    pub failed: usize,
    /// Lines rendered,
    /// a line shared by two pieces counted twice.
    pub lines: usize,
    /// Work charged for the lines rendered.
    pub work: usize,
    /// Most bytes any raster of the build held.
    pub largest: usize,
}

/// What:
///  A finished picture:
///  premultiplied RGBA bytes,
///  row by row,
///  and what it cost.
/// Why:
///  The window thread turns the bytes into an image and nothing else.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Built = { width: number; height: number; top: number; bytes: Uint8Array; stats: Stats };
/// ```
#[derive(Clone, Debug)]
pub struct Built {
    /// Physical pixel width.
    pub width: u32,
    /// Physical pixel height.
    pub height: u32,
    /// The row of the whole picture that the first row of this one is,
    /// in physical pixels.
    pub top: u32,
    /// Premultiplied RGBA bytes.
    pub bytes: Vec<u8>,
    /// What the build cost.
    pub stats: Stats,
}

/// What:
///  A picture's plan:
///  its bands,
///  their keys,
///  and the reduction that fits them to the picture.
/// Why:
///  The plan says what a build would render before anything is rendered.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Prepared = { bands: Band[]; keys: UnitKey[]; reducer: Reducer; width: number; height: number; top: number };
/// ```
pub struct Prepared {
    /// What the picture is made of.
    bands: Vec<Band>,
    /// What each band is valid for.
    keys: Vec<UnitKey>,
    /// The numbers of the bands.
    window: Range<usize>,
    /// The display scale the bands are rendered at.
    scale: f32,
    /// The weights of the reduction.
    reducer: Reducer,
    /// Physical pixel width.
    width: usize,
    /// The row of the whole picture the first row of this one is.
    top: usize,
    /// Physical pixel height.
    height: usize,
    /// Physical rows of the whole text.
    extent: f64,
}

/// The cost of rendering the lines of `band`:
/// `usize::MAX` for a line no budget can pay.
fn cost_of(scene: &Scene, band: &Band) -> usize {
    let mut total: usize = 0;
    for line in band.first..band.first + band.count {
        total = total.saturating_add(line_work(scene.document, line));
    }
    return total;
}

/// What:
///  The rows of the whole picture that the bands `bands` cover whole,
///  for `ratio` output rows for each physical row of the text:
///  from the first row that lies wholly in the first band
///  to the last row that lies wholly in the last band,
///  and to the end of the picture when the last band is the text's last.
/// Why:
///  A row on the edge of the window is shared with a band outside it,
///  and half an average would show as a dim row.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function rowsOf(bands: Band[], scale: number, ratio: number, height: number): [number, number];
/// ```
fn rows_of(bands: &[Band], scale: f32, ratio: f64, height: usize) -> Range<usize> {
    let (Some(head), Some(tail)) = (bands.first(), bands.last()) else {
        return 0..0;
    };
    let start = if head.span.start <= 0.0 {
        0
    } else {
        (f64::from(head.span.start) * f64::from(scale) * ratio - 1e-6)
            .ceil()
            .max(0.0) as usize
    };
    let end = if tail.last {
        height
    } else {
        ((f64::from(tail.span.end) * f64::from(scale) * ratio + 1e-6).floor() as usize).min(height)
    };
    return start.min(end)..end;
}

/// What:
///  Plan the picture of `input`.
/// Why:
///  The minimap's width fixes the picture's width,
///  the fixed scale fixes the output rows for each row of the text,
///  and the window fixes which bands are rendered and which rows of the whole picture they make.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function prepare(input: Input): Prepared;
/// ```
pub fn prepare(input: &Input) -> Prepared {
    let scene = &input.scene;
    let scale = scene.scale.max(MIN_SCALE);
    let geometry = Geometry::new(scene.map.height(), input.view);
    let ratio = f64::from(geometry.scale());
    let width = ((input.width * scale).round() as usize).max(1);
    let height = ((f64::from(scene.map.height()) * f64::from(scale) * ratio) - 1e-3)
        .ceil()
        .max(0.0) as usize;
    let span = text_span(scene.wrap);
    let columns = columns_of(scene.wrap, scale);
    let reduction = Reduction {
        source_width: f64::from(span) * f64::from(scale),
        width,
        ratio,
    };
    let shared = Shared {
        colors: scene.colors,
        inks: scene.inks,
        fills: scene.fills,
        scale: scale.to_bits(),
        wrap: scene.wrap.map_or(0, f32::to_bits),
        ratio: ratio.to_bits(),
        width,
    };
    let bands = plan(scene.map, columns, scale, input.window.clone());
    let mut keys = Vec::new();
    for band in &bands {
        keys.push(key_of(band, scene, shared));
    }
    let rows = rows_of(&bands, scale, ratio, height);
    return Prepared {
        bands,
        keys,
        window: input.window.clone(),
        scale,
        reducer: Reducer::new(reduction, columns as usize),
        width,
        top: rows.start,
        height: rows.end - rows.start,
        extent: f64::from(scene.map.height()) * f64::from(scale),
    };
}

/// The reduction of the rendered `band`.
fn reduce_band(prepared: &Prepared, band: &Band, rendered: &Rendered) -> Result<Reduced> {
    let assigned = band.assigned(prepared.scale);
    // A band renders a little more than its stretch, never less.
    let bottom = rendered.top + rendered.height as f64;
    if rendered.top > assigned.start + 1.0 || bottom + 1.0 < assigned.end.min(prepared.extent) {
        bail!(
            "The rendered rows {:.1} to {:.1} do not cover the stretch {:.1} to {:.1}",
            rendered.top,
            bottom,
            assigned.start,
            assigned.end
        );
    }
    let strip = Strip {
        bytes: &rendered.bytes,
        width: rendered.width,
        height: rendered.height,
        top: rendered.top,
        step: 1.0,
    };
    return Ok(prepared.reducer.reduce(&strip, &assigned));
}

/// Render and reduce the `band`;
/// the answer holds the most bytes any raster held.
fn make_unit(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    prepared: &Prepared,
    scene: &Scene,
    band: &Band,
) -> Result<(Reduced, usize)> {
    let rendered = match render(shaper, raster, scene, band) {
        Ok(done) => done,
        Err(error) => {
            bail!(
                "Cannot render the lines {} to {}: {error:#}",
                band.first,
                band.first + band.count
            );
        }
    };
    let largest = rendered.bytes.len();
    return Ok((reduce_band(prepared, band, &rendered)?, largest));
}

/// What:
///  One build in progress:
///  what it renders with,
///  the picture it fills,
///  and the work it has left.
/// Why:
///  The steps of a unit share all of it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Run { picture: Picture; stats: Stats; left: number }
/// ```
struct Run<'a> {
    /// Shapes the lines.
    shaper: &'a mut TextShaper,
    /// Paints the glyphs.
    raster: &'a mut TextRaster,
    /// What the bands are rendered from.
    input: &'a Input<'a>,
    /// What the picture is made of.
    prepared: &'a Prepared,
    /// The units of the last picture.
    cache: &'a mut Cache,
    /// The picture being filled.
    picture: Picture,
    /// The cost so far.
    stats: Stats,
    /// Work still allowed.
    left: usize,
    /// Work the build was allowed.
    allowed: usize,
}

/// The steps of one unit.
impl Run<'_> {
    /// The number of the band at `offset` in the plan.
    fn number(&self, offset: usize) -> usize {
        return self.prepared.window.start + offset;
    }

    /// Use the kept unit of the band at `offset` when its key is unchanged.
    fn reuse(&mut self, offset: usize) -> bool {
        let Some(slot) = self.cache.get(self.number(offset)) else {
            return false;
        };
        if slot.key != self.prepared.keys[offset] {
            return false;
        }
        place_unit(&mut self.picture, &slot.reduced);
        self.stats.reused += 1;
        return true;
    }

    /// The reduction the cache holds for the place of the band at `offset`,
    /// whatever it was rendered for.
    fn kept(&self, offset: usize) -> Option<Reduced> {
        let slot = self.cache.get(self.number(offset))?;
        if slot.key.same_place(&self.prepared.keys[offset]) {
            return Some(slot.reduced.clone());
        }
        return None;
    }

    /// Render the band at `offset` and place it;
    /// the answer is why it could not be,
    /// if it could not.
    fn render(&mut self, offset: usize) -> Option<String> {
        let band = &self.prepared.bands[offset];
        let cost = cost_of(&self.input.scene, band);
        if cost > self.left {
            self.stats.skipped += 1;
            return Some(format!(
                "the work budget of {} cannot pay {cost}",
                self.allowed
            ));
        }
        let made = make_unit(
            self.shaper,
            self.raster,
            self.prepared,
            &self.input.scene,
            band,
        );
        let (reduced, largest) = match made {
            Ok(done) => done,
            Err(error) => {
                self.stats.failed += 1;
                return Some(format!("{error:#}"));
            }
        };
        self.left -= cost;
        self.stats.work += cost;
        self.stats.rendered += 1;
        self.stats.largest = self.stats.largest.max(largest);
        self.stats.lines += band.count;
        place_unit(&mut self.picture, &reduced);
        let number = self.number(offset);
        self.cache.put(
            number,
            Slot {
                key: self.prepared.keys[offset].clone(),
                reduced,
            },
        );
        return None;
    }

    /// Log that the band at `offset` was not rendered for `reason`,
    /// and keep the rows of the last picture in its place.
    fn degrade(&mut self, offset: usize, reason: &str) {
        let band = &self.prepared.bands[offset];
        let kept = self.kept(offset);
        tracing::warn!(
            first_line = band.first,
            end_line = band.first + band.count,
            kept = kept.is_some(),
            reason,
            "a minimap band was not rendered; the rows of the previous picture stay"
        );
        if let Some(rows) = kept {
            place_unit(&mut self.picture, &rows);
        }
    }
}

/// What:
///  Build the picture `prepared` plans,
///  rendering the bands `cache` does not hold within `work`,
///  and asking `cancelled` between bands.
///  A band that cannot be rendered or paid for keeps the rows the cache holds for the same place,
///  and is counted and logged.
///  The cache then holds the bands of the picture and no others.
/// Why:
///  A band that fails must not blank the picture:
///  the rows of the last picture stay.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function build(shaper: TextShaper, raster: TextRaster, input: Input, prepared: Prepared, cache: Cache, work: number, cancelled: Cancel): Built | undefined;
/// ```
pub fn build(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    input: &Input,
    prepared: &Prepared,
    cache: &mut Cache,
    work: usize,
    cancelled: &dyn Cancel,
) -> Option<Built> {
    let mut run = Run {
        shaper,
        raster,
        input,
        prepared,
        cache,
        picture: Picture::new(prepared.width, prepared.top..prepared.top + prepared.height),
        stats: Stats {
            units: prepared.bands.len(),
            ..Stats::default()
        },
        left: work,
        allowed: work,
    };
    for offset in 0..prepared.bands.len() {
        if cancelled.is_cancelled() {
            tracing::debug!(offset, "minimap build cancelled");
            return None;
        }
        if run.reuse(offset) {
            continue;
        }
        if let Some(reason) = run.render(offset) {
            run.degrade(offset, &reason);
        }
    }
    run.cache.retain(&prepared.window);
    let stats = run.stats;
    tracing::debug!(
        units = stats.units,
        rendered = stats.rendered,
        reused = stats.reused,
        skipped = stats.skipped,
        failed = stats.failed,
        lines = stats.lines,
        work = stats.work,
        "minimap built"
    );
    return Some(Built {
        width: prepared.width as u32,
        height: prepared.height as u32,
        top: prepared.top as u32,
        bytes: run.picture.finish(),
        stats,
    });
}

/// Place the reduction of a unit.
fn place_unit(picture: &mut Picture, reduced: &Reduced) {
    if let Err(error) = picture.place(reduced) {
        tracing::error!(%error, "a reduced minimap strip could not be placed");
    }
}
