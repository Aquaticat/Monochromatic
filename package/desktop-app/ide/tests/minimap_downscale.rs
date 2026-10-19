//! The area-averaging reduction of the minimap's picture without a window:
//!  positive controls with averages that can be computed by hand,
//!  an independent exact reference,
//!  adversarial sizes,
//!  alpha,
//!  and the stitch of strips (no seam at a border,
//! however the source is cut).

/// The reduction under test.
use ide_app::minimap::{Picture, Reducer, Reduction, Strip};
/// Strips cover intervals of the source's rows.
use std::ops::Range;

/// A source image of premultiplied RGBA pixels.
struct Image {
    /// Pixels of a row.
    width: usize,
    /// Rows.
    height: usize,
    /// Premultiplied RGBA bytes.
    bytes: Vec<u8>,
}

/// Making and reading images.
impl Image {
    /// An image whose pixel at (`x`,
    /// `y`) is `paint(x, y)`.
    fn made(width: usize, height: usize, paint: fn(usize, usize) -> [u8; 4]) -> Self {
        let mut bytes = Vec::new();
        for y in 0..height {
            for x in 0..width {
                bytes.extend_from_slice(&paint(x, y));
            }
        }
        return Self {
            width,
            height,
            bytes,
        };
    }

    /// The rows `from` to `to` as a strip placed at row `top` of the source.
    fn strip(&self, from: usize, to: usize, top: f64) -> Strip<'_> {
        return Strip {
            bytes: &self.bytes[from * self.width * 4..to * self.width * 4],
            width: self.width,
            height: to - from,
            top,
        };
    }
}

/// A pixel of the picture `bytes`,
/// `width` columns wide.
fn pixel(bytes: &[u8], width: usize, column: usize, row: usize) -> [u8; 4] {
    let at = (row * width + column) * 4;
    return [bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]];
}

/// A pixel of the solid color of the uniform field.
fn solid(_x: usize, _y: usize) -> [u8; 4] {
    return [200, 100, 50, 255];
}

/// A checkerboard of single pixels.
fn checkerboard(x: usize, y: usize) -> [u8; 4] {
    if (x + y) % 2 == 0 {
        return [255, 255, 255, 255];
    }
    return [0, 0, 0, 255];
}

/// White on the left half of eight columns and black on the right.
fn halves(x: usize, _y: usize) -> [u8; 4] {
    if x < 4 {
        return [255, 255, 255, 255];
    }
    return [0, 0, 0, 255];
}

/// One ink in a field of nothing.
fn dot(x: usize, y: usize) -> [u8; 4] {
    if x == 1 && y == 2 {
        return [200, 100, 0, 200];
    }
    return [0; 4];
}

/// A ramp of red along the columns.
fn ramp_across(x: usize, _y: usize) -> [u8; 4] {
    return [(x as u8 + 1) * 10, 0, 0, 255];
}

/// A ramp of red down the rows.
fn ramp_down(_x: usize, y: usize) -> [u8; 4] {
    return [(y as u8 + 1) * 10, 0, 0, 255];
}

/// A gradient of both coordinates.
fn gradient(x: usize, y: usize) -> [u8; 4] {
    return [(x * 100 + y * 50) as u8, 0, 0, 255];
}

/// A half transparent red pixel in the first column and nothing after.
fn half_red_first(x: usize, _y: usize) -> [u8; 4] {
    if x == 0 {
        return [128, 0, 0, 128];
    }
    return [0; 4];
}

/// Opaque white in the first column and nothing after.
fn white_first(x: usize, _y: usize) -> [u8; 4] {
    if x == 0 {
        return [255, 255, 255, 255];
    }
    return [0; 4];
}

/// Opaque white everywhere.
fn white(_x: usize, _y: usize) -> [u8; 4] {
    return [255; 4];
}

/// Nothing.
fn nothing(_x: usize, _y: usize) -> [u8; 4] {
    return [0; 4];
}

/// The same pixel everywhere,
/// with ink in every channel.
fn faint(_x: usize, _y: usize) -> [u8; 4] {
    return [9; 4];
}

/// One pixel of mixed channels.
fn single(_x: usize, _y: usize) -> [u8; 4] {
    return [10, 20, 30, 40];
}

/// A ramp of red that wraps every 256 columns.
fn wide_ramp(x: usize, _y: usize) -> [u8; 4] {
    return [(x % 256) as u8, 0, 0, 255];
}

/// Ink on every fourth row.
fn every_fourth(_x: usize, y: usize) -> [u8; 4] {
    return [0, 0, 0, if y % 4 == 0 { 255 } else { 0 }];
}

/// The reduction of the whole image in one strip,
/// as a picture of `height` rows.
fn whole(image: &Image, reduction: Reduction, height: usize) -> Vec<u8> {
    let reducer = Reducer::new(reduction, image.width);
    let reduced = reducer.reduce(
        &image.strip(0, image.height, 0.0),
        &(0.0..f64::INFINITY),
    );
    let mut picture = Picture::new(reduction.width, 0..height);
    picture.place(&reduced).expect("same width");
    return picture.finish();
}

/// The overlap of the intervals `[a, b)` and `[c, d)`.
fn overlap(a: f64, b: f64, c: f64, d: f64) -> f64 {
    return (b.min(d) - a.max(c)).max(0.0);
}

/// What:
///  The exact average of the source area of each output pixel,
///  computed pixel by pixel from the definition,
///  in floats.
/// Why:
///  An independent reference for the reduction's weights.
fn reference(image: &Image, reduction: Reduction, height: usize) -> Vec<f64> {
    let columns_per = reduction.source_width / reduction.width as f64;
    let rows_per = 1.0 / reduction.ratio;
    let mut out = vec![0.0; reduction.width * height * 4];
    for row in 0..height {
        for column in 0..reduction.width {
            for y in 0..image.height {
                let wy = overlap(
                    y as f64,
                    y as f64 + 1.0,
                    row as f64 * rows_per,
                    (row + 1) as f64 * rows_per,
                );
                for x in 0..image.width {
                    let wx = overlap(
                        x as f64,
                        x as f64 + 1.0,
                        column as f64 * columns_per,
                        (column + 1) as f64 * columns_per,
                    );
                    let weight = wx * wy / (columns_per * rows_per);
                    for channel in 0..4 {
                        out[(row * reduction.width + column) * 4 + channel] +=
                            weight * f64::from(image.bytes[(y * image.width + x) * 4 + channel]);
                    }
                }
            }
        }
    }
    return out;
}

/// The largest distance between a picture and the exact averages.
fn distance(picture: &[u8], exact: &[f64]) -> f64 {
    let mut worst: f64 = 0.0;
    for (byte, value) in picture.iter().zip(exact) {
        worst = worst.max((f64::from(*byte) - value).abs());
    }
    return worst;
}

/// A deterministic pattern of ink with every channel at most its alpha.
fn speckle(x: usize, y: usize) -> [u8; 4] {
    let seed = (x * 7919 + y * 104_729 + x * y * 31) % 251;
    let alpha = (seed * 37 % 256) as u8;
    return [alpha / 2, (alpha / 3) * 2, alpha / 5, alpha];
}

/// A solid color stays that color under every ratio,
/// whole numbers of pixels or not.
#[test]
fn a_uniform_field_keeps_its_color_at_every_ratio() {
    let image = Image::made(37, 53, solid);
    for (width, ratio) in [
        (1, 1.0 / 53.0),
        (3, 0.37),
        (7, 1.0 / 6.0),
        (37, 1.0),
        (60, 0.25),
    ] {
        let reduction = Reduction {
            source_width: 37.0,
            width,
            ratio,
        };
        let height = (53.0 * ratio).ceil() as usize;
        let picture = whole(&image, reduction, height);
        for row in 0..height {
            for column in 0..width {
                let covered = ((row + 1) as f64 / ratio).min(53.0) - row as f64 / ratio;
                let share = covered * ratio;
                let got = pixel(&picture, width, column, row);
                let want = (255.0 * share).round();
                assert!(
                    (f64::from(got[3]) - want).abs() <= 1.0,
                    "ratio {ratio}, width {width}: alpha {} at ({column}, {row}), expected {want}",
                    got[3]
                );
            }
        }
    }
}

/// A black and white checkerboard of single pixels averages to the middle,
/// and a half white image to half.
#[test]
fn known_patterns_average_to_the_values_computed_by_hand() {
    let checker = Image::made(8, 8, checkerboard);
    let reduction = Reduction {
        source_width: 8.0,
        width: 2,
        ratio: 0.25,
    };
    let picture = whole(&checker, reduction, 2);
    for row in 0..2 {
        for column in 0..2 {
            assert_eq!(
                pixel(&picture, 2, column, row),
                [128, 128, 128, 255],
                "checker at ({column}, {row})"
            );
        }
    }
    // The left half white, the right half black: 4 to 1 across, so the two output columns are the halves.
    let split = Image::made(8, 4, halves);
    let picture_2 = whole(
        &split,
        Reduction {
            source_width: 8.0,
            width: 2,
            ratio: 0.5,
        },
        2,
    );
    assert_eq!(pixel(&picture_2, 2, 0, 0), [255, 255, 255, 255]);
    assert_eq!(pixel(&picture_2, 2, 1, 0), [0, 0, 0, 255]);
    // Four source columns, one ink and three blanks: a quarter of the ink.
    let speck = Image::made(4, 4, dot);
    let picture_3 = whole(
        &speck,
        Reduction {
            source_width: 4.0,
            width: 1,
            ratio: 0.25,
        },
        1,
    );
    assert_eq!(
        pixel(&picture_3, 1, 0, 0),
        [13, 6, 0, 13],
        "a sixteenth of the ink"
    );
}

/// A ratio that is not a whole number splits the pixel on the edge:
/// five columns into two take two and a half each.
#[test]
fn a_fractional_ratio_weighs_the_pixel_on_the_edge_by_its_share() {
    let image = Image::made(5, 1, ramp_across);
    let picture = whole(
        &image,
        Reduction {
            source_width: 5.0,
            width: 2,
            ratio: 1.0,
        },
        1,
    );
    // Columns 0, 1 and half of 2 (10, 20, 30 at half weight) over 2.5; then half of 2, 3 and 4 (40, 50) over 2.5.
    let first: f64 = (10.0 + 20.0 + 15.0) / 2.5;
    let second: f64 = (15.0 + 40.0 + 50.0) / 2.5;
    assert_eq!(pixel(&picture, 2, 0, 0)[0], first.round() as u8);
    assert_eq!(pixel(&picture, 2, 1, 0)[0], second.round() as u8);
}

/// Rows split the same way:
/// five rows into two output rows take two and a half source rows each,
/// weighed by their share of the output row.
#[test]
fn a_fractional_ratio_of_rows_weighs_the_row_on_the_edge_by_its_share() {
    let image = Image::made(1, 5, ramp_down);
    let picture = whole(
        &image,
        Reduction {
            source_width: 1.0,
            width: 1,
            ratio: 0.4,
        },
        2,
    );
    // Rows 0, 1 and half of 2 (10, 20, 30) over 2.5; then half of 2, 3 and 4 (40, 50) over 2.5.
    let first: f64 = (10.0 + 20.0 + 15.0) / 2.5;
    let second: f64 = (15.0 + 40.0 + 50.0) / 2.5;
    assert_eq!(pixel(&picture, 1, 0, 0)[0], first.round() as u8);
    assert_eq!(pixel(&picture, 1, 0, 1)[0], second.round() as u8);
}

/// A ratio below one repeats pixels:
/// every output pixel is the pixel it lies in.
#[test]
fn a_ratio_above_one_repeats_the_pixels() {
    let image = Image::made(2, 2, gradient);
    let picture = whole(
        &image,
        Reduction {
            source_width: 2.0,
            width: 6,
            ratio: 3.0,
        },
        6,
    );
    for row in 0..6 {
        for column in 0..6 {
            let want = (column / 3 * 100 + row / 3 * 50) as u8;
            assert_eq!(
                pixel(&picture, 6, column, row)[0],
                want,
                "repeated pixel at ({column}, {row})"
            );
        }
    }
}

/// The reduction agrees with the exact definition on noise,
/// at ratios that cut pixels in awkward places.
#[test]
fn the_reduction_matches_the_exact_average_of_noise() {
    let image = Image::made(41, 67, speckle);
    for (source_width, width, ratio) in [
        (41.0, 5, 0.13),
        (40.5, 7, 0.3),
        (41.0, 41, 1.0),
        (33.3, 4, 0.0713),
        (41.0, 3, 0.77),
    ] {
        let reduction = Reduction {
            source_width,
            width,
            ratio,
        };
        let height = (67.0_f64 * ratio).ceil() as usize;
        let picture = whole(&image, reduction, height);
        let exact = reference(&image, reduction, height);
        assert!(
            distance(&picture, &exact) <= 0.51,
            "ratio {ratio}: the picture is {} from the exact average",
            distance(&picture, &exact)
        );
    }
}

/// Premultiplied pixels average as they are:
/// a half transparent pixel and a transparent one make a quarter.
#[test]
fn alpha_is_averaged_without_weighting_by_it() {
    let image = Image::made(2, 1, half_red_first);
    let picture = whole(
        &image,
        Reduction {
            source_width: 2.0,
            width: 1,
            ratio: 1.0,
        },
        1,
    );
    assert_eq!(pixel(&picture, 1, 0, 0), [64, 0, 0, 64]);
    // Opaque ink next to nothing never exceeds its alpha in any channel.
    let ink = Image::made(3, 3, white_first);
    let picture_2 = whole(
        &ink,
        Reduction {
            source_width: 3.0,
            width: 2,
            ratio: 0.7,
        },
        3,
    );
    for chunk in picture_2.chunks(4) {
        assert!(chunk[0] <= chunk[3] && chunk[1] <= chunk[3] && chunk[2] <= chunk[3]);
    }
}

/// Rows with no ink contribute nothing,
/// and the rows below the end of the text are transparent:
/// the last output row of five source rows at half a row each is a third covered.
#[test]
fn the_rows_below_the_text_count_as_transparent() {
    let image = Image::made(1, 5, white);
    let picture = whole(
        &image,
        Reduction {
            source_width: 1.0,
            width: 1,
            ratio: 0.5,
        },
        3,
    );
    assert_eq!(pixel(&picture, 1, 0, 0)[3], 255);
    assert_eq!(pixel(&picture, 1, 0, 1)[3], 255);
    assert_eq!(
        pixel(&picture, 1, 0, 2)[3],
        128,
        "one of two source rows lies in the text"
    );
}

/// Sizes at the edges of what a reduction is asked:
/// nothing,
/// one pixel,
/// a strip a hundred thousand pixels wide,
/// and a ratio that makes a hundred thousand rows one.
#[test]
fn adversarial_sizes_neither_panic_nor_lose_the_average() {
    // Zero rows, zero columns, and a reduction to no columns.
    let empty = Image::made(0, 0, nothing);
    let reducer = Reducer::new(
        Reduction {
            source_width: 4.0,
            width: 2,
            ratio: 0.5,
        },
        0,
    );
    let reduced = reducer.reduce(&empty.strip(0, 0, 0.0), &(0.0..f64::INFINITY));
    assert_eq!(reduced.rows(), 0);
    let blank = Image::made(3, 3, faint);
    for bad in [
        Reduction {
            source_width: 3.0,
            width: 0,
            ratio: 1.0,
        },
        Reduction {
            source_width: 0.0,
            width: 1,
            ratio: 1.0,
        },
        Reduction {
            source_width: f64::NAN,
            width: 1,
            ratio: 1.0,
        },
        Reduction {
            source_width: 3.0,
            width: 1,
            ratio: 0.0,
        },
        Reduction {
            source_width: 3.0,
            width: 1,
            ratio: f64::INFINITY,
        },
    ] {
        let refusing = Reducer::new(bad, 3);
        let nothing_reduced = refusing.reduce(&blank.strip(0, 3, 0.0), &(0.0..f64::INFINITY));
        assert_eq!(nothing_reduced.rows(), 0, "{bad:?} reduces to nothing");
    }
    // One pixel to one pixel.
    let one = Image::made(1, 1, single);
    let picture = whole(
        &one,
        Reduction {
            source_width: 1.0,
            width: 1,
            ratio: 1.0,
        },
        1,
    );
    assert_eq!(pixel(&picture, 1, 0, 0), [10, 20, 30, 40]);
    // A hundred thousand columns to one: the average of a ramp.
    let wide = Image::made(100_000, 1, wide_ramp);
    let picture_2 = whole(
        &wide,
        Reduction {
            source_width: 100_000.0,
            width: 1,
            ratio: 1.0,
        },
        1,
    );
    let mut sum = 0_u64;
    for x in 0..100_000_u64 {
        sum += x % 256;
    }
    assert_eq!(
        u64::from(picture_2[0]),
        (sum as f64 / 100_000.0).round() as u64
    );
    // A hundred thousand rows to one.
    let tall = Image::made(1, 100_000, every_fourth);
    let picture_3 = whole(
        &tall,
        Reduction {
            source_width: 1.0,
            width: 1,
            ratio: 1.0 / 100_000.0,
        },
        1,
    );
    assert_eq!(picture_3[3], 64);
}

/// The strips two bands of a picture_3 reduce to,
/// placed together.
fn stitched(image: &Image, reduction: Reduction, height: usize, cuts: &[usize]) -> Vec<u8> {
    let reducer = Reducer::new(reduction, image.width);
    let mut picture = Picture::new(reduction.width, 0..height);
    let mut from: usize = 0;
    let mut edges = cuts.to_vec();
    edges.push(image.height);
    for (index, edge) in edges.iter().enumerate() {
        let last = index + 1 == edges.len();
        let assigned: Range<f64> = if last {
            from as f64..f64::INFINITY
        } else {
            from as f64..*edge as f64
        };
        // Each band renders a few rows more than it answers for, on both sides.
        let low = from.saturating_sub(2);
        let high = (*edge + 3).min(image.height);
        let reduced = reducer.reduce(&image.strip(low, high, low as f64), &assigned);
        picture.place(&reduced).expect("same width");
        from = *edge;
    }
    return picture.finish();
}

/// However the source is cut into bands,
/// the picture is the one the whole source gives:
/// no seam at a border,
/// at borders inside an output row or on its edge.
#[test]
fn bands_put_together_make_the_picture_of_the_whole_without_a_seam() {
    let image = Image::made(29, 120, speckle);
    for ratio in [1.0 / 6.0, 0.4, 0.049, 1.0] {
        let reduction = Reduction {
            source_width: 29.0,
            width: 5,
            ratio,
        };
        let height = (120.0_f64 * ratio).ceil() as usize;
        let one = whole(&image, reduction, height);
        for cuts in [
            vec![60],
            vec![7, 8, 9],
            vec![1, 2, 3, 50, 99],
            vec![
                6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114,
            ],
            vec![10, 45, 46, 47, 118],
        ] {
            let many = stitched(&image, reduction, height, &cuts);
            let mut worst = 0_u8;
            for (left, right) in one.iter().zip(&many) {
                worst = worst.max(left.abs_diff(*right));
            }
            assert!(
                worst <= 1,
                "ratio {ratio}, cuts {cuts:?}: the stitched picture differs by {worst}"
            );
        }
    }
}

/// A strip reduced to another width than the picture's is refused with a message,
/// and the picture is unchanged.
#[test]
fn a_strip_of_another_width_cannot_be_placed() {
    let image = Image::made(4, 4, white);
    let reducer = Reducer::new(
        Reduction {
            source_width: 4.0,
            width: 2,
            ratio: 1.0,
        },
        4,
    );
    let reduced = reducer.reduce(&image.strip(0, 4, 0.0), &(0.0..4.0));
    let mut picture = Picture::new(3, 0..4);
    let error = picture.place(&reduced).expect_err("another width");
    assert!(
        format!("{error}").contains("2 columns wide"),
        "the message names the widths: {error}"
    );
    let mut all_blank = true;
    for byte in picture.finish() {
        if byte != 0 {
            all_blank = false;
        }
    }
    assert!(all_blank, "a refused strip leaves the picture blank");
}
