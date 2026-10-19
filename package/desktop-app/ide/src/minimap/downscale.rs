//! The area-averaging reduction of premultiplied pixels:
//!  a strip of the window's own rendering,
//!  as many source pixels wide as the text area,
//!  becomes the rows of the minimap picture.
//!
//! Every output pixel is the exact average of the source area it covers,
//!  fractional edges included,
//!  so the result does not depend on how the picture was cut into strips:
//!  a strip adds the share of its rows to the output rows it touches,
//!  and the rows two strips share are completed by their sum.

use anyhow::{Result, bail};
use std::{collections::BTreeMap, ops::Range};

/// What:
///  Tolerance of the comparisons between an interval edge and an output row edge.
/// Why:
///  Edges are products of floats;
///  an edge that lands a hair past a row edge must not make a row of zero weight.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const EDGE = 1e-9;
/// ```
const EDGE: f64 = 1e-9;

/// What:
///  How a source area maps to the output:
///  the source columns the output covers,
///  the output's columns,
///  and the output rows for each source row.
/// Why:
///  The horizontal factor is the output width over the text width,
///  and the vertical factor is the minimap's scale;
///  the two differ,
///  so each axis has its own.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Reduction = { sourceWidth: number; width: number; ratio: number };
/// ```
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Reduction {
    /// Source columns the output covers,
    /// in source pixels;
    /// not a whole number when the text area is not.
    pub source_width: f64,
    /// Columns of the output.
    pub width: usize,
    /// Output rows for each source row.
    pub ratio: f64,
}

/// What:
///  Rows of premultiplied RGBA pixels placed among the rows of the whole source.
/// Why:
///  A strip is one band of the text,
///  rendered at full size,
///  whose rows stand at known places in the source's row coordinates.
///  A strip may stand for more rows than it holds:
///  each of its rows then covers `step` source rows.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Strip = { bytes: Uint8Array; width: number; height: number; top: number; step: number };
/// ```
#[derive(Clone, Copy, Debug)]
pub struct Strip<'a> {
    /// Premultiplied RGBA bytes,
    /// row by row.
    pub bytes: &'a [u8],
    /// Pixels of a row.
    pub width: usize,
    /// Rows of the strip.
    pub height: usize,
    /// Where the first row starts,
    /// in rows of the whole source.
    pub top: f64,
    /// How many rows of the whole source one row of the strip covers.
    pub step: f64,
}

/// What:
///  The output rows one strip contributes to:
///  the pixels of every row it touches,
///  which of them it completes,
///  and the unrounded sums of the others.
/// Why:
///  A row that lies inside the strip is final;
///  a row the strip shares with its neighbour is only part of its average,
///  and keeps full precision until the neighbour's part is added.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Reduced = { width: number; first: number; bytes: Uint8Array; complete: [number, number]; edges: Map<number, Float32Array> };
/// ```
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Reduced {
    /// Columns of a row.
    pub width: usize,
    /// First output row touched.
    pub first: usize,
    /// Rounded premultiplied RGBA of every touched row,
    /// from `first`.
    pub bytes: Vec<u8>,
    /// Output rows this strip alone determines.
    pub complete: Range<usize>,
    /// Unrounded sums of the touched rows that are not complete,
    /// by output row.
    edges: BTreeMap<usize, Vec<f32>>,
}

/// Its rows.
impl Reduced {
    /// Output rows touched.
    pub fn rows(&self) -> usize {
        if self.width == 0 {
            return 0;
        }
        return self.bytes.len() / (self.width * 4);
    }

    /// Output rows the strip shares with a neighbour,
    /// by row.
    pub fn shared(&self) -> Vec<usize> {
        return self.edges.keys().copied().collect();
    }
}

/// What:
///  The output picture the reduced strips are placed in.
/// Why:
///  Complete rows are copied,
///  shared rows are summed,
///  and the sums are rounded once at the end,
///  so cutting the source anywhere gives the same picture.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Picture { place(reduced: Reduced): void; finish(): Uint8Array }
/// ```
pub struct Picture {
    /// Columns.
    width: usize,
    /// Rows.
    height: usize,
    /// Premultiplied RGBA bytes.
    bytes: Vec<u8>,
    /// Sums of the rows two strips share.
    pending: BTreeMap<usize, Vec<f32>>,
}

/// Placing strips.
impl Picture {
    /// A transparent picture `width` columns by `height` rows.
    pub fn new(width: usize, height: usize) -> Self {
        return Self {
            width,
            height,
            bytes: vec![0; width * height * 4],
            pending: BTreeMap::new(),
        };
    }

    /// Place the rows of `reduced`;
    /// a row past the picture's last is left out.
    ///
    /// # Errors
    /// The strip was reduced to another width.
    pub fn place(&mut self, reduced: &Reduced) -> Result<()> {
        if reduced.rows() == 0 {
            return Ok(());
        }
        if reduced.width != self.width {
            bail!(
                "A reduced strip {} columns wide cannot be placed in a picture {} columns wide",
                reduced.width,
                self.width
            );
        }
        let stride = self.width * 4;
        for index in 0..reduced.rows() {
            let row = reduced.first + index;
            if row >= self.height {
                break;
            }
            if let Some(sum) = reduced.edges.get(&row) {
                if let Some(held) = self.pending.get_mut(&row) {
                    for (total, part) in held.iter_mut().zip(sum) {
                        *total += *part;
                    }
                } else {
                    self.pending.insert(row, sum.clone());
                }
                continue;
            }
            self.bytes[row * stride..(row + 1) * stride]
                .copy_from_slice(&reduced.bytes[index * stride..(index + 1) * stride]);
        }
        return Ok(());
    }

    /// The picture's bytes,
    /// the shared rows rounded.
    pub fn finish(mut self) -> Vec<u8> {
        let stride = self.width * 4;
        for (row, sum) in &self.pending {
            for (byte, value) in self.bytes[row * stride..(row + 1) * stride]
                .iter_mut()
                .zip(sum)
            {
                *byte = round_channel(*value);
            }
        }
        return self.bytes;
    }
}

/// A sum of weighted channel values as a byte.
fn round_channel(value: f32) -> u8 {
    return (value.clamp(0.0, 255.0) + 0.5) as u8;
}

/// Whether every byte of `row` is zero,
/// eight bytes at a time.
fn is_blank(row: &[u8]) -> bool {
    let mut chunks = row.chunks_exact(8);
    for chunk in chunks.by_ref() {
        let mut word = [0_u8; 8];
        word.copy_from_slice(chunk);
        if u64::from_ne_bytes(word) != 0 {
            return false;
        }
    }
    for byte in chunks.remainder() {
        if *byte != 0 {
            return false;
        }
    }
    return true;
}

/// What:
///  The weights of the columns of a reduction,
///  and the reduction of strips with them.
/// Why:
///  Every strip of a picture reduces the same columns,
///  so their weights are found once.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class Reducer { constructor(reduction: Reduction, columns: number); reduce(strip: Strip, assigned: [number, number]): Reduced }
/// ```
#[derive(Clone, Debug)]
pub struct Reducer {
    /// The factors.
    reduction: Reduction,
    /// For each source column,
    /// where its targets start in `targets`;
    /// one more entry than columns.
    offsets: Vec<usize>,
    /// The output column and weight of each share of a source column.
    targets: Vec<(usize, f32)>,
}

/// Making and using the weights.
impl Reducer {
    /// The reducer of `reduction` for strips at most `columns` pixels wide.
    pub fn new(reduction: Reduction, columns: usize) -> Self {
        let mut offsets = vec![0];
        let mut targets = Vec::new();
        let valid = reduction.width > 0
            && reduction.source_width.is_finite()
            && reduction.source_width > 0.0
            && reduction.ratio.is_finite()
            && reduction.ratio > 0.0;
        if valid {
            let factor = reduction.width as f64 / reduction.source_width;
            for column in 0..columns {
                let from = column as f64;
                let to = (from + 1.0).min(reduction.source_width);
                if to > from {
                    let first = (from * factor + EDGE).floor() as usize;
                    let last = ((to * factor - EDGE).ceil() as usize)
                        .max(first + 1)
                        .min(reduction.width);
                    for output in first..last {
                        let overlap = (to.min((output + 1) as f64 / factor)
                            - from.max(output as f64 / factor))
                        .max(0.0);
                        if overlap > 0.0 {
                            targets.push((output, (overlap * factor) as f32));
                        }
                    }
                }
                offsets.push(targets.len());
            }
        }
        return Self {
            reduction,
            offsets,
            targets,
        };
    }

    /// The factors.
    pub fn reduction(&self) -> Reduction {
        return self.reduction;
    }

    /// Add the weighted pixels of one source row to `sums`,
    /// one output row of floats;
    /// a row with no ink adds nothing and answers false.
    fn gather(&self, row: &[u8], sums: &mut [f32]) -> bool {
        let columns = (self.offsets.len() - 1).min(row.len() / 4);
        if is_blank(&row[..columns * 4]) {
            return false;
        }
        for column in 0..columns {
            let pixel = &row[column * 4..column * 4 + 4];
            // Premultiplied: no alpha, no ink.
            if pixel[3] == 0 {
                continue;
            }
            for target in &self.targets[self.offsets[column]..self.offsets[column + 1]] {
                let at = target.0 * 4;
                for (channel, value) in pixel.iter().enumerate() {
                    sums[at + channel] += target.1 * f32::from(*value);
                }
            }
        }
        return true;
    }

    /// What:
    ///  Reduce the rows of `strip` that lie in `assigned`,
    ///  an interval of the source's rows,
    ///  to the output rows they fall in.
    /// Why:
    ///  A strip is rendered a little taller than the share of the picture it is for,
    ///  and a neighbour renders the same rows again;
    ///  only the rows assigned to it count,
    ///  so no source row is averaged twice.
    ///  An output row the assigned interval does not cover whole is shared and keeps its unrounded sum.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// reduce(strip: Strip, assigned: [number, number]): Reduced;
    /// ```
    pub fn reduce(&self, strip: &Strip, assigned: &Range<f64>) -> Reduced {
        let reduction = self.reduction;
        let empty = Reduced {
            width: reduction.width,
            ..Reduced::default()
        };
        let valid = self.offsets.len() > 1
            && strip.height > 0
            && strip.width > 0
            && strip.step.is_finite()
            && strip.step > 0.0
            && strip.top.is_finite()
            && strip.bytes.len() >= strip.width * strip.height * 4;
        if !valid {
            return empty;
        }
        let ratio = reduction.ratio;
        let end = strip.top + strip.height as f64 * strip.step;
        let from = assigned.start.max(strip.top);
        let to = assigned.end.min(end);
        if to.is_nan() || from.is_nan() || to <= from {
            return empty;
        }
        let first = (from * ratio + EDGE).floor().max(0.0) as usize;
        let last = ((to * ratio - EDGE).ceil().max(0.0) as usize).max(first + 1);
        let stride = reduction.width * 4;
        let mut sums = vec![0.0_f32; (last - first) * stride];
        let mut gathered = vec![0.0_f32; stride];
        let first_row = ((from - strip.top) / strip.step).floor().max(0.0) as usize;
        let last_row = (((to - strip.top) / strip.step).ceil() as usize).min(strip.height);
        for row in first_row..last_row {
            let start = (strip.top + row as f64 * strip.step).max(from);
            let stop = (strip.top + (row + 1) as f64 * strip.step).min(to);
            if stop <= start {
                continue;
            }
            let source = &strip.bytes[row * strip.width * 4..(row + 1) * strip.width * 4];
            gathered.fill(0.0);
            if !self.gather(source, &mut gathered) {
                continue;
            }
            let upper = (start * ratio + EDGE).floor() as usize;
            let lower = (((stop * ratio - EDGE).ceil()) as usize)
                .max(upper + 1)
                .min(last);
            for output in upper..lower {
                let overlap = (stop.min((output + 1) as f64 / ratio)
                    - start.max(output as f64 / ratio))
                .max(0.0);
                let weight = (overlap * ratio) as f32;
                if weight <= 0.0 {
                    continue;
                }
                let sum = &mut sums[(output - first) * stride..(output - first + 1) * stride];
                for (total, value) in sum.iter_mut().zip(&gathered) {
                    *total += weight * *value;
                }
            }
        }
        // A row whose whole interval lies in the assigned one is final.
        let mut complete_from = last;
        let mut complete_to = first;
        for output in first..last {
            let begins = output as f64 / ratio >= assigned.start - 1e-6;
            let ends = (output + 1) as f64 / ratio <= assigned.end + 1e-6;
            if begins && ends {
                complete_from = complete_from.min(output);
                complete_to = output + 1;
            }
        }
        let mut edges = BTreeMap::new();
        let mut bytes = Vec::with_capacity(sums.len());
        for output in first..last {
            let sum = &sums[(output - first) * stride..(output - first + 1) * stride];
            for value in sum {
                bytes.push(round_channel(*value));
            }
            let inside = output >= complete_from && output < complete_to;
            if !inside {
                edges.insert(output, sum.to_vec());
            }
        }
        return Reduced {
            width: reduction.width,
            first,
            bytes,
            complete: complete_from.min(complete_to)..complete_to,
            edges,
        };
    }
}
