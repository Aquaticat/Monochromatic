//! The minimap's picture:
//!  the window's own rendering of the text,
//!  band by band,
//!  reduced to the minimap's width and the track's height by area averaging,
//!  and put together without a seam.

/// The units a pass keeps from the last picture.
use super::cache::{Cache, Slot};
/// The reduction of a rendered band.
use super::downscale::{Picture, Reduced, Reducer, Reduction, Strip};
/// What the units of a picture are valid for.
use super::key::{Identity, Shared, UnitKey, key_of};
/// The geometry of the track the picture covers.
use super::geometry::Geometry;
/// The width of the text the picture covers.
use super::horizontal::text_span;
/// Rendering one band as the window renders a tile.
use super::render::{Rendered, Scene, render};
/// The units of a picture.
use super::unit::{Density, Piece, Unit, full_density, units};
/// Work in the units of `line_work`.
use crate::shaped_text::{TextShaper, line_work, raster_width};
/// The painter whose glyph cache the bands share.
use crate::text_raster::TextRaster;
use anyhow::{Result, bail};

/// What:
///  Work,
///  in the units of `line_work`,
///  the first, coarse picture of a text may spend rendering lines.
/// Why:
///  The first picture stands on screen quickly:
///  a text that would cost more than this to render in full gets one code row for each output row first,
///  and the full picture follows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const QUICK_WORK = 250_000;
/// ```
pub const QUICK_WORK: usize = 250_000;

/// What:
///  Work,
///  in the units of `line_work`,
///  a full picture may spend rendering lines.
/// Why:
///  A picture samples a bounded number of code rows for each output row,
///  so ordinary text costs a small part of this;
///  the bound is for lines that cost a great deal each.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export const FULL_WORK = 5_000_000;
/// ```
pub const FULL_WORK: usize = 5_000_000;

/// What:
///  The question a build asks between two pieces:
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

/// Which picture a pass builds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Pass {
    /// One code row for each output row,
    /// and nothing kept.
    Quick,
    /// Every code row, or a fixed number for each output row of a squeezed picture.
    Full,
}

/// What:
///  What a build reads:
///  the scene,
///  the identity of its text,
///  and the sizes.
/// Why:
///  Every field is borrowed from a snapshot the worker owns,
///  so a build never touches window state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Input = { scene: Scene; identity: Identity; view: number; width: number };
/// ```
#[derive(Clone, Copy)]
pub struct Input<'a> {
    /// What the bands are rendered from.
    pub scene: Scene<'a>,
    /// Which text and which classes.
    pub identity: Identity,
    /// Height of the view,
    /// in logical pixels,
    /// which is the most the picture can be.
    pub view: f32,
    /// Width of the picture,
    /// in logical pixels.
    pub width: f32,
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
/// type Built = { width: number; height: number; bytes: Uint8Array; stats: Stats };
/// ```
#[derive(Clone, Debug)]
pub struct Built {
    /// Physical pixel width.
    pub width: u32,
    /// Physical pixel height.
    pub height: u32,
    /// Premultiplied RGBA bytes.
    pub bytes: Vec<u8>,
    /// What the build cost.
    pub stats: Stats,
}

/// What:
///  A picture's plan:
///  its units, their keys, and the reduction that fits them to the picture.
/// Why:
///  The plan says what a build would render before anything is rendered,
///  so the worker can decide whether a coarse picture is worth its time.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Prepared = { units: Unit[]; keys: UnitKey[]; reducer: Reducer; width: number; height: number };
/// ```
pub struct Prepared {
    /// What the picture is made of.
    units: Vec<Unit>,
    /// What each unit is valid for.
    keys: Vec<UnitKey>,
    /// The weights of the reduction.
    reducer: Reducer,
    /// Physical pixel width.
    width: usize,
    /// Physical pixel height.
    height: usize,
    /// Physical rows of the whole text.
    extent: f64,
}

/// The cost of rendering the lines of `piece`:
/// `usize::MAX` for a line no budget can pay.
fn cost_of(scene: &Scene, piece: &Piece) -> usize {
    let mut total: usize = 0;
    for line in piece.band.first..piece.band.first + piece.band.count {
        total = total.saturating_add(line_work(scene.document, line));
    }
    return total;
}

/// What:
///  Plan the picture of `input` for `pass`.
/// Why:
///  The track's height and the minimap's width fix the size,
///  the minimap's scale fixes the rows of the text for each row of the picture,
///  and the density fixes which of those rows are rendered.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function prepare(input: Input, pass: Pass): Prepared;
/// ```
pub fn prepare(input: &Input, pass: Pass) -> Prepared {
    let scene = &input.scene;
    let scale = scene.scale.max(0.25);
    let geometry = Geometry::new(scene.map.height(), input.view);
    let ratio = f64::from(geometry.scale());
    let width = ((input.width * scale).round() as usize).max(1);
    let height = ((geometry.track() * scale) as f64 - 1e-3).ceil().max(0.0) as usize;
    let span = text_span(scene.wrap);
    let columns = (raster_width(scene.wrap) * scale).ceil() as u64;
    let reduction = Reduction {
        source_width: f64::from(span) * f64::from(scale),
        width,
        ratio,
    };
    let density = match pass {
        Pass::Quick => Density::Sampled(1),
        Pass::Full => full_density(ratio),
    };
    let shared = Shared {
        identity: input.identity,
        colors: scene.colors,
        inks: scene.inks,
        fills: scene.fills,
        scale: scale.to_bits(),
        wrap: scene.wrap.map_or(0, f32::to_bits),
        ratio: ratio.to_bits(),
        width,
    };
    let planned = units(scene.map, density, (ratio, scale, columns), height);
    let mut keys = Vec::new();
    for unit in &planned {
        keys.push(key_of(unit, scene, shared));
    }
    return Prepared {
        units: planned,
        keys,
        reducer: Reducer::new(reduction, columns as usize),
        width,
        height,
        extent: f64::from(scene.map.height()) * f64::from(scale),
    };
}

/// Prepared pictures.
impl Prepared {
    /// What the picture would cost to render now,
    /// in work:
    /// the units `cache` does not hold for their keys.
    pub fn pending_work(&self, scene: &Scene, cache: &Cache) -> usize {
        let mut total: usize = 0;
        for (index, unit) in self.units.iter().enumerate() {
            if let Some(slot) = cache.get(index)
                && slot.key == self.keys[index]
            {
                continue;
            }
            for piece in &unit.pieces {
                total = total.saturating_add(cost_of(scene, piece));
            }
        }
        return total;
    }

    /// Units of the picture.
    pub fn units(&self) -> usize {
        return self.units.len();
    }
}

/// The reduction of the rendered `piece`.
fn reduce_piece(
    prepared: &Prepared,
    piece: &Piece,
    rendered: &Rendered,
) -> Result<Reduced> {
    let (top, step) = if piece.stretch {
        let length = piece.assigned.end - piece.assigned.start;
        (piece.assigned.start, length / rendered.height.max(1) as f64)
    } else {
        // A band renders a little more than its stretch, never less.
        let bottom = rendered.top + rendered.height as f64;
        if rendered.top > piece.assigned.start + 1.0
            || bottom + 1.0 < piece.assigned.end.min(prepared.extent)
        {
            bail!(
                "The rendered rows {:.1} to {:.1} do not cover the stretch {:.1} to {:.1}",
                rendered.top,
                bottom,
                piece.assigned.start,
                piece.assigned.end
            );
        }
        (rendered.top, 1.0)
    };
    let strip = Strip {
        bytes: &rendered.bytes,
        width: rendered.width,
        height: rendered.height,
        top,
        step,
    };
    return Ok(prepared.reducer.reduce(&strip, &piece.assigned));
}

/// Render and reduce every piece of `unit`.
fn make_unit(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    prepared: &Prepared,
    scene: &Scene,
    unit: &Unit,
) -> Result<(Vec<Reduced>, usize)> {
    let mut reduced = Vec::new();
    let mut largest = 0;
    for piece in &unit.pieces {
        let rendered = match render(shaper, raster, scene, &piece.band) {
            Ok(done) => done,
            Err(error) => {
                bail!(
                    "Cannot render the lines {} to {}: {error:#}",
                    piece.band.first,
                    piece.band.first + piece.band.count
                );
            }
        };
        largest = largest.max(rendered.bytes.len());
        reduced.push(reduce_piece(prepared, piece, &rendered)?);
    }
    return Ok((reduced, largest));
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
    /// The units of the last picture,
    /// when this pass keeps them.
    cache: Option<&'a mut Cache>,
    /// The picture being filled.
    picture: Picture,
    /// The cost so far.
    stats: Stats,
    /// Work still allowed.
    left: usize,
    /// Work the pass was allowed.
    allowed: usize,
}

/// The steps of one unit.
impl Run<'_> {
    /// Use the kept unit at `index` when its key is unchanged.
    fn reuse(&mut self, index: usize) -> bool {
        let Some(cache) = self.cache.as_deref() else {
            return false;
        };
        let Some(slot) = cache.get(index) else {
            return false;
        };
        if slot.key != self.prepared.keys[index] {
            return false;
        }
        place_all(&mut self.picture, &slot.reduced);
        self.stats.reused += 1;
        return true;
    }

    /// The reductions the cache holds for the place of unit `index`,
    /// whatever they were rendered for.
    fn kept(&self, index: usize) -> Option<Vec<Reduced>> {
        let cache = self.cache.as_deref()?;
        let slot = cache.get(index)?;
        if slot.key.same_place(&self.prepared.keys[index]) {
            return Some(slot.reduced.clone());
        }
        return None;
    }

    /// Render unit `index` and place it;
    /// the answer is why it could not be,
    /// if it could not.
    fn render(&mut self, index: usize) -> Option<String> {
        let unit = &self.prepared.units[index];
        let mut cost: usize = 0;
        for piece in &unit.pieces {
            cost = cost.saturating_add(cost_of(&self.input.scene, piece));
        }
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
            unit,
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
        for piece in &unit.pieces {
            self.stats.lines += piece.band.count;
        }
        place_all(&mut self.picture, &reduced);
        if let Some(cache) = self.cache.as_deref_mut() {
            cache.put(
                index,
                Slot {
                    key: self.prepared.keys[index].clone(),
                    reduced,
                },
            );
        }
        return None;
    }

    /// Log that unit `index` was not rendered for `reason`,
    /// and keep the rows of the last picture in its place.
    fn degrade(&mut self, index: usize, reason: &str) {
        let pieces = &self.prepared.units[index].pieces;
        let mut first = None;
        let mut end = None;
        if let (Some(head), Some(tail)) = (pieces.first(), pieces.last()) {
            first = Some(head.band.first);
            end = Some(tail.band.first + tail.band.count);
        }
        let kept = self.kept(index);
        tracing::warn!(
            first_line = ?first,
            end_line = ?end,
            kept = kept.is_some(),
            reason,
            "a minimap band was not rendered; the rows of the previous picture stay"
        );
        if let Some(rows) = kept {
            place_all(&mut self.picture, &rows);
        }
    }
}

/// What:
///  Build the picture `prepared` plans,
///  rendering the units `cache` does not hold within `work`,
///  and asking `cancelled` between units.
///  A unit that cannot be rendered or paid for keeps the rows the cache holds for the same place,
///  and is counted and logged.
/// Why:
///  A band that fails must not blank the picture:
///  the rows of the last picture stay.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function build(shaper: TextShaper, raster: TextRaster, input: Input, prepared: Prepared, cache: Cache | undefined, work: number, cancelled: Cancel): Built | undefined;
/// ```
pub fn build(
    shaper: &mut TextShaper,
    raster: &mut TextRaster,
    input: &Input,
    prepared: &Prepared,
    cache: Option<&mut Cache>,
    work: usize,
    cancelled: &dyn Cancel,
) -> Option<Built> {
    let mut run = Run {
        shaper,
        raster,
        input,
        prepared,
        cache,
        picture: Picture::new(prepared.width, prepared.height),
        stats: Stats {
            units: prepared.units.len(),
            ..Stats::default()
        },
        left: work,
        allowed: work,
    };
    for index in 0..prepared.units.len() {
        if cancelled.is_cancelled() {
            tracing::debug!(index, "minimap build cancelled");
            return None;
        }
        if run.reuse(index) {
            continue;
        }
        if let Some(reason) = run.render(index) {
            run.degrade(index, &reason);
        }
    }
    if let Some(cache) = run.cache.as_deref_mut() {
        cache.truncate(prepared.units.len());
    }
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
        bytes: run.picture.finish(),
        stats,
    });
}

/// Place every reduction of a unit.
fn place_all(picture: &mut Picture, reduced: &[Reduced]) {
    for part in reduced {
        if let Err(error) = picture.place(part) {
            tracing::error!(%error, "a reduced minimap strip could not be placed");
        }
    }
}
