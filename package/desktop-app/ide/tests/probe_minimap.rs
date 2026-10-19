//! Throwaway probe: time of shaping and painting bands of a long text.

use ide_app::document::Document;
use ide_app::row_map::{CODE_ROW, RowMap};
use ide_app::shaped_text::{Clip, TextShaper, Viewport};
use ide_app::text_raster::{CodeColors, TextRaster};
use std::fmt::Write as _;
use std::time::Instant;

const DARK: CodeColors = CodeColors {
    foreground: [220, 220, 220, 255],
    selected: [255, 255, 255, 255],
    dark: true,
};

fn synthetic(lines: usize) -> String {
    let mut text = String::new();
    for number in 0..lines {
        if number > 0 {
            text.push('\n');
        }
        let _ = write!(
            text,
            "    let value_{number} = compute({number}, \"text\", Some(other.field)); // trailing comment"
        );
    }
    return text;
}

fn run(report: &mut String, name: &str, text: &str, scale: f32, band: f32) {
    let document = Document::new(text);
    let lines = document.text().len_lines();
    let map = RowMap::plain(lines);
    let mut shaper = TextShaper::new();
    let mut raster = TextRaster::new();
    let wrap = 1354.0_f32;
    let width = wrap + 24.0;
    let height = map.height();
    let started = Instant::now();
    let mut top = 0.0_f32;
    let mut bands = 0;
    let mut shape_paint = 0.0_f64;
    let mut worst = 0.0_f64;
    let mut bytes_worst = 0_usize;
    while top < height {
        let bottom = (top + band).min(height);
        let first = map.locate(top).line;
        let last = map.locate(bottom - 0.01).line;
        let first_top = map.block_top(first);
        let clip = Clip {
            top: ((top - first_top) / CODE_ROW).floor().max(0.0) * CODE_ROW,
            bottom: ((bottom - first_top) / CODE_ROW).ceil() * CODE_ROW,
        };
        let viewport = Viewport {
            first,
            count: last - first + 1,
            width,
            scale,
            wrap: Some(wrap),
            clip: Some(clip),
        };
        let one = Instant::now();
        let view = shaper.prepare_rows(&document, viewport, &[], &map);
        let pixels = raster.paint(&view, DARK, 0.0).expect("paint");
        let spent = one.elapsed().as_secs_f64() * 1000.0;
        shape_paint += spent;
        worst = worst.max(spent);
        bytes_worst = bytes_worst.max(pixels.bytes.len());
        bands += 1;
        top = bottom;
    }
    let _ = writeln!(
        report,
        "{name} lines {lines} scale {scale} band {band}: bands {bands}, total {:.1} ms (wall {:.1}), per band mean {:.2} ms worst {:.2} ms, largest raster {} KiB",
        shape_paint,
        started.elapsed().as_secs_f64() * 1000.0,
        shape_paint / f64::from(bands),
        worst,
        bytes_worst / 1024
    );
}

#[test]
fn probe() {
    let real = include_str!("../src/native/wrap_resize_tests.rs");
    let big = synthetic(5_000);
    let mut report = String::new();
    for scale in [1.0_f32, 2.0] {
        for band in [240.0_f32, 768.0, 1536.0] {
            run(&mut report, "real", real, scale, band);
        }
        run(&mut report, "synthetic5000", &big, scale, 768.0);
    }
    std::fs::write("target/probe.txt", &report).expect("write");
    println!("{report}");
}
